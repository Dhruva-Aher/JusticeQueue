# JusticeQueue — Complete Agent Context File

This file is the single source of truth for any AI agent picking up this project.
Read this entire file before touching anything. Do not skim.
It covers the technical project AND the owner's working style, every prompt they gave,
every decision they made, and exactly how to work with them.

---

## 1. WHO YOU ARE WORKING WITH

**Name**: Dhruva Aher  
**Role**: Solo developer, project owner  
**Hackathon**: Google Cloud Rapid Agent Hackathon 2026 — MongoDB track

### Communication Style

- Messages are **short and direct**. "repo has changed to X" means update every reference and push. No explanation needed.
- When he gives a **long detailed prompt**, it is a full specification — follow it exactly, in order, one commit per concern.
- When he gives a **short message**, it is either a status update, a correction, or a single task. Infer correctly.
- He does not ask "can you" — he says what he wants done.
- He does not want recaps, preambles, or "I'll now do X" narration. Start doing it.
- He does not want questions about obvious things. Read context, make the right call.
- He checks output and will point out what's wrong. He does not micromanage.

### What He Cares About (In Order)

1. **Nothing working should break.** Ever. He will say this repeatedly. It is rule zero.
2. **Commits are atomic.** One concern per commit. Push immediately after each one.
3. **Security is non-negotiable.** No secrets in source, no error messages leaked to clients, no dead diagnostic routes.
4. **The demo must work.** `/dashboard?demo=true` must always be fully functional without login.
5. **The agent feels like an agent.** It takes real actions (email, calendar, brief) — not just displays data.
6. **Code stays clean.** Lint must pass before every commit.

### What He Does Not Want

- Unnecessary questions
- Files touched that aren't part of the task
- Dependencies added without a reason
- Duplicated logic
- TypeScript
- Tailwind
- Comments that state the obvious
- Verbose commit messages (concise is fine, just accurate)

---

## 2. EVERY PROMPT/INSTRUCTION HE GAVE (CHRONOLOGICAL)

### Session 1 — Pre-Submission Polish (5 Commits)

He gave a large structured prompt asking for:

**Commit A — Fix `/dashboard?demo=true` blank page**
- `Suspense fallback={null}` → proper `<DashboardFallback />` loading screen
- Add `demoError` state + red error banner ("Demo Unavailable — Try Signing In")
- Fix `authLoading` guard returning null → return loading screen instead

**Commit B — Delete `/api/test/gemini` diagnostic route**
- Security risk — exposes internal Gemini auth
- Delete entire `app/api/test/` directory

**Commit C — Surface MCP transport path in agent trace and UI badge**
- `lib/vectorSearch.js`: return `{ results, via }` instead of bare array
- `lib/agent/orchestrator.js`: capture `mongodb_via`, add `AGENT_BUILDER_ENGINE_ID`
- `lib/models/Case.js`: add `mongodb_via`, `mcp_config` fields
- `components/CaseDetailPanel.jsx`: add MCP badge (green "MongoDB via MCP" or amber "MongoDB Direct")

**Commit D — Add Agent Builder engine reference + tech strip to dashboard**
- Tech strip below Navbar: "Powered by Google Cloud Agent Builder · Gemini 3.1 Flash Lite · MongoDB Atlas · MongoDB MCP Server"

**Commit E — README rewrite + `.env.example` update**
- Full README rewrite with architecture diagram
- `.env.example` updated to all 18 vars

---

### Session 2 — Security Audit & Cleanup (Commits A–H)

He gave a full security audit prompt covering:

**Commit A — Comprehensive `.gitignore`**
- Cover: `.env.production`, `.env.staging`, `.env*.local`, `.env*.development`, `.env*.production`
- Cover: `*-service-account.json`, `*-sa.json`, `service-account*.json`, `google-credentials*.json`, `firebase-adminsdk*.json`, `gcp-key*.json`, `*.key.json`, `credentials.json`, `token.json`, `oauth-token.json`
- Cover: `test-intake-10cases.txt`, `*.txt`

**Commit B — Scrub `err.message` from all API responses**
- Every `catch (err)` that sent `err.message` to the client → generic message + `console.error` server-side
- Rule: internal error details never reach the client

