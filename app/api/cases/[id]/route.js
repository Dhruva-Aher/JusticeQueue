// GET /api/cases/:id — return full case document with similar_cases and recommendation
import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError } from '../../../../lib/apiError.js'
import { connectDB } from '../../../../lib/mongodb.js'
import Case from '../../../../lib/models/Case.js'

export async function GET(request, { params }) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  await connectDB()
  const doc = await Case.findById(params.id).lean()

  if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

  const { _id, uid, __v, ...rest } = doc
  return Response.json({ case: { id: _id.toString(), ...rest } })
}
