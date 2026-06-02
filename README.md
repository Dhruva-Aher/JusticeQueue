# JusticeQueue

A legal case triage system for legal aid clinics that scores intake cases by urgency, retrieves similar historical outcomes from MongoDB Atlas Vector Search, and prepares a ranked attorney docket with supporting documentation.

**Live:** https://justicequeuelive.vercel.app  
**Public demo (no login):** https://justicequeuelive.vercel.app/judge

---

## Overview

Legal aid clinics receive intake requests faster than they can process them. A typical clinic may have dozens of pending cases at any given time, each with a different deadline, client situation, and documentation status. Without a structured triage process, attorneys working from first-in-first-out queues routinely discover urgent cases too late — after a court date has passed or an appeal window has closed.

JusticeQueue addresses the triage bottleneck specifically. It accepts CSV, TXT, or PDF intake files, extracts structured case data from each record using a language model, scores every case on four deterministic dimensions (deadline proximity, client vulnerability, case type severity, and similarity to historical outcomes), and produces a ranked queue. A separate "docket preparation" workflow runs on demand, retrieves legal precedents from CourtListener, generates per-case attorney recommendations using Gemini, and writes a printable executive brief. Every step is logged with timing data and tool attribution. Critical recommendations are flagged for mandatory attorney review before any action is taken.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Browser (Next.js 14)                           │
│                                                                     │
│  /dashboard        — case queue, upload, stats                     │
│  /agent            — docket run history, execution trace           │
│  /agent/brief      — printable attorney brief                      │
│  /judge            — public demo, no auth, static representative   │
│                        data                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   API Routes (Vercel serverless)                     │
│                                                                     │
│  POST /api/intake/upload    — file parsing + intake agent pipeline  │
│  POST /api/agent/docket     — 9-step docket preparation agent      │
│  GET  /api/agent/runs       — list agent runs for user             │
│  GET  /api/agent/runs/:id   — full run document with steps[]       │
│  GET  /api/cases/queue      — sorted active case queue             │
│  GET  /api/cases/:id        — single case with agent trace         │
│  POST /api/cases/:id/override — manual score override (audited)   │
│  POST /api/seed/past-cases  — seed historical cases with embeddings│
│  POST /api/demo/seed        — seed 50 curated demo cases           │
│  GET  /api/demo/queue       — 5 hardcoded cases, no auth           │
│                                                                     │
│  Auth:         Firebase JWT verification (lib/verifyToken.js)      │
│  Rate limit:   Upstash Redis — 10 uploads / 15 min / user          │
└───────┬───────────────────────┬─────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐   ┌──────────────────────────────────────────────────┐
│ Intake        │   │ Docket Agent (9 steps)                          │
│ Pipeline      │   │                                                  │
│               │   │  1. MongoDB query    → cases collection         │
│ Gemini Flash  │   │  2. JS filter        → urgency buckets          │
│  (extract)    │   │  3. JS filter        → missing_info detection   │
│               │   │  4. Voyage AI emb.   → Atlas $vectorSearch      │
│ Voyage AI     │   │  5. CourtListener    → legal opinions (cond.)   │
│  (embed)      │   │  6. Gemini Pro       → recommendations          │
│               │   │  7. Gemini Pro       → executive report         │
│ $vectorSearch │   │  8. MongoDB write    → AgentRun document        │
│  (retrieve)   │   │                                                  │
│               │   │  Every branch decision logged to decisions[]    │
│ computeScore()│   └──────────────────────────────────────────────────┘
│  (score)      │
│               │
│ Gemini Pro    │
│  (rec ≥ 80)   │
└───────┬───────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       MongoDB Atlas                                 │
│                                                                     │
│  cases          — active case queue per user                       │
│  agent_runs     — docket execution traces (steps, decisions,       │
│                   vector results, recommendations)                  │
│  users          — user profiles (clinic name, display name)        │
│  past_cases     — 30 historical case outcomes with embeddings      │
│                                                                     │
│  Vector Search index: description_embedding_index                  │
│    collection:  past_cases                                         │
│    path:        description_embedding                              │
│    dimensions:  1024 (Voyage AI voyage-large-2)                    │
│    similarity:  cosine                                              │
└─────────────────────────────────────────────────────────────────────┘

