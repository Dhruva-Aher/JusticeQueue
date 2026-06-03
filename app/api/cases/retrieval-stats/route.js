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

    const [stats] = await Case.aggregate([
      {
        $match: {
          uid:                     decoded.uid,
          score_without_retrieval: { $exists: true, $ne: null },
          priority_score:          { $exists: true },
        },
      },
      {
        $addFields: {
          delta:       { $subtract: ['$priority_score', '$score_without_retrieval'] },
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
        $group: {
          _id:              null,
          total_cases:      { $sum: 1 },
          cases_improved:   { $sum: { $cond: [{ $gt: ['$delta', 0] }, 1, 0] } },
          cases_unchanged:  { $sum: { $cond: [{ $eq: ['$delta', 0] }, 1, 0] } },
          avg_delta:        { $avg: '$delta' },
          max_delta:        { $max: '$delta' },
          tier_upgrades:    {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$tier_before', '$tier_after'] },
                  // tier_after is "higher" (critical > high > standard)
                  { $or: [
                    { $and: [{ $eq: ['$tier_after', 'critical'] }, { $ne: ['$tier_before', 'critical'] }] },
                    { $and: [{ $eq: ['$tier_after', 'high'] }, { $eq: ['$tier_before', 'standard'] }] },
                  ]},
                ]},
                1, 0,
              ],
            },
          },
          top_delta_case: {
            $max: {
              $cond: [
                { $gt: ['$delta', 0] },
                {
                  delta:       '$delta',
                  client_name: '$client_name',
                  case_type:   '$case_type',
                  score_before: '$score_without_retrieval',
                  score_after:  '$priority_score',
                },
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id:            0,
          total_cases:    1,
          cases_improved: 1,
          cases_unchanged: 1,
          avg_delta:      { $round: ['$avg_delta', 1] },
          max_delta:      1,
          tier_upgrades:  1,
          top_delta_case: 1,
          pct_improved: {
            $cond: [
              { $gt: ['$total_cases', 0] },
              { $multiply: [{ $divide: ['$cases_improved', '$total_cases'] }, 100] },
              0,
            ],
          },
        },
      },
    ])

    return Response.json(stats ?? {
      total_cases: 0, cases_improved: 0, avg_delta: 0,
      max_delta: 0, tier_upgrades: 0, pct_improved: 0,
    })
  } catch (err) {
    console.error('[retrieval-stats]', err.message)
    return apiError('Internal server error', 500)
  }
}