**Commit C — Move Firebase hardcoded config to `NEXT_PUBLIC_FIREBASE_*` env vars**
- `lib/firebase.js`: replace hardcoded values with `process.env.NEXT_PUBLIC_FIREBASE_*`
- `lib/verifyToken.js`: replace hardcoded project ID with `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`

**Commit D — Remove dead `testGemini()` export**
- `lib/gemini.js`: delete the 9-line `testGemini()` function entirely

**Commit E — Update LICENSE year/name**
- `Copyright (c) 2025 JusticeQueue` → `Copyright (c) 2026 Dhruva Aher`

**Commits F–H — Audit everything, final checks**
- Verify all routes, no leaks, `.env.example` complete

---

### Session 3 — Final Submission Prep (3 Commits + Manual Steps)

**Manual steps first (he was explicit: cannot skip)**
- Vercel: add 7 `NEXT_PUBLIC_FIREBASE_*` env vars → redeploy
- GitHub About: set license to MIT

**Commit 1 — Fix empty similar cases state + fix broken demo case detail panel**
- `components/SimilarCases.jsx`: proper empty state ("NO SIMILAR CASES FOUND" in mono uppercase)
- `components/CaseDetailPanel.jsx`: add `overrideData` prop — when set, use data directly, no API call
- `app/(protected)/dashboard/page.jsx`: pass selected demo case as `overrideData`
- `app/api/demo/queue/route.js`: add 3 similar cases to every demo case (demo-005 had zero)

**Commit 2 — Reframe landing page copy around the real problem**
- Lead with the problem, not the solution
- New hero headline: "Families lose their homes not because no lawyer existed — but because the right case never reached the right lawyer in time."
- New stats: `900+` legal aid orgs · `~80%` eligible clients turned away · `72hrs` average time before family loses home · `< 30s` intake batch to ranked queue
- Primary CTA: "See it working →" → `/dashboard?demo=true`

**Commit 3 — Create `DEVPOST.md`**
- Full Devpost submission text: tagline, what it does, the problem nobody named, how we built it, why MongoDB is load-bearing, what we learned, tech stack, links

---

### Session 4 — URL/Repo Change

Single short message: `"repo has changed to https://github.com/Dhruva-Aher/JusticeQueue and website link is https://justicequeuelive.vercel.app/"`

This meant:
- Update git remote: `git remote set-url origin https://github.com/Dhruva-Aher/JusticeQueue.git`
- Update `README.md`: all 4 occurrences of old URLs
- Update `DEVPOST.md`: all 3 occurrences in Links section
- Commit + push to new repo

He did not need to spell this out. He just told me the new URLs.

---

### Session 5 — Agent Upgrade (6 Commits — The Biggest Prompt)

This was the largest single prompt. He gave the full spec for upgrading from a scoring dashboard to a genuine agent. The prompt structure:

**Pre-condition (manual — cannot be skipped)**
- GCP Console: add `gmail.compose` and `calendar.events` scopes to OAuth client
- Regenerate refresh token via OAuth Playground with all 3 scopes
- Update `GOOGLE_OAUTH_REFRESH_TOKEN` in Vercel → redeploy
- Verify Gemini still works before writing code

**Commit 1 — Gmail outreach email per case**
- `lib/models/Case.js`: add `outreach` sub-document
- `lib/gmail.js`: `createGmailDraft`, `sendGmailDraft` via OAuth bearer
- `lib/draftEmail.js`: `generateOutreachEmail` using Gemini Pro
- `app/api/intake/upload/route.js`: draft emails post-insert, chunks of 5, non-fatal
- `app/api/cases/[id]/email/route.js`: GET/POST/PATCH
- `components/CaseDetailPanel.jsx`: Outreach Email section

**Commit 2 — Google Calendar blocks for top 3 cases**
- `lib/models/Case.js`: add `calendar` sub-document
- `lib/calendar.js`: `createCalendarEvent`, `deleteCalendarEvent`
- `app/api/intake/upload/route.js`: calendar for top 3 post-insert, non-fatal
- `app/api/cases/[id]/calendar/route.js`: DELETE (cancel) + POST (reschedule)
- `components/CaseDetailPanel.jsx`: Calendar Block section