External services
  aiplatform.googleapis.com — Gemini via Vertex AI (OAuth 2.0 Bearer)
  api.voyageai.com          — voyage-large-2 embeddings
  courtlistener.com         — legal opinions (public API, no key)
  firebase.google.com       — Firebase Authentication
  oauth2.googleapis.com     — GCP OAuth token refresh
  upstash.com               — Redis rate limiting
```

---

## How It Works

### Case Intake Pipeline

When a file is uploaded to `/api/intake/upload`, each intake record is processed through a four-step pipeline (`lib/agent/orchestrator.js`). Steps are traced individually with timing data and stored on the Case document as `agent_trace`.

**Step 1 — `extract_facts`**  
Gemini Flash (Vertex AI) receives the raw intake text and returns a structured JSON object with `client_name`, `case_type` (one of: `eviction`, `immigration`, `wage_theft`, `custody`, `employment`, `other`), `summary`, `deadline_days`, `vulnerability_flags` (`minor_children`, `language_barrier`, `medical_condition`), and `missing_info[]`. The model is prompted with a fixed JSON schema; the response is parsed and validated before use.

**Step 2 — `vector_search`**  
The case summary is embedded using Voyage AI (`voyage-large-2`, 1024 dimensions, truncated to 4,000 characters). The embedding is passed to a MongoDB Atlas `$vectorSearch` aggregation pipeline against the `past_cases` collection, returning up to 3 historically similar cases ranked by cosine similarity. Each result carries the original outcome (`won`, `settled`, or `declined`), outcome notes, and a `similarity_score` between 0 and 1. If `VOYAGE_API_KEY` is not configured, the step fails gracefully and returns zero matches.

**Step 3 — `score_urgency`**  
A pure function (`lib/urgencyScore.js`) computes a score from 0–100 using the results of steps 1 and 2. The algorithm is described in the [Urgency Scoring](#urgency-scoring) section.

**Step 4 — `write_recommendation`** *(conditional: score ≥ 80 only)*  
For high-priority cases, Gemini Pro (Vertex AI) generates a 2–3 sentence attorney recommendation grounding the case facts, the most similar historical outcome, and any vulnerability flags. Cases scoring below 80 do not incur this Gemini call.

After the pipeline, the upload route generates outreach email drafts (Gemini Pro, if `GMAIL_ENABLED=true`), creates Google Calendar events for the top three cases by score (Google Calendar API, if `CALENDAR_ENABLED=true`), and generates case briefs for cases scoring ≥ 80. These three steps are non-blocking and log failures without aborting the batch.

Files are processed in parallel chunks of 20 cases with deduplication: cases whose raw text fingerprint already exists in the user's queue are skipped; cases previously stored with extraction errors are deleted and re-processed.

---

### Docket Preparation Agent

The "Prepare Tomorrow's Docket" workflow is a single synchronous function (`app/api/agent/docket/route.js`) that executes nine steps sequentially, records each step's tool, start time (wall-clock, derived from `run.started_at + step.started_ms`), duration, and structured result, and logs every branching decision to a `decisions[]` array. The complete trace is stored as a single `AgentRun` document in MongoDB Atlas.

**Step 1 — Retrieve active cases**  
`Case.find({ uid })` with a 300-document limit. Tool: MongoDB Atlas.

**Step 2 — Analyze urgency**  
JavaScript filters produce three case sets: `criticalCases` (deadline ≤ 3 days), `urgentCases` (deadline ≤ 7 days), and `highScoreCases` (priority score ≥ 75). No model call. Tool: Reasoning Engine (local computation).

**Step 3 — Detect documentation gaps**  
JavaScript filter over `missing_info.length > 0`. Computes gap rate as a percentage of total cases. Tool: Reasoning Engine.

**Step 4 — Model-driven strategy selection** *(Gemini Flash)*  
Gemini Flash (Vertex AI) receives the live docket profile — case counts, urgency distribution, case type breakdown, and documentation gap rate — and returns a structured strategy selection: one of `emergency`, `standard`, `documentation-focus`, or `monitoring`. The model's output includes `precedent_research: true/false` and `courtlistener_depth: "comprehensive" | "targeted" | "none"`, which directly control Step 6 execution. If the Gemini call fails, a deterministic fallback applies the same logic without a model call (`fallback_used: true` is recorded). The full decision — strategy, reasoning, and `alternatives_considered[]` — is persisted to `AgentRun.model_decision`. Tool: Gemini Flash.

> **Model decision stored:** `strategy`, `escalation_level`, `precedent_research`, `courtlistener_depth`, `reasoning`, `alternatives_considered[]`, `model`, `timestamp_ms`, `fallback_used`. This document determines Step 6 behavior.

**Step 5 — Atlas $vectorSearch**  
For up to 5 cases (critical cases first, then urgent, then high-score), the agent runs `findSimilarCases()` concurrently. Each call generates a Voyage AI embedding for the case summary and executes a `$vectorSearch` aggregation against `description_embedding_index` on `past_cases`. Results include `similarity_score`, `outcome`, `outcome_notes`, and `year`. The `via` field records which execution path was used. Tool: MongoDB Vector Search.

> **Decision logged after Step 5:** The agent records whether matches were found, the top similarity score, observed outcome distribution, and whether historical data will be incorporated into the Gemini Pro recommendation prompt.

**Step 6 — CourtListener API** *(conditional on model decision from Step 4)*  
If the model decision set `precedent_research: true`, the agent queries the CourtListener public search API for relevant legal opinions. The `courtlistener_depth` value from the model decision controls how many case types are searched. If the model set `precedent_research: false`, this step is recorded with `skipped: true` and zero duration — the model's decision is the direct cause of skipping. Tool: CourtListener API.

**Step 7 — Generate recommendations**  
Gemini Pro (Vertex AI) receives: the prioritized case list with summaries, historical matches from Step 5 (verbatim similarity scores and outcome notes), and CourtListener opinions from Step 6. It returns a JSON array of per-case recommendations. The executive report prompt explicitly includes the model's strategy and escalation level from Step 4. Tool: Gemini Pro.

**Step 8 — Compile executive report**  
A second Gemini Pro call produces a three-paragraph executive report. The prompt includes the model decision strategy, all agent decisions, vector search findings, and CourtListener citations. Tool: Gemini Pro.

**Step 9 — Persist trace**  
`AgentRun.findOneAndUpdate()` writes the completed run document including `steps[]`, `decisions[]`, `model_decision`, `adapted_plan[]`, `result.vector_search_results`, `result.recommendations`, `result.court_opinions`, `result.executive_report`, and `result.reasoning_summary`. Tool: MongoDB Atlas.

---

## Urgency Scoring

Scores are computed by `lib/urgencyScore.js`, a pure function with no external calls. The same function is used during intake, demo seeding, and any recomputation.

```
score = min(deadline_points + vulnerability_points + case_type_points + similarity_points, 100)
```

| Component | Max | Formula |
|---|---|---|
| Deadline | 40 | ≤3 days → 40 · ≤7 days → 25 · ≤14 days → 15 · >14 days → 0 |
| Vulnerability | 25 | +15 minor children · +10 medical condition · +10 language barrier · cap 25 |
| Case type | 20 | immigration→20 · eviction→18 · wage_theft→12 · custody→10 · employment→8 · other→5 |
| Precedent | 15 | best similar-case similarity ≥0.85 and outcome=won → 15 · ≥0.70 → 8 · else 0 |

The score breakdown is stored per case and displayed as a bar chart in the Case Detail panel. Each bar's maximum is the actual ceiling for that case type, not the global maximum of 20 — an employment case scoring 8/8 on case type is shown as such, not as 8/20.

---

## MongoDB Atlas Vector Search

### Setup

The `past_cases` collection holds 30 seeded historical legal aid case outcomes (6 practice areas × 5 cases each: eviction, immigration, custody, wage theft, domestic violence, employment). Each document carries a `description_embedding` field — a 1024-dimensional float array produced by Voyage AI's `voyage-large-2` model from the case `description` field.

The required Atlas Search index definition:

```json
{
  "name": "description_embedding_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "description_embedding",
        "numDimensions": 1024,
        "similarity": "cosine"
      }
    ]
  }
}
```

### Query

```js
// lib/vectorSearch.js
const queryVector = await getEmbedding(caseSummaryText)  // Voyage AI

