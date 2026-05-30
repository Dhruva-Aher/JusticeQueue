# JusticeQueue — Complete Agent Context File

This file is the single source of truth for any AI agent picking up this project.
Read this entire file before touching anything. Do not skim.

---

## Project Identity

| Field | Value |
|---|---|
| Project name | JusticeQueue |
| Live site | https://justicequeuelive.vercel.app |
| Demo (no login) | https://justicequeuelive.vercel.app/dashboard?demo=true |
| GitHub repo | https://github.com/Dhruva-Aher/JusticeQueue |
| Hackathon | Google Cloud Rapid Agent Hackathon 2026 — MongoDB track |
| Devpost deadline | Jun 11, 2026 @ 2pm MST |
| Framework | Next.js 14 App Router, deployed on Vercel |
| Node version | 18+ |

---

## What This Project Does (One Paragraph)

Legal aid clinics receive more intake cases than they can handle. JusticeQueue is an agent that reads every intake submission, extracts structured facts using Gemini 3.1 Flash Lite, searches the clinic's historical case database for similar past outcomes using MongoDB Atlas Vector Search (via MongoDB MCP Server), scores each case 0–100 using a four-dimension urgency algorithm, drafts a personalised outreach email to every client, creates Google Calendar blocks for the top 3 cases, and generates a printable 1-page case brief for every high-priority case — all in under 30 seconds. The caseworker reviews and approves. The agent does the work.

---

## Tech Stack (Every Layer)

| Layer | Technology | Notes |
|---|---|---|
| Agent engine | Google Cloud Agent Builder | Pipeline orchestration |
| LLM — extraction | Gemini 3.1 Flash Lite | Via Vertex AI + OAuth 2.0 |
| LLM — recommendations, email, brief | Gemini 3.1 Pro Preview | Same auth path |
| Database | MongoDB Atlas | Document store, flexible schema |
| Vector search | MongoDB Atlas $vectorSearch | On `past_cases.description_embedding` |
| DB tool layer | MongoDB MCP Server | `@mongodb-js/mongodb-mcp-server` via stdio |
| Embeddings | Voyage AI `voyage-large-2` | 1024-dim, cosine similarity |
| Auth | Firebase Authentication | Google OAuth + email/password |
| Token verification | Custom X.509 verify | No Firebase Admin SDK |
| Rate limiting | Upstash Redis | 10 uploads / 15 min per user |
| Email | Gmail API | OAuth 2.0 bearer, requires gmail.compose scope |
| Calendar | Google Calendar API | OAuth 2.0 bearer, requires calendar.events scope |
| Frontend | Next.js 14 App Router | `(public)` + `(protected)` route groups |
| Hosting | Vercel | Serverless, maxDuration = 60s |

---

## Repository Structure (Every File, Every Purpose)

