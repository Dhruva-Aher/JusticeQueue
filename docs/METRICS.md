# Metrics & Claims — JusticeQueue

**Cross-verified:** 2026-09-30  
Grades: **A** / **B** / **C** / **D**

## Claim table

| ID | Claim (exact) | Grade | Evidence |
|----|---------------|-------|----------|
| C1 | Live demo SPA on Vercel | A | https://justicequeuelive.vercel.app (homepage set) |
| C2 | Judge mode without login | A | `/judge` route; ONBOARDING |
| C3 | Intake → Gemini extract → Vertex embed → Atlas `$vectorSearch` → `computeScore()` | A | `lib/` + agent orchestrator |
| C4 | Docket agent multi-step with MongoDB run audit trail | A | `lib/agent/orchestrator.js`, AgentRun writes |
| C5 | Seed corpus `past_cases.json` length **30** (not 60) | A | `seed/data/past_cases.json` count 2026-09-30 |
| C6 | README “**60** live cases → **32** improved (**53%**), mean **+6**, **4** critical upgrades, max **83→98**” | C→**caution** | **No frozen stats JSON in-repo** this pass. API `GET /api/cases/retrieval-stats` *can* compute live deltas per user, but numbers are not checked in. Pitch as **historical Devpost-era audit** only; re-run + archive before Grade A. |
| C7 | Demo seed ~50 curated cases / hardcoded judge queue | B | `POST /api/demo/seed`, `GET /api/demo/queue` (code paths) |

## Explicit non-claims

| Phrase | Why |
|--------|-----|
| “Production clinic traffic” | Public demo + hobby Vercel limits |
| Exact **60**-case stats as current | Seed file shows **30** past cases; audit artifact missing |
| Always-on CourtListener in demo | Conditional in agent graph; judge page may use static data |

## How to re-verify

```bash
# After auth against a seeded user DB:
# GET /api/cases/retrieval-stats → archive JSON under docs/evidence/
npm run verify   # if scripts/verify.sh green
```