const pipeline = [
  {
    $vectorSearch: {
      index:         'description_embedding_index',
      path:          'description_embedding',
      queryVector,
      numCandidates: 30,   // limit * 10
      limit:         3,
    },
  },
  {
    $project: {
      _id: 0,
      id:               { $toString: '$_id' },
      case_type:        1,
      description:      1,
      outcome:          1,    // 'won' | 'settled' | 'declined'
      outcome_notes:    1,
      year:             1,
      similarity_score: { $meta: 'vectorSearchScore' },
    },
  },
]

// MCP path (MCP_ENABLED=true, local dev only)
const results = await mcpAggregate('past_cases', pipeline)

// Fallback path (production)
const collection = mongoose.connection.db.collection('past_cases')
const results = await collection.aggregate(pipeline).toArray()
```

### How retrieval influences recommendations

During intake, `similarity_points` in the score is non-zero only when at least one matched historical case had outcome `'won'` with similarity ≥ 0.70. During docket preparation, the vector search results are included verbatim in the Gemini Pro prompt:

```
HISTORICAL CASE MATCHES (Atlas $vectorSearch, index: description_embedding_index):
- Maria Santos (eviction): best match WON at 91.0% similarity — Emergency stay granted;
  voucher approved within 30 days
```

This provides the model with directly relevant precedent from the clinic's own history rather than relying on general legal knowledge.

### Example retrieval result

For a case summary of *"Single mother with two children facing eviction in 48 hours. Section 8 voucher pending"*, the `$vectorSearch` pipeline might return:

```json
[
  {
    "case_type": "eviction",
    "outcome": "won",
    "outcome_notes": "Won on procedural grounds — landlord failed to comply with HUD notice requirements. Tenant retained housing.",
    "year": 2024,
    "similarity_score": 0.912
  },
  {
    "case_type": "eviction",
    "outcome": "won",
    "outcome_notes": "Won under state domestic violence tenant protection statutes. Lease terminated without penalty.",
    "year": 2023,
    "similarity_score": 0.874
  }
]
```

The 91.2% top similarity score (≥ 0.85) contributes 15 points to the urgency score. Both results are passed to Gemini Pro during the recommendation step.

---

## Agent Execution Model

JusticeQueue implements a workflow-driven pipeline, not an autonomous reasoning loop. The agent does not decide which tools to call based on model output — the sequence of steps is fixed, with two conditional branches determined by computed data, not LLM output.

**What "agent" means here:**

- The execution sequence is predetermined
- Each step records its tool, start time (ms from run start), duration, and a structured result object
- Two branching decisions are evaluated after Step 3 and after Step 4, logged with the evidence that drove the decision
- Every run is persisted as an `AgentRun` document; step timing can be replayed as a wall-clock trace

**What it does not do:**

- The model does not select which tool to invoke next
- There is no planning loop or re-planning based on intermediate results
- Google Cloud Agent Builder does not drive runtime behaviour (`AGENT_BUILDER_ENGINE_ID`, if set, is stored as trace metadata only)
- There is no multi-agent coordination

**Execution trace format:**

```json
{
  "steps": [
    {
      "id": "vector_search",
      "label": "Run Atlas $vectorSearch against historical case database",
      "tool": "MongoDB Vector Search",
      "status": "complete",
      "started_ms": 446,
      "duration_ms": 1842,
      "result": {
        "searches_attempted": 5,
        "similar_cases_found": 14,
        "cases_with_matches": 5,
        "top_similarity_score": 0.892,
        "index": "description_embedding_index",
        "via": "mongoose_fallback"
      }
    }
  ],
  "decisions": [
    {
      "decision": "Retrieve legal precedents from CourtListener API",
      "reason": "71 cases detected within the 7-day urgency window",
      "evidence": { "urgent_cases": 71, "critical_cases": 38, "threshold_days": 7 },
      "outcome": "CourtListener query will execute in Step 5",
      "timestamp_ms": 512
    }
  ]
}
```

The Agent Activity page renders this trace as a table with wall-clock timestamps, tool badges, step durations, and expandable evidence rows. Each step row expands to show the raw result object.

---

## Human Oversight

All recommendations are advisory. No legal filing, court communication, or client contact is initiated automatically.

Recommendations with `priority: "critical"` are displayed in a separate "Requires Human Review" panel. Each item shows:

- The client name and case type
- The recommended action
- The deadline warning
- A checkbox indicating attorney authorization is required before proceeding

The panel is rendered after the recommendation list and before the legal precedents section. The verification checklist at the bottom of each run record includes a count of how many critical decisions were flagged, allowing a supervising attorney to confirm which matters have been reviewed.

Audit trail: every agent run is stored with its full step trace, decision log, vector search results, and AI-generated recommendations. Runs are queryable by `uid` and `run_id`.

---

## Executive Brief Generation

The "Export Brief" button on the Agent Activity page opens `/agent/brief?run=<run_id>` in a new tab. The brief is rendered as a printable document and calls `window.print()` to produce a PDF.

The brief includes:

- **Letterhead**: run ID, date generated, date the docket applies to
- **Operational summary strip**: cases reviewed, critical matters, recommendation count, agent runtime
- **Executive Summary**: the three-paragraph report generated by Gemini Pro in Step 7 of the docket workflow
- **Required Actions**: per-case recommendations sorted by priority (critical → high → medium), including the action, rationale, and deadline warning for each
- **Documentation Gaps**: amber callout if any cases have incomplete files
- **Historical Case Matches**: cases matched via Atlas `$vectorSearch`, with similarity scores and outcome notes from the `past_cases` collection
- **Retrieved Legal Precedents**: CourtListener opinions with case name, court, date, and snippet
- **Footer**: AI disclosure and run ID for audit traceability

The brief page has print CSS that hides the sidebar and navigation bar so the printed output is clean. The content is fetched from `/api/agent/runs/:runId` — the same endpoint that populates the Agent Activity detail view.

---

## Demo Data

JusticeQueue ships with three layers of demo data, each serving a different purpose.

### Five-case public demo (`/api/demo/queue`)

The `GET /api/demo/queue` endpoint returns five hardcoded case objects, no authentication required. These cases are used when the dashboard is loaded with `?demo=true`. The scores, breakdowns, and `agent_trace` in these objects are computed against the real `computeScore()` formula and reflect only the steps that `lib/agent/orchestrator.js` actually produces. This endpoint is for first-time visitors; it is not connected to MongoDB.

### Fifty-case seeded dataset (`/api/demo/seed`)

Authenticated users can seed their queue with 50 curated cases via `POST /api/demo/seed`. These cover five priority levels (critical, urgent, documentation-gap, medium, lower) across six practice areas. Scores and breakdowns are computed by `computeScore()` at seed time — they are not hardcoded. `similar_cases` are set in the canonical format (`outcome` enum, `outcome_notes`, `similarity_score`) so that the Similar Cases panel in the Case Detail view renders correctly.

### Thirty historical cases for vector search (`/api/seed/past-cases`)

`POST /api/seed/past-cases` (requires `x-seed-confirm: yes` header) inserts 30 historical case outcomes with Voyage AI embeddings into the `past_cases` collection, in batches of 5 to avoid rate limits. These are the documents queried by Atlas `$vectorSearch` during both intake and docket preparation. Each document carries a `description_embedding` field generated from the case `description` text — the same field and the same embedding model used for query vectors.

### Judge Mode (`/judge`)

The `/judge` page is a static showcase. It displays representative static data — mock execution steps, decisions, and recommendations — without connecting to any database or API. It exists so that reviewers can inspect the execution trace format and decision log structure without logging in. Numerical values in the mock data are consistent with what the real system would produce for the same inputs, per the scoring formula.

**What is synthetic:** all demo case data, historical past_cases documents, Judge Mode content.  
**What is real:** the intake pipeline against real uploaded files, the Atlas `$vectorSearch` queries (if configured), CourtListener API responses, and Gemini-generated recommendations.

---

## Technical Design Decisions

### Why MongoDB Atlas for the primary store

Case documents have a variable shape. A custody case with `similar_cases`, a full `agent_trace`, an outreach email, a calendar event ID, and a brief excerpt is a different structure from a lower-priority case that received only extraction and scoring. MongoDB's document model stores all of this naturally without joins. The `AgentRun` schema stores a variable-length `steps[]` array, a `decisions[]` array with typed evidence objects, and a `result` sub-document — shapes that would require multiple relational tables and reassembly.

### Why MongoDB Atlas Vector Search

Vector search and the case document store are in the same cluster. The `$vectorSearch` aggregation runs inside a standard MongoDB aggregation pipeline, so results can be post-filtered, projected, or joined with other stages in the same operation. Running vector search as a managed service inside Atlas removes a separate vector database from the operational stack.

### Why Voyage AI for embeddings

Atlas `$vectorSearch` requires pre-computed embeddings stored on the document. Voyage AI's `voyage-large-2` model produces 1024-dimensional embeddings optimized for semantic similarity in domain-specific text. The model is called at document insert time (intake pipeline and seeding) and at query time (during `findSimilarCases()`). Using the same model for both operations ensures query vectors and stored vectors occupy the same embedding space.

### Why Vertex AI for Gemini inference

The Gemini API on Vertex AI uses a GCP OAuth 2.0 Bearer token obtained via a refresh token, which is compatible with organizational GCP policies that block API key usage. The endpoint (`aiplatform.googleapis.com`) is the standard Vertex AI inference path. Model selection is fully configurable via environment variables (`GEMINI_MODEL_PRO`, `GEMINI_MODEL_FLASH`) — the code does not hardcode a model version.

### Why deterministic scoring, not a model-based ranker

A scoring formula is auditable. When an attorney asks why a case is ranked third rather than first, the answer is a breakdown of four numbers with named components. A model-based ranker would produce an unexplainable score. The formula also means that re-seeding the demo dataset produces the same scores every time, regardless of model state or API availability.

### Why human review checkpoints

Legal aid work involves decisions with irreversible consequences. JusticeQueue produces recommendations; it does not execute them. The human oversight panel is not a UX afterthought — it reflects the constraint that no emergency court filing, attorney-client communication, or case status change should be initiated without attorney authorization.

---

## Deployment

### Prerequisites

- **MongoDB Atlas** cluster (M0 free tier works for development; `$vectorSearch` requires M10+ for the managed index; the `listSearchIndexes` command in the seed script requires Atlas, not Community)
- **Google Cloud project** with Vertex AI API enabled and a configured OAuth 2.0 Web Application credential
- **Voyage AI account** — free tier is sufficient for development
- **Firebase project** with Google OAuth and email/password sign-in enabled
- **Upstash Redis** database — free tier is sufficient

### Environment variables

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/justicequeue

# Firebase (safe to expose — Firebase restricts by domain)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Google Cloud / Vertex AI
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=   # generate at OAuth Playground, scope: cloud-platform
GEMINI_MODEL_FLASH=           # model ID available in your GCP project
GEMINI_MODEL_PRO=             # model ID available in your GCP project

# Voyage AI
VOYAGE_API_KEY=               # https://voyageai.com → API Keys

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional integrations (set to 'true' to enable)
GMAIL_ENABLED=false
CALENDAR_ENABLED=false

# MongoDB MCP Server (local dev only — spawn conflicts with Vercel serverless)
MCP_ENABLED=false
```