```
JusticeQueue/
│
├── app/
│   ├── layout.jsx                          ← root layout, CSS vars, fonts
│   ├── globals.css                         ← design tokens (--text, --border, --urgent, etc.)
│   │
│   ├── (public)/
│   │   ├── page.jsx                        ← landing page (DO NOT TOUCH — working)
│   │   ├── login/page.jsx                  ← Firebase login (DO NOT TOUCH)
│   │   └── register/page.jsx               ← Firebase register (DO NOT TOUCH)
│   │
│   ├── (protected)/
│   │   └── dashboard/page.jsx              ← main dashboard: upload + queue + panels
│   │
│   └── api/
│       ├── health/route.js                 ← GET → { ok: true }
│       ├── auth/
│       │   ├── me/route.js                 ← GET → upsert user on first login
│       │   └── register/route.js           ← POST → create user record
│       ├── intake/
│       │   └── upload/route.js             ← POST → full 9-step agent pipeline
│       ├── cases/
│       │   ├── queue/route.js              ← GET → sorted queue for user
│       │   ├── clear/route.js              ← DELETE → remove all user cases
│       │   ├── history/route.js            ← GET → staff override audit log
│       │   └── [id]/
│       │       ├── route.js                ← GET case / PATCH status
│       │       ├── override/route.js       ← POST manual rank override
│       │       ├── email/route.js          ← GET draft / POST save / PATCH send
│       │       ├── calendar/route.js       ← DELETE cancel / POST reschedule
│       │       └── brief/route.js          ← GET printable HTML brief
│       └── demo/
│           └── queue/route.js              ← GET 5 hardcoded demo cases, no auth
│
├── components/
│   ├── Navbar.jsx                          ← top nav with case count
│   ├── UploadZone.jsx                      ← drag-drop file picker
│   ├── CaseTable.jsx                       ← ranked case list (DO NOT TOUCH)
│   ├── CaseDetailPanel.jsx                 ← slide-out panel: all case details + actions
│   ├── AgentSummaryStrip.jsx               ← post-upload strip: what agent did
│   ├── SimilarCases.jsx                    ← similar past cases section
│   ├── StatusBadge.jsx                     ← coloured label chip
│   └── UrgencyBreakdown.jsx                ← score breakdown bar chart
│
├── hooks/
│   ├── useUpload.js                        ← upload state machine, returns agentStats
│   └── useCases.js                         ← fetches /api/cases/queue
│
├── context/
│   └── AuthContext.jsx                     ← Firebase auth state provider
│
├── lib/
│   ├── gemini.js                           ← Gemini via OAuth: getAccessToken (exported),
│   │                                          callGeminiPro (exported), extractCaseFacts,
│   │                                          writeRecommendation
│   ├── gmail.js                            ← createGmailDraft, sendGmailDraft
│   ├── calendar.js                         ← createCalendarEvent, deleteCalendarEvent
│   ├── caseBrief.js                        ← generateBriefContent, buildBriefHTML
│   ├── draftEmail.js                       ← generateOutreachEmail
│   ├── vectorSearch.js                     ← findSimilarCases → { results, via }
│   ├── mcpClient.js                        ← spawns MongoDB MCP Server as stdio subprocess
│   ├── urgencyScore.js                     ← computeScore(extracted, similarCases)
│   ├── parser.js                           ← parseFile(buffer, mime) → string[]
│   ├── mongodb.js                          ← connectDB() with singleton caching
│   ├── verifyToken.js                      ← Firebase JWT verify via X.509 (no Admin SDK)
│   ├── ratelimit.js                        ← rateLimitUpload(uid) via Upstash
│   ├── apiError.js                         ← apiError(message, status) helper
│   ├── axiosClient.js                      ← axios with Firebase token interceptor
│   ├── firebase.js                         ← Firebase client init from NEXT_PUBLIC_ vars
│   └── agent/
│       └── orchestrator.js                 ← runIntakeAgent(rawText): 4-step trace
│
├── lib/models/
│   ├── Case.js                             ← main case schema (see full schema below)
│   ├── PastCase.js                         ← historical cases for vector search
│   ├── StaffAction.js                      ← override audit log
│   └── User.js                             ← user profiles
│
├── seed/
│   └── seedPastCases.js                    ← seeds 30 past cases + creates vector index
│
├── public/
│   └── demo-brief.html                     ← static Rodriguez Family brief for demo mode
│
├── .mcp.json                               ← MongoDB MCP Server config (DO NOT TOUCH)
├── .env.example                            ← all 20 env vars with comments
├── vercel.json                             ← maxDuration: 60
├── middleware.js                           ← route protection
├── DEVPOST.md                              ← hackathon submission text
├── README.md                               ← full project documentation
└── ONBOARDING.md                           ← contributor onboarding guide
```

---

## MongoDB Case Schema (Complete — Current State)

```js
{
  uid:               String,   // Firebase UID, indexed
  batch_id:          String,   // UUID per upload batch, indexed
  client_name:       String,
  case_type:         String,   // enum: eviction|immigration|wage_theft|custody|employment|other
  summary:           String,
  deadline_days:     Number,
  vulnerability_flags: {
    minor_children:  Boolean,
    language_barrier: Boolean,
    medical_condition: Boolean,
  },
  missing_info:      [String],
  priority_score:    Number,   // 0–100
  score_breakdown: {
    deadline_points:     Number,
    vulnerability_points: Number,
    case_type_points:    Number,
    similarity_points:   Number,
  },
  priority_reason:   String,
  similar_cases:     Mixed,    // array of { case_type, outcome, outcome_notes, similarity_score, year }
  recommendation:    String,   // Gemini Pro output, score >= 80 only
  agent_trace:       Mixed,    // array of step objects with name/output/durationMs/error
  mongodb_via:       String,   // 'mcp' | 'mongoose_fallback'
  mcp_config:        Mixed,    // { server, config_file }
  status:            String,   // enum: pending|reviewed|overridden|closed
  rank:              Number,
  raw_text:          String,   // original intake text (used for deduplication fingerprint)

  // Agent action sub-documents (added in agent upgrade)
  outreach: {
    subject:  String,
    body:     String,
    status:   String,          // enum: none|draft|sent
    draft_id: String,          // Gmail draft ID after POST /email
    sent_at:  Date,
  },
  calendar: {
    event_id:     String,      // Google Calendar event ID
    event_link:   String,      // htmlLink for "View in Calendar"
    scheduled_at: Date,
    status:       String,      // enum: none|scheduled|cancelled|failed
  },
  brief: {
    available:    Boolean,
    content:      String,      // raw Gemini Pro text (4 sections)
    generated_at: Date,
  },

  createdAt: Date,             // auto via timestamps: true
  updatedAt: Date,
}
```

