# JusticeQueue — Contributor Onboarding

Welcome to JusticeQueue. This doc covers everything you need to get the project running locally, understand its architecture, and start contributing.

---

## What This Project Does

Legal aid clinics receive more intake requests than they can handle. A caseworker manually reading every submission means a family with a 72-hour eviction notice gets the same priority as someone with a 6-month timeline.

JusticeQueue solves this. You upload a batch of intake submissions (CSV, TXT, or PDF). The agent reads every submission, extracts key facts using Gemini, searches the clinic's past case history using MongoDB Atlas Vector Search, scores each case 0–100 using a four-dimension algorithm, and returns a ranked action list with full explanations — in under 30 seconds.

- **Live site:** https://justicequeuelive.vercel.app
- **Demo (no login):** https://justicequeuelive.vercel.app/dashboard?demo=true
- **GitHub:** https://github.com/Dhruva-Aher/JusticeQueue
- **Hackathon:** Google Cloud Rapid Agent Hackathon 2026 — MongoDB track
- **Devpost deadline:** Jun 11, 2026 @ 2pm MST

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Engine | Vertex AI (Gemini Flash + Pro) |
| LLM — extraction | Gemini Flash (Vertex AI) |
| LLM — recommendations (docket) | Gemini Flash (Vertex AI) |
| Database | MongoDB Atlas (document store) |
| Vector search | MongoDB Atlas $vectorSearch |
| DB integration | MongoDB MCP Server (`@mongodb-js/mongodb-mcp-server`) |
| Embeddings | Vertex AI `text-embedding-004` (768-dim, cosine similarity) |
| Auth | Firebase Authentication (Google OAuth + email/password) |
| Rate limiting | Upstash Redis (10 uploads / 15 min per user) |
| Frontend | Next.js 14 App Router |
| Hosting | Vercel (serverless, 60s function timeout) |

---

## Project History (What Has Been Built)

The project was built in phases during the hackathon:

1. **Core pipeline** — file parser → Gemini extraction → vector search → urgency scoring → MongoDB insert → ranked queue UI
2. **Security hardening** — all internal error messages scrubbed from API responses; Firebase config moved from hardcoded values to `NEXT_PUBLIC_FIREBASE_*` env vars; comprehensive `.gitignore`; dead test route deleted
3. **Demo mode** — `/dashboard?demo=true` works without any login using 5 hardcoded cases with realistic similar-case data
4. **MCP integration** — MongoDB MCP Server wired as the agent's tool layer for vector search; every case records `mongodb_via: "mcp"` or `"mongoose_fallback"` so you can see which path ran
5. **Deduplication** — uploads skip already-processed cases, delete and retry previously-failed ones, only process genuinely new submissions
6. **Override system** — staff can manually adjust any case's rank; every override is logged to `StaffAction` collection for audit trail

---

## Repository Structure

```
JusticeQueue/
├── app/
│   ├── (public)/page.jsx          ← Landing page
│   ├── (protected)/
│   │   └── dashboard/page.jsx     ← Main dashboard (auth required)
│   ├── login/page.jsx
│   ├── register/page.jsx
│   └── api/
│       ├── intake/upload/route.js ← Main upload endpoint (POST)
│       ├── cases/
│       │   ├── queue/route.js     ← GET sorted queue
│       │   ├── [id]/route.js      ← GET/PATCH single case
│       │   ├── [id]/override/     ← POST manual rank override
│       │   ├── history/route.js   ← GET override audit log
│       │   └── clear/route.js     ← DELETE all cases
│       ├── demo/queue/route.js    ← GET hardcoded demo cases (no auth)
│       ├── auth/me/route.js       ← GET upsert user on first login
│       └── health/route.js        ← GET liveness check
│
├── components/
│   ├── CaseTable.jsx              ← Ranked case list
│   ├── CaseDetailPanel.jsx        ← Slide-out panel with full case details
│   ├── UploadZone.jsx             ← Drag-and-drop / file picker
│   ├── Navbar.jsx
│   └── SimilarCases.jsx           ← Similar past cases section in detail panel
│
├── lib/
│   ├── agent/
│   │   └── orchestrator.js        ← 4-step agent pipeline with per-step tracing
│   ├── models/
│   │   ├── Case.js                ← Current intake cases
│   │   ├── PastCase.js            ← Historical cases for vector search
│   │   ├── StaffAction.js         ← Override audit log
│   │   └── User.js                ← User profiles
│   ├── gemini.js                  ← extractCaseFacts() + writeRecommendation()
│   ├── vectorSearch.js            ← findSimilarCases() via MCP or Mongoose
│   ├── mcpClient.js               ← Spawns MongoDB MCP Server as stdio subprocess
│   ├── urgencyScore.js            ← computeScore() — pure deterministic scoring
│   ├── parser.js                  ← parseFile() — CSV/TXT/PDF → string[]
│   ├── mongodb.js                 ← connectDB() with connection caching
│   ├── verifyToken.js             ← Firebase JWT verification (no Admin SDK)
│   ├── ratelimit.js               ← Upstash Redis rate limiter
│   ├── apiError.js                ← Standardised JSON error response helper
│   └── firebase.js                ← Firebase client initialisation
│
├── hooks/
│   ├── useCases.js                ← Fetches queue from /api/cases/queue
│   └── useUpload.js               ← Manages upload state machine
│
├── context/AuthContext.jsx        ← Firebase auth state provider
├── scripts/seed.js                ← Seeds 30 past cases + creates vector index
├── .mcp.json                      ← MongoDB MCP Server config
├── .env.example                   ← All required env vars with comments
└── vercel.json                    ← maxDuration: 60
```

