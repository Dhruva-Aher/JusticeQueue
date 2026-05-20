// GET /api/cases/history — return distinct batch_ids with count and created_at
import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError } from '../../../../lib/apiError.js'
import { connectDB } from '../../../../lib/mongodb.js'
import Case from '../../../../lib/models/Case.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  await connectDB()

  const batches = await Case.aggregate([
    { $match: { uid: decoded.uid } },
    { $group: { _id: '$batch_id', count: { $sum: 1 }, created_at: { $min: '$createdAt' } } },
    { $sort: { created_at: -1 } },
    { $limit: 20 },
    { $project: { _id: 0, batch_id: '$_id', count: 1, created_at: 1 } },
  ])

  return Response.json({ batches })
}