**Commit 3 — Case brief PDF for high-priority cases**
- `lib/models/Case.js`: add `brief` sub-document
- `lib/caseBrief.js`: `generateBriefContent`, `buildBriefHTML`
- `app/api/cases/[id]/brief/route.js`: GET returns HTML (not JSON), browser prints to PDF
- `public/demo-brief.html`: static Rodriguez Family brief committed to repo
- `components/CaseDetailPanel.jsx`: Case Brief section, handleOpenBrief uses Blob URL pattern

**Commit 4 — Agent action summary strip**
- `components/AgentSummaryStrip.jsx`: strip showing cases/emails/calendar/briefs count + duration
- `hooks/useUpload.js`: add `agentStats` to return value
- `app/(protected)/dashboard/page.jsx`: show strip after upload + demo strip always visible

**Commit 5 — Update all demo data**
- All 5 demo cases: add outreach, calendar, brief, agent_trace with tools_called + actions_taken
- Top 3 cases get `calendar.status: 'scheduled'`
- Top 2 get `brief.available: true`

**Commit 6 — Update docs and env**
- `.env.example`: add `GMAIL_ENABLED`, `CALENDAR_ENABLED` with OAuth scope instructions
- `DEVPOST.md`: rewrite "What it does" section
- `README.md`: add "What the Agent Does" section, expand pipeline to 9 steps

He also gave:
- A full 3-minute demo script (timed to the second)
- A verification checklist to run after all commits
- A list of files explicitly not to touch

---

### Session 6 — Onboarding Doc

Short message: `"If i have to ask my friend to join on this project what information should he have also api endpoints how to use it and what variables he to know and history of project"`

→ Created `ONBOARDING.md` with: project history, architecture, all API endpoints with request/response examples, all env vars with where to get each one, local setup steps, MCP integration, deduplication logic, key gotchas, contributing guide.

---

### Session 7 — This File

Short message: `"did u include my style what all things i have given to you how u work and everything i mean everything"`

→ He caught that `AGENT_CONTEXT.md` was purely technical and missing the human layer — his style, his prompts, his decisions, how to work with him. This file is the corrected version.

---

## 3. HIS DESIGN SYSTEM (What He Built, What He Expects)

### Fonts
- **IBM Plex Sans** — body text, UI text
- **IBM Plex Mono** — labels, badges, stats, meta information, buttons
- **IBM Plex Serif** — AI-generated content (recommendation quotes)

### Colors (CSS Variables)
```css
--text           /* primary text */
--text-2         /* secondary text */
--text-3         /* muted / labels */
--bg             /* dark page background */
--bg-surface     /* card/panel background */
--bg-raised      /* slightly elevated surfaces */
--bg-hover       /* hover state */
--bg-input       /* input fields */
--border         /* subtle border */
--border-mid     /* medium border */
--border-strong  /* strong border */
--urgent         /* red #e84444 — critical, danger */
--medium         /* amber #f0a030 — elevated, warning */
--clear          /* green #22c97a — success, safe */
--gold           /* gold #e9a12c — override, manual action */
--stamp = --urgent   (alias)
--ochre = --medium   (alias)
--forest = --clear   (alias)
--ink   = --text     (alias)
--ink-2 = --text-2   (alias)
--ink-3 = --text-3   (alias)
```

### UI Conventions
- **All styles are inline** `style={{}}` objects — no Tailwind, no CSS modules, no class names
- **Labels**: IBM Plex Mono, 10–11px, uppercase, letter-spacing 0.06–0.08em, `var(--text-3)`
- **Values**: IBM Plex Mono, 11–12px, `var(--text-2)` or `var(--text)`
- **Body text**: IBM Plex Sans, 13px, `var(--text-2)`, line-height 1.65
- **Buttons**: IBM Plex Mono, uppercase, 10–11px, border-radius varies (0 for agent action buttons, `var(--radius-sm)` for status buttons)
- **Borders**: 1px solid `var(--border)` everywhere
- **Dividers**: `<Divider />` component — `height: 1px, background: var(--border), margin: 1.25rem 0`
- **Section labels**: `<SectionLabel>` — mono 10px uppercase `var(--text-3)`
- **No emojis** unless explicitly requested

### StatusBadge Variants
```js
danger  → red background/text    (critical errors)
warn    → amber background/text  (warnings)
clear   → green background/text  (success, scheduled, sent)
gold    → gold background/text   (overrides, cancelled)
neutral → muted                  (default)
blue    → blue                   (info)
```

---

## 4. CODING STANDARDS (Exactly What He Expects)