### Atlas Vector Search index

Create the index via Atlas UI (Data Services → your cluster → Atlas Search → Create Search Index → JSON editor) or via the seed script:

```json
{
  "name": "description_embedding_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "description_embedding",
        "numDimensions": 1024,
        "similarity": "cosine"
      }
    ]
  }
}
```

The `seed/seedPastCases.js` script attempts to create this index via `collection.createSearchIndex()` (requires Atlas M10+) and logs a warning if it cannot.

### Seeding historical cases

The seed endpoint generates Voyage AI embeddings at request time. Ensure `VOYAGE_API_KEY` is set before seeding:

```bash
# Via the API route (authenticated)
curl -X POST https://your-deployment.vercel.app/api/seed/past-cases \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "x-seed-confirm: yes"

# Response
{
  "seeded": 30,
  "with_embeddings": 30,
  "without_embeddings": 0,
  "message": "30 historical cases seeded with Voyage AI embeddings. Atlas $vectorSearch is ready."
}
```

Alternatively, use the standalone script (requires `.env` file with `MONGODB_URI` and `VOYAGE_API_KEY`):

```bash
npm run seed
```

The script reads `seed/data/past_cases.json`, generates embeddings using Voyage AI, inserts documents into `past_cases`, and attempts to create the vector search index.