**Rule: never remove a field from this schema. Only add.**

---

## The Full Agent Pipeline (9 Steps)

Every uploaded case goes through `app/api/intake/upload/route.js` after the agent orchestrator:

```
rawText (one intake record)
│
├─ Step 1: extractCaseFacts()        [lib/gemini.js — Gemini 3.1 Flash Lite]
│   → client_name, case_type, summary, deadline_days, vulnerability_flags, missing_info[]
│
├─ Step 2: findSimilarCases()        [lib/vectorSearch.js → lib/mcpClient.js → Atlas $vectorSearch]
│   → embeds summary with Voyage AI (1024-dim cosine)
│   → runs $vectorSearch on past_cases collection via MCP Server (stdio subprocess)
│   → falls back to direct Mongoose if MCP fails
│   → returns { results, via: 'mcp' | 'mongoose_fallback' }
│
├─ Step 3: computeScore()            [lib/urgencyScore.js — pure JS, no AI]
│   → deadline: 0–40 pts
│   → vulnerability: 0–25 pts
│   → case_type: 0–20 pts
│   → similarity: 0–15 pts
│   → total: 0–100
│
├─ Step 4: writeRecommendation()     [lib/gemini.js — Gemini 3.1 Pro — score >= 80 only]
│   → 2-sentence attorney action recommendation
│
[Steps 1–4 run inside lib/agent/orchestrator.js → runIntakeAgent(rawText)]
[Steps 5–8 run in app/api/intake/upload/route.js after Case.insertMany()]
│
├─ Step 5: generateOutreachEmail()   [lib/draftEmail.js — Gemini 3.1 Pro — ALL cases]
│   → personalised client email, stored as outreach.status = 'draft'
│   → runs in chunks of 5 via Promise.allSettled — non-fatal
│
├─ Step 6: createCalendarEvent()     [lib/calendar.js — Google Calendar API — top 3 only]
│   → 9am tomorrow, full case details, color 11 (Tomato) or 5 (Banana)
│   → requires CALENDAR_ENABLED=true and calendar.events OAuth scope
│   → non-fatal: failed cases get calendar.status = 'failed'
│
├─ Step 7: generateBriefContent()    [lib/caseBrief.js — Gemini 3.1 Pro — score >= 80 only]
│   → 4-section brief: CLIENT SITUATION / LEGAL CONTEXT / PRECEDENT / RECOMMENDED FIRST STEPS
│   → stored as brief.content (raw text), brief.available = true
│   → non-fatal
│
└─ Step 8: Case.insertMany()         [MongoDB Atlas via Mongoose]
    └─ Smart deduplication:
       - fingerprint = first 300 chars of trimmed raw_text
       - Same fingerprint + score > 5 → skip (already processed)
       - Same fingerprint + score ≤ 5 or summary = "Unable to extract case details." → delete + retry
       - No match → process + insert
```

---

## Urgency Scoring Formula (Exact)

| Component | Max pts | Logic |
|---|---|---|
| Deadline | 40 | ≤ 1 day: 40 · ≤ 3 days: 35 · ≤ 7 days: 25 · ≤ 14 days: 15 · > 14 days: 0 |
| Vulnerability | 25 | minor_children: +15 · medical_condition: +10 · language_barrier: +10 (capped at 25) |
| Case type | 20 | immigration: 20 · eviction: 18 · wage_theft: 12 · custody: 10 · employment: 8 · other: 0 |
| Precedent | 15 | similar won case with similarity ≥ 0.85: 15 · ≥ 0.70: 8 · else: 0 |