### Language
- Plain JavaScript — `.js` / `.jsx` — no TypeScript
- ES modules — `import/export` — never `require()`

### API Routes
```js
export async function GET(request, { params }) { ... }
export async function POST(request, { params }) { ... }
```

### Error Handling
```js
// CORRECT
try { ... }
catch (err) {
  console.error('[route-name]', err.message)
  return apiError('Generic message to client', 500)
}

// WRONG — never do this
return apiError(err.message, 500)   // ← leaks internals
```

### Auth Pattern (Every Protected Route)
```js
let decoded
try { decoded = await verifyToken(request) }
catch { return apiError('Unauthorized', 401) }
```

### Non-Fatal Pattern (Agent Actions)
```js
try {
  // do the thing
} catch (err) {
  console.error('[context] action failed:', err.message)
  // Never block the pipeline — log and continue
}
```

### Models — Add Only
```js
// When adding a field to a Mongoose model:
// CORRECT — add the new field
newField: { type: String, default: null },

// WRONG — never remove, rename, or change existing fields
```

### Commits
```
type(scope): short description

What changed and why (not what the code does line by line).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `polish`, `chore`, `docs`, `refactor`
One concern per commit. Push immediately after each.

---

## 5. DECISIONS MADE AND WHY

| Decision | Why |
|---|---|
| HTML brief instead of PDF | pdfkit fails on Vercel due to bundle size. Browser print-to-PDF is zero-dependency and works on serverless. |
| `overrideData` prop pattern for demo | Demo case IDs (`demo-001`) are not valid MongoDB ObjectIds. CaseDetailPanel would call `/api/cases/demo-001` → 404. Passing data directly bypasses the broken fetch. |
| `GMAIL_ENABLED` / `CALENDAR_ENABLED` flags | Gmail and Calendar require a scope-upgraded refresh token. Flags let the app deploy and run before the token is regenerated, failing gracefully (log + no-op) instead of crashing. |
| Non-fatal email/calendar/brief | These are enhancements. A Gemini timeout for brief generation should never prevent the core scoring pipeline from completing. |
| Chunks of 5 for email drafting | Gemini Pro rate limits. Running 20 concurrent Pro calls during a large batch would hit quotas. |
| `ordered: false` in `insertMany` | Allows partial batch success. If one case doc fails validation, the rest still insert. |
| No Firebase Admin SDK | Avoids service account key file. Token verification uses X.509 cert fetch from Google's public endpoint — stateless, no credentials to manage. |
| Brief opens via Blob URL | `GET /api/cases/:id/brief` requires `Authorization` header. You can't attach headers to a `window.open()` call. Fetch with header → create Blob → `URL.createObjectURL` → `window.open` solves it. |
| MCP fallback to Mongoose | Vercel serverless cold-starts mean the MCP stdio subprocess may not initialize in time. Mongoose fallback ensures vector search always produces something. |
| `fingerprint = first 300 chars` | Long enough to catch duplicates, short enough to be fast. Avoids hashing overhead. |

---

## 6. PROJECT IDENTITY — FULL

| Field | Value |
|---|---|
| Live site | https://justicequeuelive.vercel.app |
| Demo | https://justicequeuelive.vercel.app/dashboard?demo=true |
| GitHub | https://github.com/Dhruva-Aher/JusticeQueue |
| Hackathon | Google Cloud Rapid Agent Hackathon 2026 — MongoDB track |
| Devpost deadline | Jun 11, 2026 @ 2pm MST |
| Framework | Next.js 14 App Router |
| Deployment | Vercel (hobby plan, 60s function timeout) |
| License | MIT 2026 Dhruva Aher |

---

## 7. FULL TECH STACK

| Layer | Technology |
|---|---|
| Agent engine | Google Cloud Agent Builder |
| LLM — extraction | Gemini 3.1 Flash Lite (Vertex AI) |
| LLM — recommendation, email, brief | Gemini 3.1 Pro Preview (Vertex AI) |
| Database | MongoDB Atlas |
| Vector search | Atlas $vectorSearch on `past_cases.description_embedding` |
| DB tool layer | MongoDB MCP Server (`@mongodb-js/mongodb-mcp-server` via stdio) |
| Embeddings | Voyage AI `voyage-large-2` (1024-dim, cosine similarity) |
| Auth | Firebase Authentication (Google OAuth + email/password) |
| Token verify | Custom X.509 JWT verify (no Admin SDK) |
| Rate limiting | Upstash Redis (10 uploads / 15 min per user) |
| Email | Gmail API (OAuth 2.0 bearer, `gmail.compose` scope) |
| Calendar | Google Calendar API (OAuth 2.0 bearer, `calendar.events` scope) |
| Frontend | Next.js 14 App Router — `(public)` + `(protected)` route groups |
| Hosting | Vercel serverless, `maxDuration = 60` |

---

## 8. REPOSITORY STRUCTURE (Every File)

```
JusticeQueue/
│
├── app/
│   ├── layout.jsx                          ← root layout, CSS vars, fonts (DO NOT TOUCH)
│   ├── globals.css                         ← all CSS design tokens (DO NOT TOUCH)
│   │
│   ├── (public)/
│   │   ├── page.jsx                        ← landing page (DO NOT TOUCH — working)
│   │   ├── login/page.jsx                  ← Firebase login (DO NOT TOUCH)
│   │   └── register/page.jsx               ← Firebase register (DO NOT TOUCH)
│   │
│   ├── (protected)/
│   │   └── dashboard/page.jsx              ← main dashboard: upload + queue + agent strip + panels
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
│       │       ├── route.js                ← GET case detail / PATCH status
│       │       ├── override/route.js       ← POST manual rank override (audited)
│       │       ├── email/route.js          ← GET draft / POST save to Gmail / PATCH send
│       │       ├── calendar/route.js       ← DELETE cancel event / POST reschedule
│       │       └── brief/route.js          ← GET returns printable HTML
│       └── demo/
│           └── queue/route.js              ← GET 5 hardcoded demo cases, no auth
│
├── components/
│   ├── Navbar.jsx                          ← top nav (DO NOT TOUCH)
│   ├── UploadZone.jsx                      ← drag-drop file picker (DO NOT TOUCH)
│   ├── CaseTable.jsx                       ← ranked case list (DO NOT TOUCH)
│   ├── CaseDetailPanel.jsx                 ← slide-out: all sections + agent actions
│   ├── AgentSummaryStrip.jsx               ← post-upload strip showing what agent did
│   ├── SimilarCases.jsx                    ← similar past cases section
│   ├── StatusBadge.jsx                     ← coloured label chip (DO NOT TOUCH)
│   └── UrgencyBreakdown.jsx                ← score breakdown visual (DO NOT TOUCH)
│
├── hooks/
│   ├── useUpload.js                        ← upload state machine → agentStats
│   └── useCases.js                         ← fetches /api/cases/queue (DO NOT TOUCH)
│
├── context/
│   └── AuthContext.jsx                     ← Firebase auth state (DO NOT TOUCH)
│
├── lib/
│   ├── gemini.js                           ← getAccessToken (exported), callGeminiPro (exported),
│   │                                          extractCaseFacts, writeRecommendation — DO NOT TOUCH
│   ├── gmail.js                            ← createGmailDraft, sendGmailDraft
│   ├── calendar.js                         ← createCalendarEvent, deleteCalendarEvent
│   ├── caseBrief.js                        ← generateBriefContent, buildBriefHTML
│   ├── draftEmail.js                       ← generateOutreachEmail
│   ├── vectorSearch.js                     ← findSimilarCases → { results, via } (DO NOT TOUCH)
│   ├── mcpClient.js                        ← MCP stdio subprocess client (DO NOT TOUCH)
│   ├── urgencyScore.js                     ← computeScore() (DO NOT TOUCH)
│   ├── parser.js                           ← parseFile() (DO NOT TOUCH)
│   ├── mongodb.js                          ← connectDB() singleton (DO NOT TOUCH)
│   ├── verifyToken.js                      ← X.509 JWT verify (DO NOT TOUCH)
│   ├── ratelimit.js                        ← Upstash rate limiter (DO NOT TOUCH)
│   ├── apiError.js                         ← apiError() helper (DO NOT TOUCH)
│   ├── axiosClient.js                      ← axios + token interceptor (DO NOT TOUCH)
│   ├── firebase.js                         ← Firebase client init (DO NOT TOUCH)
│   └── agent/
│       └── orchestrator.js                 ← runIntakeAgent(rawText) — 4-step trace (DO NOT TOUCH)
│
├── lib/models/
│   ├── Case.js                             ← FULL schema below — ADD ONLY
│   ├── PastCase.js                         ← historical cases for vector search
│   ├── StaffAction.js                      ← override audit log
│   └── User.js                             ← user profiles
│
├── seed/
│   └── seedPastCases.js                    ← seeds 30 past cases + creates vector index
│
├── public/
│   └── demo-brief.html                     ← static Rodriguez Family brief (DO NOT TOUCH)
│
├── .mcp.json                               ← MongoDB MCP Server config (DO NOT TOUCH)
├── .gitignore                              ← comprehensive (DO NOT TOUCH)
├── .env.example                            ← update only by adding vars, never remove
├── vercel.json                             ← maxDuration: 60 (DO NOT TOUCH)
├── middleware.js                           ← route protection (DO NOT TOUCH)
├── DEVPOST.md                              ← hackathon submission text
├── README.md                               ← project documentation
├── ONBOARDING.md                           ← human contributor guide
└── AGENT_CONTEXT.md                        ← this file
```

---

## 9. MONGODB CASE SCHEMA (Complete — Add Only, Never Remove)

```js
{
  uid:               String,            // Firebase UID, indexed
  batch_id:          String,            // UUID per upload, indexed
  client_name:       String,
  case_type:         String,            // enum: eviction|immigration|wage_theft|custody|employment|other
  summary:           String,
  deadline_days:     Number,
  vulnerability_flags: {
    minor_children:   Boolean,
    language_barrier: Boolean,
    medical_condition: Boolean,
  },
  missing_info:      [String],
  priority_score:    Number,            // 0–100
  score_breakdown: {
    deadline_points:      Number,
    vulnerability_points: Number,
    case_type_points:     Number,
    similarity_points:    Number,
  },
  priority_reason:   String,
  similar_cases:     Mixed,             // [{ case_type, outcome, outcome_notes, similarity_score, year }]
  recommendation:    String,            // Gemini Pro, score >= 80 only
  agent_trace:       Mixed,             // [{ name, input, output, durationMs, error, startedAt }]
  mongodb_via:       String,            // 'mcp' | 'mongoose_fallback'
  mcp_config:        Mixed,             // { server, config_file }
  status:            String,            // enum: pending|reviewed|overridden|closed
  rank:              Number,
  raw_text:          String,            // original text, used for dedup fingerprint
  outreach: {
    subject:  String,
    body:     String,
    status:   String,                   // enum: none|draft|sent
    draft_id: String,                   // Gmail draft ID
    sent_at:  Date,
  },
  calendar: {
    event_id:     String,               // Google Calendar event ID
    event_link:   String,               // htmlLink
    scheduled_at: Date,
    status:       String,               // enum: none|scheduled|cancelled|failed
  },
  brief: {
    available:    Boolean,
    content:      String,               // raw Gemini Pro 4-section text
    generated_at: Date,
  },
  createdAt: Date,                      // auto via timestamps: true
  updatedAt: Date,
}
```

---

## 10. THE FULL AGENT PIPELINE (9 Steps)

Steps 1–4 run inside `lib/agent/orchestrator.js` → `runIntakeAgent(rawText)`.
Steps 5–8 run in `app/api/intake/upload/route.js` after `Case.insertMany()`.

```
Step 1: extractCaseFacts()       Gemini 3.1 Flash Lite — ALL cases
Step 2: findSimilarCases()       MongoDB MCP Server → Atlas $vectorSearch (fallback: Mongoose)
Step 3: computeScore()           Pure JS — 4 dimensions, 0–100
Step 4: writeRecommendation()    Gemini 3.1 Pro — score >= 80 only
--------- insertMany() happens here ---------
Step 5: generateOutreachEmail()  Gemini 3.1 Pro — ALL cases, chunks of 5, non-fatal
Step 6: createCalendarEvent()    Google Calendar API — top 3 by score, non-fatal
Step 7: generateBriefContent()   Gemini 3.1 Pro — score >= 80 only, non-fatal
Step 8: [updates] all three actions update their case docs in MongoDB
Step 9: final queue fetch → response with emails_drafted / calendar_blocks_created / briefs_generated
```

---

## 11. URGENCY SCORING (Exact Numbers)

| Dimension | Max | Rule |
|---|---|---|
| Deadline | 40 | ≤1 day: 40 · ≤3 days: 35 · ≤7 days: 25 · ≤14 days: 15 · >14 days: 0 |
| Vulnerability | 25 | minor_children +15 · medical_condition +10 · language_barrier +10 (capped 25) |
| Case type | 20 | immigration 20 · eviction 18 · wage_theft 12 · custody 10 · employment 8 · other 0 |
| Precedent | 15 | similar won case: similarity ≥ 0.85 → 15 · ≥ 0.70 → 8 · else → 0 |

Score ≥ 80: Critical (red `--urgent`) · Score ≥ 50: Elevated (amber `--medium`) · Score < 50: Standard (green `--clear`)

---

## 12. ALL API ENDPOINTS

```
POST   /api/intake/upload                Body: multipart file. Returns: { batch_id, cases[], stats }
GET    /api/cases/queue                  Returns: { cases[] } sorted by score desc
GET    /api/cases/:id                    Returns: { case: { ...all fields } }
PATCH  /api/cases/:id                    Body: { status }. Returns: { case }
DELETE /api/cases/clear                  Returns: { deleted: number }
POST   /api/cases/:id/override           Body: { reason, new_rank }. Returns: { case }
GET    /api/cases/history                Returns: { actions[] }
GET    /api/cases/:id/email              Returns: { outreach }
POST   /api/cases/:id/email              Body: { to }. Creates Gmail draft. Returns: { draft_id }
PATCH  /api/cases/:id/email              Sends existing draft. Returns: { sent: true, sent_at }
DELETE /api/cases/:id/calendar           Cancels event. Returns: { cancelled: true }
POST   /api/cases/:id/calendar           Body: { iso_date }. Returns: { event_id, event_link }
GET    /api/cases/:id/brief              Returns: HTML (not JSON)
GET    /api/demo/queue                   No auth. Returns: { cases: [5 demo cases], demo: true }
GET    /api/auth/me                      Upserts user profile. Returns: { user }
GET    /api/health                       Returns: { ok: true }
```

All except `/api/demo/queue`, `/api/health`, and `/api/auth/me` require:
`Authorization: Bearer <firebase-id-token>`

---

## 13. ALL ENVIRONMENT VARIABLES (20 Total)

```bash
MONGODB_URI=                               # mongodb+srv://...

