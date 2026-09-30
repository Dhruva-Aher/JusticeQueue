# Metrics & Claims — JusticeQueue

**Cross-verified:** 2026-09-30 (updated with live public stats archive)

| ID | Claim (exact) | Grade | Evidence |
|----|---------------|-------|----------|
| C1 | Live demo SPA on Vercel | A | https://justicequeuelive.vercel.app |
| C2 | Judge mode without login | A | `/judge` |
| C3 | Intake → Gemini → Vertex embed → Atlas `$vectorSearch` → `computeScore()` | A | `lib/` + orchestrator |
| C4 | Live retrieval impact: **14** scored cases, **7** improved (**50%**), avg delta **+6**, **1** tier upgrade | A | [`docs/evidence/public-stats-2026-09-30.json`](./evidence/public-stats-2026-09-30.json) via `GET /api/stats/public` |
| C5 | Top delta case: eviction **83 → 98** (`delta` **15**) | A | Same JSON `top_delta_case` |
| C6 | Corpus: **30** past cases, all with embeddings | A | Same JSON `corpus` |
| C7 | Historical “60 / 32 / 53% / 4 upgrades” | **superseded** | No archive; replaced by C4–C6 |

## Re-verify

```bash
curl -sL https://justicequeuelive.vercel.app/api/stats/public | tee docs/evidence/public-stats-$(date -u +%Y-%m-%d).json
```