Score ≥ 80 → **Critical** (red) · Score ≥ 50 → **Elevated** (amber) · Score < 50 → **Standard** (green)

---

## All API Endpoints (Complete)

All authenticated routes require: `Authorization: Bearer <firebase-id-token>`

### Upload
```
POST /api/intake/upload
  Body: multipart/form-data, field "file" (CSV | TXT | PDF, max 10 MB)
  Auth: required
  Response: {
    batch_id, cases[], stats: { total, processed, failed, skipped,
    emails_drafted, calendar_blocks_created, briefs_generated }
  }
```

### Queue
```
GET /api/cases/queue
  Auth: required
  Response: { cases[] }  ← sorted by priority_score desc

GET /api/cases/:id
  Auth: required
  Response: { case: { ...all fields including agent_trace, similar_cases, outreach, calendar, brief } }

PATCH /api/cases/:id
  Auth: required
  Body: { status: 'pending' | 'reviewed' | 'closed' }
  Response: { case: { ...updated } }

DELETE /api/cases/clear
  Auth: required
  Response: { deleted: number }
```

### Override
```
POST /api/cases/:id/override
  Auth: required
  Body: { reason: string, new_rank: number }
  Response: { case: { ...with status: 'overridden' } }

GET /api/cases/history
  Auth: required
  Response: { actions[] }  ← StaffAction audit log
```

### Email
```
GET /api/cases/:id/email
  Auth: required
  Response: { outreach: { subject, body, status, draft_id, sent_at } }

POST /api/cases/:id/email
  Auth: required
  Body: { to: string }  ← recipient email
  Creates Gmail draft via Gmail API
  Response: { draft_id, subject, body }

PATCH /api/cases/:id/email
  Auth: required
  Sends the existing draft (must POST first to get draft_id)
  Response: { sent: true, sent_at }
```

### Calendar
```
DELETE /api/cases/:id/calendar
  Auth: required
  Cancels the Google Calendar event
  Response: { cancelled: true }

POST /api/cases/:id/calendar
  Auth: required
  Body: { iso_date: string }  ← must be valid future datetime
  Deletes old event (if any), creates new one at given time
  Response: { event_id, event_link, scheduled_at }
```

### Brief
```
GET /api/cases/:id/brief
  Auth: required
  Returns printable HTML (not JSON)
  Headers: Content-Type: text/html, Content-Disposition: inline
  CaseDetailPanel fetches this, creates a Blob URL, opens in new tab
```

### Demo & Health
```
GET /api/demo/queue
  Auth: none
  Response: { cases: [5 hardcoded demo cases], demo: true }

GET /api/health
  Auth: none
  Response: { ok: true }
```

---

## Environment Variables (All 20)

```
# MongoDB
MONGODB_URI=                              # mongodb+srv://...

# Firebase (7 vars — all NEXT_PUBLIC_ — baked into browser bundle at build)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=          # also used by verifyToken.js for JWT audience
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Google Cloud / Gemini / Calendar / Gmail — all share one OAuth client + refresh token
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=               # must include cloud-platform + gmail.compose + calendar.events scopes

# Gemini model IDs
GEMINI_MODEL_FLASH=gemini-3.1-flash-lite
GEMINI_MODEL_PRO=gemini-3.1-pro-preview-05-06

# Agent Builder (optional — tags agent trace only)
AGENT_BUILDER_ENGINE_ID=

# Voyage AI (vector embeddings)
VOYAGE_API_KEY=

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Feature flags for new agent actions
GMAIL_ENABLED=true                        # set false to skip Gmail draft creation
CALENDAR_ENABLED=true                     # set false to skip Calendar event creation
```

**Important**: `NEXT_PUBLIC_` vars are baked into the browser bundle at build time. Changing them in Vercel requires a redeploy.

---

## Authentication Architecture

- **Client-side**: Firebase Auth (Google OAuth + email/password). `getFirebaseAuth()` in `lib/firebase.js`.
- **Server-side**: No Firebase Admin SDK. `lib/verifyToken.js` fetches Google's X.509 public keys from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`, verifies the JWT signature manually, checks `aud === NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- **Every protected API route**: calls `verifyToken(request)` → throws on failure → returns `{ uid }` on success.
- **Token in client requests**: `lib/axiosClient.js` has an interceptor that attaches `Authorization: Bearer <token>`. `useUpload.js` also manually fetches a fresh token before FormData uploads.