---

## Agent Pipeline (How Intake Processing Works)

Every uploaded case goes through `lib/agent/orchestrator.js` in 4 steps:

```
rawText (one intake record)
    │
    ├─ Step 1: extractCaseFacts()      [Gemini Flash (Vertex AI)]
    │   → client_name, case_type, summary, deadline_days,
    │     vulnerability_flags, missing_info[]
    │
    ├─ Step 2: findSimilarCases()      [MongoDB MCP Server → Atlas $vectorSearch]
    │   → embeds summary with Vertex AI text-embedding-004 (768-dim)
    │   → runs $vectorSearch on past_cases collection
    │   → falls back to direct Mongoose if MCP server fails
    │   → records mongodb_via: "mcp" or "mongoose_fallback"
    │
    ├─ Step 3: computeScore()          [pure JS, no AI]
    │   → deadline:      0–40 pts
    │   → vulnerability: 0–25 pts
    │   → case type:     0–20 pts
    │   → similarity:    0–15 pts
    │   → total:         0–100
    │
    └─ Step 4: writeRecommendation()   [Gemini Flash — only if score ≥ 80]
        → 2-sentence attorney action recommendation
```

Each step is timed and logged into `agent_trace` on the case document, visible in the Case Detail panel.

---

## Urgency Scoring Formula

| Component | Max | Logic |
|---|---|---|
| Deadline | 40 | ≤3 days: 40 · ≤7 days: 25 · ≤14 days: 15 · >14 days: 0 |
| Vulnerability | 25 | minor children: +15 · language barrier: +10 · medical: +10 (capped 25) |
| Case type | 20 | immigration: 20 · eviction: 18 · wage_theft: 12 · custody: 10 · employment: 8 |
| Precedent | 15 | similar won case ≥0.85 similarity: 15 · ≥0.70: 8 · else: 0 |

Score ≥ 80 → **Critical** (red) · Score ≥ 50 → **Elevated** (amber) · Score < 50 → **Standard** (green)

---

## API Endpoints

All authenticated endpoints require `Authorization: Bearer <firebase-id-token>` header.

### `POST /api/intake/upload`
**Auth:** Required  
**Body:** `multipart/form-data` with a `file` field (CSV, TXT, or PDF, max 10 MB)

Runs the full agent pipeline on every record in the file. Uses smart deduplication — skips already-processed cases, retries previously-failed ones.

**Response:**
```json
{
  "batch_id": "uuid",
  "cases": [
    {
      "id": "mongo_object_id",
      "rank": 1,
      "batch_id": "uuid",
      "client_name": "Maria Santos",
      "case_type": "eviction",
      "summary": "Single mother facing eviction in 3 days...",
      "deadline_days": 3,
      "vulnerability_flags": { "minor_children": true, "language_barrier": false, "medical_condition": false },
      "priority_score": 88,
      "score_breakdown": { "deadline_points": 40, "vulnerability_points": 15, "case_type_points": 18, "similarity_points": 15 },
      "priority_reason": "Urgency driven by deadline and vulnerability.",
      "status": "pending",
      "createdAt": "2026-05-29T..."
    }
  ],
  "stats": { "total": 5, "processed": 4, "failed": 0, "skipped": 1 }
}
```

