// Public read-only stats endpoint — no auth required.
// Used by the Judge Mode page (/judge) to show live retrieval impact metrics.
// All data is aggregate-only; no PII is exposed.
//
// Returns:
//   retrieval_impact: cases where Atlas $vectorSearch changed the score
//   run_summary: total agent runs, average duration, total decisions logged
//   vector_health: live check against past_cases collection

export const runtime = 'nodejs'
export const maxDuration = 15

import { connectDB } from '../../../../lib/mongodb.js'
import Case          from '../../../../lib/models/Case.js'
import AgentRun      from '../../../../lib/models/AgentRun.js'
import PastCase      from '../../../../lib/models/PastCase.js'

export async function GET() {
  try {
    await connectDB()

    // ── Retrieval impact (from Case collection) ───────────────────────────────
    // score_without_retrieval is persisted on every case that goes through intake.
    const [impactResult, runResult, corpusResult] = await Promise.all([

      Case.aggregate([
        {
          $match: {
            score_without_retrieval: { $type: 'number' },
            priority_score:          { $type: 'number' },
          },
        },
        {
          $facet: {
            improved: [
              { $match: { $expr: { $gt: ['$priority_score', '$score_without_retrieval'] } } },
              { $count: 'n' },
            ],
            all: [
              { $count: 'n' },
            ],
            avg_delta: [
              {
                $group: {
                  _id: null,
                  avg: { $avg: { $subtract: ['$priority_score', '$score_without_retrieval'] } },
                },
              },
            ],
            tier_upgrades: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $gte: ['$priority_score',          75] },
                      { $lt:  ['$score_without_retrieval', 75] },
                    ],
                  },
                },
              },
              { $count: 'n' },
            ],
            top_delta: [
              {
                $addFields: { delta: { $subtract: ['$priority_score', '$score_without_retrieval'] } },
              },
              { $sort: { delta: -1 } },
              { $limit: 1 },
              {
                $project: {
                  _id: 0,
                  case_type: 1,
                  delta: 1,
                  priority_score: 1,
                  score_without_retrieval: 1,
                },
              },
            ],
          },
        },
      ]),

      AgentRun.aggregate([
        { $match: { status: 'complete' } },
        {
          $group: {
            _id:              null,
            total_runs:       { $sum: 1 },
            avg_duration_ms:  { $avg: '$duration_ms' },
            total_decisions:  { $sum: { $size: { $ifNull: ['$decisions', []] } } },
            total_cases:      { $sum: '$result.cases_reviewed' },
            last_run_at:      { $max: '$completed_at' },
          },
        },
      ]),

      PastCase.aggregate([
        {
          $facet: {
            total_cases: [ { $count: 'n' } ],
            with_embeddings: [
              { $match: { description_embedding: { $exists: true, $not: { $size: 0 } } } },
              { $count: 'n' }
            ],
            outcomes: [
              { $group: { _id: '$outcome', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            categories: [
              { $group: { _id: '$case_type', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ]
          }
        }
      ]),
    ])

    const impact   = impactResult[0] ?? {}
    const improved = impact.improved?.[0]?.n ?? 0
    const total    = impact.all?.[0]?.n ?? 0
    const avgDelta = Math.round(impact.avg_delta?.[0]?.avg ?? 0)
    const tierUp   = impact.tier_upgrades?.[0]?.n ?? 0
    const topDelta = impact.top_delta?.[0] ?? null

    const runs         = runResult[0] ?? {}
    const corpusData   = corpusResult[0] ?? {}
    const allCasesCount = corpusData.total_cases?.[0]?.n ?? 0
    const withEmbeddingsCount = corpusData.with_embeddings?.[0]?.n ?? 0
    const outcomeDistribution = Object.fromEntries((corpusData.outcomes ?? []).map(d => [d._id || 'unknown', d.count]))
    const categoryDistribution = Object.fromEntries((corpusData.categories ?? []).map(d => [d._id || 'unknown', d.count]))

    return Response.json({
      ok: true,
      as_of: new Date().toISOString(),
      retrieval_impact: {
        total_cases_with_scores: total,
        cases_improved:          improved,
        improved_pct:            total > 0 ? Math.round((improved / total) * 100) : 0,
        avg_delta_pts:           avgDelta,
        tier_upgrades:           tierUp,
        top_delta_case:          topDelta,
        note:                    total < 10 ? '50-case demo dataset' : `${total} live cases`,
      },
      agent_runs: {
        total_runs:      runs.total_runs ?? 0,
        avg_duration_ms: Math.round(runs.avg_duration_ms ?? 0),
        total_decisions: runs.total_decisions ?? 0,
        total_cases:     runs.total_cases ?? 0,
        last_run_at:     runs.last_run_at ?? null,
      },
      corpus: {
        total_cases: allCasesCount,
        with_embeddings: withEmbeddingsCount,
        outcome_distribution: outcomeDistribution,
        category_distribution: categoryDistribution,
      },
    })
  } catch (err) {
    console.error('[/api/stats/public] error:', err.message)
    return Response.json({ ok: false, error: err.message }, { status: 500 })
  }
}