NEXT_PUBLIC_FIREBASE_API_KEY=              # all 7 baked into browser bundle at build
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=          # changing these requires a Vercel redeploy
NEXT_PUBLIC_FIREBASE_PROJECT_ID=           # also used by verifyToken.js for JWT audience
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=                # must include cloud-platform + gmail.compose + calendar.events

GEMINI_MODEL_FLASH=gemini-3.1-flash-lite
GEMINI_MODEL_PRO=gemini-3.1-pro-preview-05-06

AGENT_BUILDER_ENGINE_ID=                   # optional — tags agent traces only

VOYAGE_API_KEY=                            # required for real vector search

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

GMAIL_ENABLED=true                         # set false to disable email drafting
CALENDAR_ENABLED=true                      # set false to disable calendar events
```

---

## 14. DEMO MODE ARCHITECTURE

URL: `/dashboard?demo=true`

- No login required
- Loads 5 cases from `GET /api/demo/queue`
- Each case passed as `overrideData` prop to `CaseDetailPanel` → no API calls, data used directly
- `isDemo = overrideData !== null`
- All action buttons hidden in demo mode
- "Demo mode — sign in to send/manage" shown instead
- AgentSummaryStrip shows hardcoded: `{ cases_scored:5, emails_drafted:5, calendar_blocks_created:3, briefs_generated:2, duration_ms:8300 }`
- Brief button → `window.open('/demo-brief.html', '_blank')` (static file in `/public/`)
- Demo case IDs: `demo-001` through `demo-005` — NOT valid MongoDB ObjectIds

Demo cases (sorted by priority):
| ID | Client | Type | Score | Calendar | Brief |
|---|---|---|---|---|---|
| demo-001 | Rodriguez Family | eviction | 98 | scheduled | available |
| demo-002 | Anh Nguyen | immigration | 93 | scheduled | available |
| demo-003 | Keisha Brown | custody | 71 | scheduled | not available |
| demo-004 | Marcus Webb | wage_theft | 55 | none | not available |
| demo-005 | Jin Park | employment | 38 | none | not available |

All 5 have `outreach.status: 'draft'` with full email content.

---

## 15. SECURITY RULES (Non-Negotiable)

1. **No `err.message` in client responses** — `console.error` server-side, generic message to client
2. **No Firebase config in source** — all 7 vars are `NEXT_PUBLIC_FIREBASE_*`
3. **No diagnostic/test routes** — `/api/test/` was deleted, never re-add
4. **`.gitignore` covers all secrets** — do not weaken it
5. **Every route checks ownership** — `doc.uid !== decoded.uid` → 404
6. **GMAIL_ENABLED / CALENDAR_ENABLED are feature flags** — if not set to `"true"`, functions log and no-op
7. **Rate limiting on upload** — via Upstash, fail open (never block upload if Redis is down)

---

## 16. COMMIT HISTORY (Full — Most Recent First)

```
66c4201  docs: add full agent context and handoff files
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

