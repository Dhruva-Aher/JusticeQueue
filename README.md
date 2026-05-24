# JusticeQueue

AI triage agent for legal aid clinics. Upload a CSV, TXT, or PDF of pending intake cases — Gemini 3.1 Flash Lite extracts structured facts, MongoDB Atlas vector search finds similar past case outcomes, and a scoring engine ranks every case by urgency so the most critical clients are never buried under paperwork.

**Live:** https://hackathonlive.vercel.app  
**Demo (no login required):** https://hackathonlive.vercel.app/dashboard?demo=true

Built for the **Google Cloud Rapid Agent Hackathon 2026 — MongoDB track**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Engine | **Google Cloud Agent Builder** |
| LLM | **Gemini 3.1 Flash Lite** + Gemini 3.1 Pro Preview (Vertex AI) |
| Database | **MongoDB Atlas** (document store + Atlas Vector Search) |
| DB Integration | **MongoDB MCP Server** (`@mongodb-js/mongodb-mcp-server`) |
| Embeddings | Voyage AI `voyage-large-2` (1024-dim, cosine similarity) |
| Auth | Firebase Authentication (Google OAuth + email/password) |
| Rate Limiting | Upstash Redis (10 uploads / 15 min per user) |
| Frontend | Next.js 14 App Router |
| Hosting | Vercel (serverless, 60s function timeout) |

---

## How It Works

```
Intake file (CSV / TXT / PDF)
        │
        ▼
  POST /api/intake/upload
        │
        ├─ 1. parseFile()          — extract raw text per case
        │
        ├─ 2. extractCaseFacts()   — Gemini 3.1 Flash Lite
        │      ├─ client_name, case_type, summary
        │      ├─ deadline_days, vulnerability_flags
        │      └─ missing_info[]
        │
        ├─ 3. findSimilarCases()   — MongoDB MCP Server → Atlas $vectorSearch
        │      ├─ Voyage AI embeds the case summary (1024-dim)
        │      ├─ MCP Server runs aggregation pipeline via stdio
        │      └─ Falls back to direct Mongoose if MCP unavailable
        │
        ├─ 4. computeScore()       — deterministic urgency scoring
        │      ├─ deadline:       0–40 pts (exponential decay)
        │      ├─ vulnerability:  0–20 pts (minor children, medical, language)
        │      ├─ case_type:      0–20 pts (immigration > eviction > custody…)
        │      └─ precedent:      0–20 pts (similar past cases, outcome weight)
        │
        ├─ 5. writeRecommendation()  — Gemini 3.1 Pro (score ≥ 80 only)
        │      └─ 2-sentence attorney action recommendation
        │
        └─ 6. Case.insertMany()    — persist to MongoDB Atlas
               └─ smart dedup: skip processed, retry SAFE_DEFAULT, add new
```

---

## MongoDB MCP Server Integration

JusticeQueue uses the official **MongoDB MCP Server** (`@mongodb-js/mongodb-mcp-server`) to query Atlas via the Model Context Protocol — matching the hackathon requirement to use MongoDB MCP.

**Config file (`.mcp.json`):**
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

**Flow:** The MCP client (`lib/mcpClient.js`) spawns the MCP server as a stdio subprocess using `@modelcontextprotocol/sdk`. Vector search runs through MCP's `aggregate` tool. If the MCP server fails (e.g. cold-start timeout on Vercel), the system falls back to direct Mongoose — with every case document recording `mongodb_via: "mcp"` or `"mongoose_fallback"` so you can see exactly which path was used in the Case Detail panel.

---

## Urgency Scoring

| Component | Max Points | Logic |
|---|---|---|
| Deadline | 40 | ≤1 day: 40 · ≤3 days: 35 · ≤7 days: 25 · ≤14 days: 15 · ≤30 days: 8 |
| Vulnerability | 20 | +8 minor children · +7 medical condition · +5 language barrier |
| Case Type | 20 | Immigration: 20 · Eviction: 18 · Custody: 15 · Wage Theft: 12 · Employment: 8 |
| Precedent | 20 | Top similar case similarity × outcome weight (won: 1.0, settled: 0.7, lost: 0.3) |

Score ≥ 80 → Critical (red) · Score ≥ 50 → Elevated (amber) · Score < 50 → Standard (green)

---

## Setup

```bash
git clone https://github.com/Dhruva-Aher/hackathonlive
cd hackathonlive
npm install
cp .env.example .env.local
# Fill all values in .env.local (see comments in the file)
npm run seed        # seed 30 past cases + create Atlas vector index
npm run dev         # http://localhost:3000
```

### Prerequisites

- **MongoDB Atlas** cluster with `$vectorSearch` index on `past_cases.description_embedding`
- **Google Cloud project** with Vertex AI API enabled
- **OAuth 2.0 credentials** (Web application type) with refresh token
- **Firebase project** with Google sign-in and email/password auth enabled
- **Voyage AI** account (free tier has enough quota for testing)
- **Upstash Redis** database (free tier is sufficient)

---

## Deploy to Vercel

1. Fork/push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Set **Function Max Duration** to 60s in `vercel.json` (already configured)
5. Deploy — Vercel auto-detects Next.js

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/intake/upload` | ✅ | Parse file, run agent pipeline, insert cases |
| `GET` | `/api/cases/queue` | ✅ | Sorted case queue for authenticated user |
| `GET` | `/api/cases/:id` | ✅ | Full case document with agent trace |
| `PATCH` | `/api/cases/:id` | ✅ | Update case status (reviewed / closed) |
| `POST` | `/api/cases/:id/override` | ✅ | Manual rank override (audited) |
| `DELETE` | `/api/cases/clear` | ✅ | Delete all cases for user |
| `GET` | `/api/demo/queue` | ❌ | 5 hardcoded demo cases, no auth |
| `GET` | `/api/auth/me` | ✅ | Upsert user profile on first login |
| `GET` | `/api/health` | ❌ | Liveness check |

---

## File Format

Upload a **CSV**, **TXT**, or **PDF**. Separate individual intake records with a blank line.

**Example CSV:**
```
Client Name,Case Description
Maria Santos,"Single mother facing eviction in 3 days, two minor children, landlord refused rent payment"
James Lee,"Wage theft, employer withheld final 2 paychecks, closing business next week"
```

**Example TXT (blank-line separated):**
```
Client: Rosa Martinez
Case: Family of 5 facing eviction in 48 hours. Landlord locked them out illegally.
Children under 10 present. No English.

Client: David Park
Case: Terminated after reporting OSHA violations. Employer refused final paycheck.
```

---

## Hackathon

Google Cloud Rapid Agent Hackathon 2026 — MongoDB track  
Repository: https://github.com/Dhruva-Aher/hackathonlive  
License: MIT