### Local development

```bash
git clone https://github.com/Dhruva-Aher/JusticeQueue
cd JusticeQueue
npm install
cp .env.example .env.local
# Fill in all required values
npm run dev
# http://localhost:3000
```

### Vercel deployment

1. Import the repository at vercel.com/new
2. Set all environment variables in the Vercel dashboard
3. Deploy — Next.js is auto-detected
4. The docket preparation function has `maxDuration = 120` seconds (requires Vercel Pro; Hobby plan is capped at 60 seconds)

---

## Known Limitations

**Workflow-driven, not LLM-orchestrated.** The agent does not use the language model to decide which tools to call or in what order. The step sequence is fixed code. The model is called in two places: fact extraction during intake, and recommendation/report generation during docket preparation. This is deliberate (see design decisions above) but should not be described as autonomous planning.

**MCP disabled in production.** The MongoDB MCP Server integration (`lib/mcpClient.js`) is wired but not usable in Vercel serverless functions: spawning a stdio subprocess per request is incompatible with the serverless execution model. In production, vector search always runs via direct Mongoose aggregation (`via: "mongoose_fallback"`). MCP functions correctly in local development when `MCP_ENABLED=true`.

**Synthetic historical dataset.** The 30 cases in `past_cases` are curated examples, not real clinic records. Vector search results during demo or development reflect similarity to these synthetic cases, not an actual clinic's case history. In production, a clinic would replace or augment this dataset with their own historical outcomes.