---

### `GET /api/cases/queue`
**Auth:** Required  
Returns all cases for the authenticated user, sorted by `priority_score` descending.

**Response:**
```json
{ "cases": [ /* same shape as upload response */ ] }
```

---

### `GET /api/cases/:id`
**Auth:** Required  
Returns full case document including `agent_trace`, `similar_cases`, `recommendation`, `mongodb_via`, `mcp_config`.

**Response:**
```json
{
  "case": {
    "id": "...",
    "client_name": "...",
    "agent_trace": [
      { "name": "extract_facts", "durationMs": 1200, "output": { "case_type": "eviction", ... } },
      { "name": "vector_search", "durationMs": 800, "output": { "results_found": 3, "mongodb_via": "mcp" } },
      { "name": "score_urgency", "durationMs": 1, "output": { "score": 88 } }
    ],
    "similar_cases": [
      { "description": "...", "outcome": "won", "similarity_score": 0.94 }
    ],
    "recommendation": "...",
    "mongodb_via": "mcp",
    "mcp_config": { "server": "@mongodb-js/mongodb-mcp-server", "config_file": ".mcp.json" }
  }
}
```

---

### `PATCH /api/cases/:id`
**Auth:** Required  
Update case status.

**Body:**
```json
{ "status": "reviewed" }
```
Valid values: `"pending"`, `"reviewed"`, `"closed"`

---

### `POST /api/cases/:id/override`
**Auth:** Required  
Manually override a case's priority score. Logged to `StaffAction` collection.

**Body:**
```json
{ "new_score": 95, "reason": "Spoke with client — situation more urgent than intake indicated" }
```

---

### `GET /api/cases/history`
**Auth:** Required  
Returns the override audit log for the authenticated user.

---

### `DELETE /api/cases/clear`
**Auth:** Required  
Deletes all cases for the authenticated user. Irreversible.

---

### `GET /api/demo/queue`
**Auth:** Not required  
Returns 5 hardcoded demo cases with realistic similar-case data. Used by `/dashboard?demo=true`.

---

### `GET /api/auth/me`
**Auth:** Required  
Upserts a user profile document on first login. Call this once after the user authenticates.

---

### `GET /api/health`
**Auth:** Not required  
Returns `{ "ok": true }` — used by Vercel health checks.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value.

### MongoDB Atlas — `MONGODB_URI`
```
mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/justicequeue
```
Where to get it: MongoDB Atlas → your cluster → Connect → Drivers → copy the connection string.

Required collections: `cases`, `past_cases`, `staffactions`, `users`  
Required index: Atlas Search vector index on `past_cases.description_embedding` (see seed script).

---

### Firebase — 7 `NEXT_PUBLIC_FIREBASE_*` vars
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```
Where to get them: Firebase Console → Project Settings → Your apps → Web app → SDK setup → Config object. Copy each field.

> Note: `NEXT_PUBLIC_` prefix is intentional — Firebase client config is meant to be browser-visible. Firebase restricts usage by authorised domain.

Also enable in Firebase Console:
- Authentication → Sign-in method → Google (enable)
- Authentication → Sign-in method → Email/Password (enable)
- Add `localhost` and `justicequeuelive.vercel.app` to authorised domains

---

### Google Cloud / Vertex AI (Gemini) — 4 vars
```
GOOGLE_CLOUD_PROJECT_ID=       # your GCP project ID
GOOGLE_OAUTH_CLIENT_ID=        # from GCP Console → APIs → Credentials
GOOGLE_OAUTH_CLIENT_SECRET=    # same credential
GOOGLE_OAUTH_REFRESH_TOKEN=    # generate via OAuth Playground (see below)

GEMINI_MODEL_FLASH=gemini-3.1-flash-lite
GEMINI_MODEL_PRO=gemini-3.1-pro-preview-05-06
```

**How to get the refresh token:**
1. GCP Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application type)
2. Go to https://developers.google.com/oauthplayground
3. Settings (gear icon) → Use your own OAuth credentials → paste client ID and secret
4. Scope: `https://www.googleapis.com/auth/cloud-platform`
5. Authorize → Exchange code for tokens → copy the `refresh_token`