## 17. WHAT IS DONE vs WHAT REMAINS

### Done and Working
- File upload (CSV/TXT/PDF) → full 9-step agent pipeline
- Smart deduplication (fingerprint = first 300 chars)
- MongoDB Atlas $vectorSearch via MCP Server (Mongoose fallback)
- Urgency scoring 0–100 (4 dimensions, exact formula above)
- AI recommendation (Gemini Pro, score ≥ 80)
- Outreach email drafting (Gemini Pro, all cases)
- Gmail draft creation + send via API
- Google Calendar event creation (top 3) + cancel + reschedule
- Case brief generation (Gemini Pro, score ≥ 80) + HTML brief endpoint
- Agent summary strip (post-upload + demo)
- Demo mode (5 cases, all features shown)
- Case detail panel (all 13 sections)
- Staff override with full audit trail
- Firebase auth (Google OAuth + email/password)
- Rate limiting (Upstash Redis)
- All security hardening

### Waiting on Dhruv (Manual Steps)
- ⏳ Regenerate OAuth refresh token with `gmail.compose` + `calendar.events` scopes → update `GOOGLE_OAUTH_REFRESH_TOKEN` in Vercel → redeploy
- ⏳ Verify `VOYAGE_API_KEY` is set in Vercel (required for real vector search)
- ⏳ Record 3-minute demo video (script in DEVPOST.md — timed to the second)
- ⏳ Submit on Devpost before Jun 11, 2026 @ 2pm MST
- ⏳ GitHub About section → set license badge to MIT