**No outcome feedback loop.** When a case is resolved (won, settled, or dismissed), the outcome is not automatically written back to `past_cases` to improve future similarity matching. Adding resolved cases to the vector search corpus requires a manual or scheduled process.

**CourtListener results are keyword-matched.** The CourtListener integration queries the public search API using case type as the domain (e.g., `"tenant eviction unlawful detainer emergency housing relief"`). Results are not verified for jurisdictional relevance. Attorneys should verify that retrieved opinions apply to their jurisdiction before citing them.

**Scoring is a heuristic, not a trained model.** The four-dimension urgency score reflects domain knowledge encoded by the developers: immigration cases score higher than employment cases because immigration deadlines tend to be less negotiable, not because of training data. Different clinics with different case mixes may find the weights require adjustment.

**No real-time updates.** The case queue does not subscribe to changes. After a docket run or a seed operation, the user must navigate back to the dashboard or reload to see updated counts.

**Email and calendar are optional.** Gmail draft creation and Google Calendar event creation require separate OAuth scopes and are gated by `GMAIL_ENABLED` and `CALENDAR_ENABLED` environment variables. They are disabled by default.

---

## Future Work

These are concrete gaps in the current implementation, ordered by likely impact.

- **Outcome feedback.** A route that moves a resolved case into `past_cases` with its actual outcome and re-generates its embedding. This closes the loop between historical retrieval and real clinic data.

