# Decisions — JusticeQueue

Status: **PROPOSED** ≠ **DECIDED** ≠ **IMPLEMENTED** ≠ **VERIFIED**  
Related: [METRICS.md](./METRICS.md) · [ONBOARDING.md](../ONBOARDING.md) · [DEPLOY.md](../DEPLOY.md)

**Cross-verify (2026-09-30):** Architecture claims Grade **A**. Vector-search impact **60/32/53%** left Grade **C** — no checked-in aggregation artifact; `past_cases.json` has **30** rows.

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

## D4 — Soften public impact metrics until artifact exists

| | |
|--|--|
| **Context** | README claimed 60-case production audit without frozen evidence file. |
| **Decision** | METRICS grades C6 as caution; README must say “documented historical audit”. |
| **Why** | FAANG honesty bar. |
| **Status** | DECIDED · IMPLEMENTED (docs 2026-09-30) |

---

## D5 — Respect Vercel 60s function budget

| | |
|--|--|
| **Context** | Multi-step docket agent can timeout. |
| **Decision** | Chunk batches; raise recommendation threshold (e.g. ≥80) to reduce work. |
| **Evidence** | ONBOARDING / AGENT_CONTEXT timeout notes |
| **Status** | DECIDED · IMPLEMENTED |