Also enable in GCP: Vertex AI API, Cloud AI Platform API.

---

### Agent trace attribution (optional)
```
AGENT_BUILDER_ENGINE_ID=
```
Optional engine ID stored in agent traces for attribution. The pipeline runs on Vertex AI regardless of whether this is set.

---

### Vertex AI text-embedding-004 (no separate API key needed)
```
# VOYAGE_API_KEY removed — Vertex AI text-embedding-004 handles embeddings
```
Embeddings now use Vertex AI text-embedding-004 via the same GCP OAuth credentials as Gemini.
Free tier has enough quota for testing. Without this, vector search falls back to Mongoose with no embeddings, and similar cases will be empty.

---

### Upstash Redis — 2 vars
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
Where to get them: https://console.upstash.com → Create Database → REST API tab.  
Free tier is sufficient. Without these, rate limiting fails open (uploads always allowed).

---

## Local Setup

```bash
git clone https://github.com/Dhruva-Aher/JusticeQueue
cd JusticeQueue
npm install
cp .env.example .env.local
# Fill in all values in .env.local
npm run seed        # seeds 30 past cases into MongoDB + creates Atlas vector index
npm run dev         # http://localhost:3000
```

The seed script (`scripts/seed.js`) must be run at least once before vector search works. It:
- Inserts 30 realistic past cases into the `past_cases` collection
- Embeds each case description with Vertex AI text-embedding-004 (768-dim)
- Creates the Atlas $vectorSearch index on `past_cases.description_embedding`

---

## MongoDB MCP Server

The project uses the official MongoDB MCP Server as the agent's database tool layer.

**Config file (`.mcp.json` at repo root):**
```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@mongodb-js/mongodb-mcp-server"],
      "env": { "MDB_MCP_CONNECTION_STRING": "${MONGODB_URI}" }
    }
  }
}
```

`lib/mcpClient.js` spawns the MCP server as a stdio subprocess using `@modelcontextprotocol/sdk`. If the MCP server cold-starts too slowly on Vercel (>5s), the system automatically falls back to direct Mongoose for that request. Every inserted case records `mongodb_via: "mcp"` or `"mongoose_fallback"` — visible in the Case Detail panel's agent trace.

---

## Deduplication Logic (Upload Route)

The upload route (`/api/intake/upload`) is idempotent — uploading the same file twice won't create duplicates.

Fingerprint = first 300 characters of trimmed raw text.

| Situation | Action |
|---|---|
| Same fingerprint, score > 5 (already processed) | Skip — keep existing case |
| Same fingerprint, score ≤ 5 or summary = "Unable to extract case details." | Delete + retry |
| No matching fingerprint | Process + insert |

---

## Key Gotchas

1. **Vercel 60s timeout** — The agent pipeline processes cases in chunks of 20. Batches > 20 records work but may be slow. The recommendation step only runs for cases scoring ≥ 80 to save time.

2. **MCP cold start** — On Vercel serverless, the MCP server subprocess may time out on the first request of a cold function. The fallback to Mongoose is automatic and silent.

3. **Vector index** — Atlas $vectorSearch requires a specific index to exist. Run `npm run seed` once, or create the index manually in Atlas: collection `past_cases`, field `description_embedding`, dimensions `768`, similarity `cosine`.

4. **Firebase JWT verification** — The app verifies Firebase tokens without the Admin SDK. It fetches Google's public keys from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com` and verifies the JWT signature manually. The project ID used for audience check comes from `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

5. **`NEXT_PUBLIC_` vars on Vercel** — These must be set in Vercel's environment variables dashboard before deploying. They are baked into the browser bundle at build time — adding them after a deploy requires a re-deploy.

---

## Contributing

The codebase is intentionally small and linear. The most useful places to contribute:

- **`lib/urgencyScore.js`** — tune scoring weights (pure function, easy to test)
- **`lib/gemini.js`** — improve extraction prompt or add new fields
- **`app/api/demo/queue/route.js`** — add more demo cases / improve demo realism
- **`components/CaseDetailPanel.jsx`** — UI improvements to the detail view
- **`scripts/seed.js`** — add more seed cases for richer vector search results

Before opening a PR: `npm run lint` and `npm run build` must pass cleanly.
