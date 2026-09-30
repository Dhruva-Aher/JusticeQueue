# JusticeQueue

**Legal case triage** · Full-stack / AI product · Next.js · MongoDB Atlas · Gemini

Intake → structured scoring → ranked queue, with **Atlas Vector Search** precedents in the agent context so urgency is grounded in similar historical outcomes — not a chatbot glued to a spreadsheet.

| | |
|--|--|
| **Demo** | [justicequeuelive.vercel.app](https://justicequeuelive.vercel.app) · [Judge mode (no login)](https://justicequeuelive.vercel.app/judge) |
| **Focus** | Precedent retrieval · deterministic scoring · agent traces |
| **Stack** | Next.js · MongoDB Atlas · Gemini / Vertex · Firebase Auth · Upstash |

---

## Highlights

- **Retrieval impact (live — Grade A)** — Public aggregate as of **2026-09-30**: **14** scored cases → **7** improved (**50%**), mean delta **+6**, **1** tier upgrade; top eviction case **83 → 98** (`delta` **15**). Artifact: [`docs/evidence/public-stats-2026-09-30.json`](docs/evidence/public-stats-2026-09-30.json) from [`/api/stats/public`](https://justicequeuelive.vercel.app/api/stats/public).
- **Deterministic scoring** — Four fixed dimensions + override audit trail; LLM extracts and retrieves, score math stays inspectable.
- **Corpus** — **30** past cases with embeddings (won/settled/declined mix) in live Atlas corpus.
- **Demo honesty** — `/judge` works without Firebase; live stats are aggregate-only (no PII).

---

## Architecture

| Component | Responsibility |
|-----------|----------------|
| **Next.js UI** | Queue, upload, agent runs, brief, judge demo |
| **API routes** | Intake pipeline, docket agent, queue/case APIs |
| **MongoDB Atlas** | Cases + embeddings + `$vectorSearch` |
| **Gemini / Vertex** | Extract, embed, strategy, recommendations |
| **Firebase** | Auth (JWT verify on protected routes) |
| **Upstash** | Upload rate limit |

```text
Browser → Next.js API → Gemini intake + Vertex embeddings
                      → Atlas $vectorSearch precedents
                      → computeScore() → ranked queue
                      → docket agent (multi-step) → brief
```

Depth: [ONBOARDING.md](ONBOARDING.md) · [DEPLOY.md](DEPLOY.md) · [AGENT_CONTEXT.md](AGENT_CONTEXT.md)

---

## Quick start

```bash
npm install
cp .env.example .env.local   # MongoDB, Gemini/Vertex, Firebase, Upstash
npm run dev
# optional
npm run seed
npm run verify
```

Live walkthrough: open the demo URLs above (judge mode needs no login).

---

## Evidence notes

| Claim | Status |
|-------|--------|
| Live retrieval impact **14 / 7 / 50% / +6 / 83→98** | **Grade A** — [`docs/evidence/public-stats-2026-09-30.json`](docs/evidence/public-stats-2026-09-30.json) |
| Older “60 cases / 32 improved” Devpost wording | **Superseded** — do not pitch; see [docs/METRICS.md](docs/METRICS.md) |
| “Production clinic” | Say **deployed demo**, not clinic traffic |

Depth docs: [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/METRICS.md](docs/METRICS.md)