---

## 18. LOCAL SETUP

```bash
git clone https://github.com/Dhruva-Aher/JusticeQueue
cd JusticeQueue
npm install
cp .env.example .env.local
# Fill all values in .env.local
npm run seed        # one-time: 30 past cases + Atlas vector index
npm run dev         # http://localhost:3000
npm run lint        # must pass before any commit
npm run build       # must pass before any deploy
```

---

## 19. KEY GOTCHAS

1. **Vercel 60s timeout** — Agent actions run in parallel. If Gemini is slow on a large batch, actions may not complete within 60s. Email runs in chunks of 5 to reduce this risk.
2. **MCP cold start** — First request on a cold Vercel function may time out the MCP subprocess. Mongoose fallback is automatic.
3. **Gmail/Calendar need scope upgrade** — Refresh token must be regenerated with 3 scopes before these features work: `cloud-platform` + `gmail.compose` + `calendar.events`.
4. **NEXT_PUBLIC_ vars need redeploy** — Changing Firebase env vars in Vercel takes effect only after a full redeploy.
5. **Atlas vector index required** — `past_cases.description_embedding` needs a `$vectorSearch` index. Run `npm run seed` once to create it.
6. **Brief uses Blob URL** — Brief API requires auth header. `window.open` can't carry headers. Solution: fetch → Blob → `URL.createObjectURL` → `window.open`.
7. **Email POST needs `to` address** — Current UI uses `prompt()` dialog. Intentional simplicity.
8. **Demo IDs are not ObjectIds** — `demo-001` etc. are strings. Never call the real API with them.
9. **`ordered: false` in insertMany** — Failed docs don't block the rest. Returned array maps by index to input.
10. **`lint` catches unused vars** — Two lint errors were found after the agent upgrade and fixed immediately. Always run `npm run lint` before committing.
