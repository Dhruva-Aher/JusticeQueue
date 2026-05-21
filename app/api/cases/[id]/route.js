// GET  /api/cases/:id  — full case document
// PATCH /api/cases/:id — update status (reviewed | closed | pending)
import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import Case            from '../../../../lib/models/Case.js'

const ALLOWED_STATUSES = ['pending', 'reviewed', 'closed']

export async function GET(request, { params }) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  try {
    await connectDB()
    const doc = await Case.findById(params.id).lean()
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    const sanitized = Object.fromEntries(
      Object.entries(doc).filter(([k]) => !['_id', 'uid', '__v'].includes(k))
    )
    return Response.json({ case: { id: doc._id.toString(), ...sanitized } })
  } catch (err) {
    return apiError(err.message, 500)
  }
}

export async function PATCH(request, { params }) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const { status } = body
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return apiError(`Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400)
  }

  try {
    await connectDB()
    const doc = await Case.findOneAndUpdate(
      { _id: params.id, uid: decoded.uid },
      { $set: { status } },
      { new: true, lean: true }
    )

    if (!doc) return apiError('Case not found', 404)

    const sanitized = Object.fromEntries(
      Object.entries(doc).filter(([k]) => !['_id', 'uid', '__v'].includes(k))
    )
    return Response.json({ case: { id: doc._id.toString(), ...sanitized } })
  } catch (err) {
    return apiError(err.message, 500)
  }
}
