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

- **Retrieval impact (documented audit)** — On **60** cases with Atlas `$vectorSearch` in context: **32** scores improved (**53%**), mean priority **+6**, **4** critical tier upgrades (max **83 → 98** on an eviction lockout precedent). Treat as a **documented run**, not a production SLA.
- **Deterministic scoring** — Four fixed dimensions + override audit trail; LLM extracts and retrieves, score math stays inspectable.
- **Operability** — Docket agent with step traces; printable attorney brief; rate-limited uploads (Upstash).
- **Demo honesty** — `/judge` uses representative/static demo data so recruiters can click without Firebase.

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

| Claim | Caveat |
|-------|--------|
| 60-case Vector Search audit | Documented in README/Devpost era — keep as **historical measured run**; re-run before tightening wording |
| “Production” | Public Vercel demo + Atlas — fine to say **deployed demo**, not clinic production traffic |
| CourtListener / MCP paths | Present in agent graph; demos may short-circuit — say what the judge page actually shows |