---

## MongoDB MCP Server Integration

Config file `.mcp.json` at repo root:
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

`lib/mcpClient.js` spawns the MCP server as a stdio subprocess using `@modelcontextprotocol/sdk` (`Client` + `StdioClientTransport`). Vector search runs through MCP's `aggregate` tool. If MCP cold-starts too slowly on Vercel (>5s), the system falls back to direct Mongoose. Every case records `mongodb_via: "mcp"` or `"mongoose_fallback"`.

---

## Gemini OAuth Architecture

All Gemini calls (and Gmail/Calendar) share one OAuth 2.0 `authorized_user` credential:

1. `lib/gemini.js` → `getAccessToken()` (exported) — exchanges the refresh token for a short-lived bearer token, caches it module-level with a 1-minute buffer before expiry.
2. Token hits: `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${modelId}:generateContent`
3. Gmail: `lib/gmail.js` imports `getAccessToken` from `lib/gemini.js` — same token, same cache.
4. Calendar: `lib/calendar.js` imports `getAccessToken` from `lib/gemini.js` — same.
5. Requires refresh token scoped with ALL three: `cloud-platform`, `gmail.compose`, `calendar.events`.

---

## CSS Design Tokens (Key Variables)

```css
--text           /* primary text */
--text-2         /* secondary text */
--text-3         /* muted / labels */
--bg             /* page background */
--bg-surface     /* card/panel background */
--bg-raised      /* slightly elevated */
--bg-hover       /* hover state */
--bg-input       /* input background */
--border         /* subtle border */
--border-mid     /* medium border */
--border-strong  /* strong border */
--urgent         /* red (#e84444) — critical cases */
--medium         /* amber (#f0a030) — elevated cases */
--clear          /* green (#22c97a) — standard / success */
--gold           /* gold (#e9a12c) — override / warning */
--font-sans      /* IBM Plex Sans */
--font-mono      /* IBM Plex Mono */
--font-serif     /* IBM Plex Serif */
--radius         /* 6px */
--radius-sm      /* 4px */
--shadow-panel   /* panel shadow */

/* Aliases (in globals.css) */
--ink    = --text
--ink-2  = --text-2
--ink-3  = --text-3
--stamp  = --urgent   (red)
--ochre  = --medium   (amber)
--forest = --clear    (green)
```

---

## UI Architecture (Key Components)

### CaseDetailPanel.jsx
The most complex component. Slide-out panel triggered by clicking any row in CaseTable.

**Props**: `caseId`, `caseIds[]`, `onClose`, `onSelectCase`, `overrideData` (pass demo case object for demo mode)

**Demo mode**: when `overrideData` is not null, `isDemo = true`. Uses data directly without API call. Action buttons (status change, override, email send, calendar cancel) are hidden. Brief button opens `/demo-brief.html` instead.

**Sections rendered** (in order):
1. Hero: client name + score ring
2. Priority reason callout
3. Status action buttons (Mark Reviewed / Close Case / Reopen) — hidden in demo
4. Urgency score breakdown (UrgencyBreakdown component)
5. Extracted facts (FactRow list)
6. Similar past cases (SimilarCases component)
7. AI recommendation
8. **Outreach Email** — shows when `outreach.status !== 'none'` and `outreach.body` exists
9. **Calendar Block** — shows when `calendar.status !== 'none'`
10. **Case Brief** — shows when `brief.available === true`
11. MongoDB/MCP badge
12. Agent trace (collapsible, AgentTrace component)
13. Override ranking — hidden in demo

### AgentSummaryStrip.jsx
Appears above the queue after upload completes. Shows: cases scored · email drafts ready · calendar blocks · case briefs ready · agent complete time. Auto-dismisses after 60s (not in demo mode). Demo strip shows hardcoded `{ cases_scored: 5, emails_drafted: 5, calendar_blocks_created: 3, briefs_generated: 2, duration_ms: 8300 }`.

### useUpload.js
Returns: `{ status, stage, cases, stats, agentStats, error, batchId, upload, reset }`.
`agentStats` is populated from the upload response stats fields.

---

## Demo Mode

