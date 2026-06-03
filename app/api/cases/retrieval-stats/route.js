// GET /api/cases/retrieval-stats
// Returns MongoDB aggregation stats proving Atlas Vector Search changes outcomes.
// Used by the Judge page "MongoDB Changes Outcomes" section.
export const dynamic = 'force-dynamic'

import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import Case            from '../../../../lib/models/Case.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  try {
    await connectDB()

    // Two-pass: stats in one branch, top-delta case in a separate sorted branch.
    // Avoids the $max-on-object BSON ordering bug.
    const [facetResult] = await Case.aggregate([
      {
        $match: {
          uid:                     decoded.uid,
          score_without_retrieval: { $exists: true, $ne: null },
          priority_score:          { $exists: true },
        },
      },
      {
        $addFields: {
          delta: { $subtract: ['$priority_score', '$score_without_retrieval'] },
          tier_before: {
            $switch: {
              branches: [
                { case: { $gte: ['$score_without_retrieval', 80] }, then: 'critical' },
                { case: { $gte: ['$score_without_retrieval', 50] }, then: 'high'     },
              ],
              default: 'standard',
            },
          },
          tier_after: {
            $switch: {
              branches: [
                { case: { $gte: ['$priority_score', 80] }, then: 'critical' },
                { case: { $gte: ['$priority_score', 50] }, then: 'high'     },
              ],
              default: 'standard',
            },
          },
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id:             null,
                total_cases:     { $sum: 1 },
                cases_improved:  { $sum: { $cond: [{ $gt:  ['$delta', 0] }, 1, 0] } },
                cases_unchanged: { $sum: { $cond: [{ $eq:  ['$delta', 0] }, 1, 0] } },
                avg_delta:       { $avg: '$delta' },
                max_delta:       { $max: '$delta' },
                tier_upgrades: {
                  $sum: {
                    $cond: [
                      { $and: [
                        { $ne: ['$tier_before', '$tier_after'] },
                        { $or: [
                          { $and: [{ $eq: ['$tier_after', 'critical'] }, { $ne: ['$tier_before', 'critical'] }] },
                          { $and: [{ $eq: ['$tier_after', 'high']     }, { $eq: ['$tier_before', 'standard'] }] },
                        ]},
                      ]},
                      1, 0,
                    ],
                  },
                },
              },
            },
          ],
          // Sort by delta desc, take first — this is the correct max-delta case
          top_case: [
            { $match: { delta: { $gt: 0 } } },
            { $sort:  { delta: -1 } },
            { $limit: 1 },
            { $project: {
              _id:          0,
              client_name:  1,
              case_type:    1,
              score_before: '$score_without_retrieval',
              score_after:  '$priority_score',
              delta:        1,
            }},
          ],
        },
      },
    ])

    const summary  = facetResult?.summary?.[0]  ?? {}
    const topCase  = facetResult?.top_case?.[0] ?? null
    const stats = summary._id !== undefined ? {
      total_cases:    summary.total_cases    ?? 0,
      cases_improved: summary.cases_improved ?? 0,
      cases_unchanged:summary.cases_unchanged?? 0,
      avg_delta:      Math.round((summary.avg_delta ?? 0) * 10) / 10,
      max_delta:      summary.max_delta      ?? 0,
      tier_upgrades:  summary.tier_upgrades  ?? 0,
      top_delta_case: topCase,
      pct_improved:   summary.total_cases > 0
        ? (summary.cases_improved / summary.total_cases) * 100
        : 0,
    } : null

    return Response.json(stats ?? {
      total_cases: 0, cases_improved: 0, cases_unchanged: 0, avg_delta: 0,
      max_delta: 0, tier_upgrades: 0, pct_improved: 0, top_delta_case: null,
    })
  } catch (err) {
    console.error('[retrieval-stats]', err.message)
    return apiError('Internal server error', 500)
  }
}
