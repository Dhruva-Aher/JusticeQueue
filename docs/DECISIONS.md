# Decisions — JusticeQueue

Status: **PROPOSED** ≠ **DECIDED** ≠ **IMPLEMENTED** ≠ **VERIFIED**  
Related: [METRICS.md](./METRICS.md) · [ONBOARDING.md](../ONBOARDING.md) · [DEPLOY.md](../DEPLOY.md)

**Cross-verify (2026-09-30):** Live `GET /api/stats/public` archived under `docs/evidence/public-stats-2026-09-30.json` — Grade **A** for **14/7/50%/+6** and **83→98**. Older 60-case README numbers **superseded**.

---

## D1 — Precedent retrieval must move the score (not decoration)

| | |
|--|--|
| **Context** | LLM triage alone is hard to defend vs “chatbot wrapper”. |
| **Decision** | Store `score_without_retrieval` vs `priority_score`; expose retrieval-stats aggregation. |
| **Why** | Makes Atlas Vector Search falsifiable in demos/interviews. |
| **Evidence** | `app/api/cases/retrieval-stats/route.js`, Case model fields |
| **Status** | DECIDED · IMPLEMENTED |

---

## D2 — Deterministic urgency math; LLM for extract/retrieve/narrate

| | |
|--|--|
| **Context** | Pure LLM priority scores are non-auditable. |
| **Decision** | `computeScore()` over fixed dimensions + similar-case inputs. |
| **Why** | Interviewable; overrides remain audited. |
| **Evidence** | `lib/urgencyScore.js` |
| **Status** | DECIDED · IMPLEMENTED |

---

## D3 — Separate judge/demo data from authenticated pipeline

| | |
|--|--|
| **Context** | Recruiters need click-through without Firebase. |
| **Decision** | `/judge` + demo queue endpoints with representative/static data. |
| **Why** | Demo honesty; don’t imply every click hits live Gemini+Atlas. |
| **Evidence** | README; demo API routes |
| **Status** | DECIDED · IMPLEMENTED |

---

## D4 — Prefer live public stats over historical Devpost numbers

| | |
|--|--|
| **Context** | README once claimed a 60-case audit without a frozen artifact. |
| **Decision** | Pitch only archived `/api/stats/public` captures (2026-09-30: 14/7/50%/+6, top 83→98). |
| **Why** | FAANG honesty; endpoint is re-runnable. |
| **Evidence** | `docs/evidence/public-stats-2026-09-30.json` |
| **Status** | DECIDED · IMPLEMENTED · VERIFIED |

---

## D5 — Respect Vercel 60s function budget

| | |
|--|--|
| **Context** | Multi-step docket agent can timeout. |
| **Decision** | Chunk batches; raise recommendation threshold (e.g. ≥80) to reduce work. |
| **Evidence** | ONBOARDING / AGENT_CONTEXT timeout notes |
| **Status** | DECIDED · IMPLEMENTED |