URL: `/dashboard?demo=true`

- Loads 5 cases from `GET /api/demo/queue` (no auth)
- Passes each case as `overrideData` to `CaseDetailPanel` — bypasses all API calls
- AgentSummaryStrip shows immediately with hardcoded stats
- All action buttons hidden; "Demo mode — sign in to send/manage" shown instead
- Brief button opens `/public/demo-brief.html` (static file, committed to repo)
- Demo cases: Rodriguez Family (eviction, 98), Anh Nguyen (immigration, 93), Keisha Brown (custody, 71), Marcus Webb (wage_theft, 55), Jin Park (employment, 38)
- Top 3 have `calendar.status: 'scheduled'` and `outreach.status: 'draft'`
- Top 2 have `brief.available: true`

---

## Commit History (Chronological — Most Recent First)

```
20e4ff1  fix(lint): remove unused imports and parameters
bf7586d  chore(submission): update env example, devpost, and readme
0db0f17  polish(demo): update all demo data with complete agent actions
adbbe8c  polish(ui): add agent action summary strip after upload
30b9a57  feat(agent): generate printable case brief for priority cases
16214cb  feat(agent): auto-create calendar blocks for top 3 priority cases
e1cbc76  feat(agent): add gemini-drafted outreach email per case
394fc49  chore: update repo URL and live site domain
74bbc78  fix(lint): remove unused err binding in upload auth catch
c746d82  chore(submission): add devpost submission text
ae36887  polish(ui): reframe landing copy around the real problem
5aafb31  polish(ui): handle empty similar cases and fix demo case detail panel
a4bc3ec  chore(security): final security audit — all checks passing
396cc60  chore(submission): update LICENSE year and copyright holder
0694319  chore(cleanup): remove dead testGemini export from lib/gemini.js
dc8fb6e  chore(security): move hardcoded Firebase config to NEXT_PUBLIC_ env vars
90aa0aa  chore(security): scrub internal error details from all API responses
d878467  chore(security): add airtight gitignore covering all secret file patterns
351c174  docs: rewrite README + update .env.example with all current vars
9b1f495  feat(mcp): surface MCP transport path in agent trace and UI badge
```

---

## Security Rules (Already Applied — Do Not Regress)

1. **No `err.message` in API responses** — all 500s return generic messages. Only `console.error` server-side.
2. **No Firebase config in source** — all 7 vars are `NEXT_PUBLIC_FIREBASE_*` in env.
3. **`.gitignore` is comprehensive** — covers `.env*`, `*-service-account.json`, `credentials.json`, `token.json`, `oauth-token.json`, `*.key.json`, and more.
4. **No test/diagnostic routes** — `app/api/test/` was deleted entirely.
5. **Rate limiting on upload** — 10 per 15 min per user via Upstash.
6. **All case ownership verified** — every `Case.find` or `Case.findById` checks `uid === decoded.uid`.
7. **Gmail/Calendar are feature-flagged** — `GMAIL_ENABLED` and `CALENDAR_ENABLED` must be explicitly set to `"true"`. They log and no-op if not set.

---

## Files You Must NOT Break

These are working and verified. Make only additive changes:

```
lib/gemini.js          ← Gemini OAuth, extractCaseFacts, writeRecommendation,
                          getAccessToken (exported), callGeminiPro (exported)
lib/vectorSearch.js    ← findSimilarCases → { results, via }
lib/mcpClient.js       ← MCP stdio client
lib/urgencyScore.js    ← computeScore()
lib/verifyToken.js     ← Firebase JWT verification
lib/mongodb.js         ← connectDB() singleton
lib/models/            ← all models (ADD fields only, never remove)
app/api/auth/          ← auth routes
app/api/cases/queue    ← queue route
app/api/cases/clear    ← clear route
app/api/cases/history  ← history route
app/api/cases/[id]/route.js      ← GET/PATCH case
app/api/cases/[id]/override/     ← override route
app/(public)/page.jsx            ← landing page
app/(public)/login/              ← login page
components/CaseTable.jsx         ← case table
.gitignore                       ← comprehensive, leave it
.env.example                     ← update with new vars, never remove existing
.mcp.json                        ← leave it
LICENSE                          ← leave it
public/demo-brief.html           ← static demo file, leave it
```

---

## Known Gotchas