- **Per-clinic case type weights.** A clinic configuration object that overrides `CASE_TYPE_POINTS` in the scoring formula. A domestic violence clinic and a wage theft clinic have different prioritization needs.

- **Streaming docket preparation.** The docket agent currently runs synchronously and returns when complete. Streaming each step's result as a server-sent event would remove the need for the loading overlay and let the execution trace render as the agent runs.

- **MCP in production via a persistent sidecar.** The MCP Server works in local development. Running it as a sidecar container alongside the Next.js app (rather than spawning per request) would make the MCP path viable in production.

- **Jurisdictional filtering for CourtListener.** Adding a `jurisdiction` field to the clinic's profile and filtering CourtListener queries by court would reduce irrelevant opinion retrieval.

- **Batch PDF processing.** The current PDF parser extracts all text and splits on blank lines. A multi-page PDF with structured intake forms would benefit from section-aware extraction.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/intake/upload` | ✅ | Accept CSV/TXT/PDF; run intake pipeline; return scored queue |
| `GET` | `/api/cases/queue` | ✅ | Sorted active cases for authenticated user |
| `GET` | `/api/cases/:id` | ✅ | Single case document with agent_trace |
| `PATCH` | `/api/cases/:id` | ✅ | Update status |
| `POST` | `/api/cases/:id/override` | ✅ | Manual score override (written to StaffAction collection) |
| `DELETE` | `/api/cases/clear` | ✅ | Delete all cases for user |
| `POST` | `/api/agent/docket` | ✅ | Run 9-step docket preparation workflow (includes Gemini Flash model decision) |
| `GET` | `/api/agent/runs` | ✅ | List agent runs for user (summary only) |
| `GET` | `/api/agent/runs/:id` | ✅ | Full AgentRun document |
| `POST` | `/api/demo/seed` | ✅ | Seed 50 curated demo cases (scores computed by formula) |
| `GET` | `/api/demo/queue` | ❌ | 5 hardcoded demo cases, no auth |
| `POST` | `/api/seed/past-cases` | ✅ | Seed 30 historical cases with Voyage AI embeddings |
| `GET` | `/api/health` | ❌ | Liveness check |

---

## Accepted file formats

- CSV (any delimiter, one case per row or one case per blank-line-separated block)
- TXT (blank-line separated intake records)
- PDF (text extracted; blank-line separated records expected)
- Maximum file size: 10 MB

---

## Repository

**Source:** https://github.com/Dhruva-Aher/JusticeQueue  
**License:** MIT  
**Built for:** Google Cloud Rapid Agent Hackathon 2026 — MongoDB track