1. **Vercel 60s timeout** — All agent actions are non-fatal and run in parallel. If Gemini is slow, actions may not complete within 60s. Email drafting runs in chunks of 5.

2. **MCP cold start** — On Vercel serverless, MCP server subprocess may time out on first cold request. Fallback to Mongoose is automatic and silent.

3. **Gmail/Calendar need scope upgrade** — The refresh token must be regenerated with `gmail.compose` and `calendar.events` scopes in addition to `cloud-platform`. Until this is done, those features are disabled even if the flags are set.

4. **NEXT_PUBLIC_ vars need redeploy** — Changing Firebase env vars in Vercel requires a full redeploy to take effect in the browser bundle.

5. **Atlas vector index required** — `past_cases.description_embedding` needs a `$vectorSearch` index. Run `npm run seed` once to create it.

6. **Brief opens via Blob URL** — The brief API returns HTML (not JSON). CaseDetailPanel fetches it with the auth header, creates a `URL.createObjectURL(blob)`, and calls `window.open`. This is necessary because GET requests to a new tab can't carry auth headers.

7. **Email POST needs `to` address** — The email API route requires a `to` field in the body. The current UI uses a `prompt()` dialog to collect it. This is intentional simplicity — replace with a proper input if needed.

8. **`ordered: false` in insertMany** — The upload route uses `{ ordered: false }` to allow partial batch inserts. If some cases fail DB validation, the rest still insert. The returned `inserted` array corresponds to the input `caseDocs` array by index.

9. **Demo case IDs are strings, not ObjectIds** — `demo-001` through `demo-005` are not valid MongoDB ObjectIds. CaseDetailPanel handles this by using `overrideData` in demo mode and never calling the API.

---

## What Has Been Built vs What Remains

### Fully Working
- ✅ File upload (CSV, TXT, PDF) → full 9-step agent pipeline
- ✅ Smart deduplication (skip/retry/insert)
- ✅ MongoDB Atlas $vectorSearch via MCP Server (with Mongoose fallback)
- ✅ Urgency scoring 0–100 (4 dimensions)
- ✅ AI recommendation (Gemini Pro, score ≥ 80)
- ✅ Outreach email drafting (Gemini Pro, all cases)
- ✅ Gmail draft creation + send via API (requires scope-upgraded refresh token)
- ✅ Google Calendar event creation (top 3) + cancel + reschedule
- ✅ Case brief generation (Gemini Pro, score ≥ 80) + HTML brief endpoint
- ✅ Agent summary strip (post-upload + demo mode)
- ✅ Demo mode (5 hardcoded cases, all agent features shown)
- ✅ Case detail panel (all sections, demo + real mode)
- ✅ Staff override with audit trail
- ✅ Firebase auth (Google OAuth + email/password)
- ✅ Rate limiting (Upstash Redis)
- ✅ All security hardening

### Pending (User Action Required)
- ⏳ Regenerate OAuth refresh token with gmail.compose + calendar.events scopes → update Vercel → redeploy
- ⏳ Verify VOYAGE_API_KEY is set in Vercel (needed for real vector search)
- ⏳ Record 3-minute demo video (script in DEVPOST.md)
- ⏳ Submit on Devpost before Jun 11, 2026 @ 2pm MST
- ⏳ GitHub About section → set license badge to MIT

---

## Running Locally

```bash
git clone https://github.com/Dhruva-Aher/JusticeQueue
cd JusticeQueue
npm install
cp .env.example .env.local
# Fill all values in .env.local
npm run seed     # one-time: seeds 30 past cases + creates Atlas vector index
npm run dev      # http://localhost:3000
npm run lint     # must pass before any commit
npm run build    # must pass before any deploy
```

---

## Coding Conventions

- **ES modules throughout** — `import/export`, not `require()`
- **No TypeScript** — plain `.js` / `.jsx`
- **Tailwind not used** — all styles are inline `style={{}}` objects using CSS vars
- **Client components** marked with `'use client'` at top
- **API routes** use Next.js App Router format: `export async function GET/POST/PATCH/DELETE(request, { params })`
- **Error responses** always use `apiError(message, status)` from `lib/apiError.js`
- **No `err.message` in client responses** — `console.error` server-side only
- **Non-fatal agent steps** — email/calendar/brief failures never block the response
- **Commit format**: `type(scope): description` — one concern per commit, push immediately
