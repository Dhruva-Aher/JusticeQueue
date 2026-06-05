// GET  /api/cases/:id  — full case document
// PATCH /api/cases/:id — update status (reviewed | closed | pending)
import { verifyToken }   from '../../../../lib/verifyToken.js'
import { apiError }      from '../../../../lib/apiError.js'
import { connectDB }     from '../../../../lib/mongodb.js'
import Case              from '../../../../lib/models/Case.js'
import { assertObjectId } from '../../../../lib/validate.js'

const ALLOWED_STATUSES = ['pending', 'reviewed', 'closed']

export async function GET(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

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
    console.error('[cases/id GET]', err.message)
    return apiError('Internal server error', 500)
  }
}

export async function PATCH(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

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

  const { status, action, new_score, reviewer_notes } = body

  // Legacy status handling
  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
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
      console.error('[cases/id PATCH]', err.message)
      return apiError('Internal server error', 500)
    }
  }

  // New action handling
  if (action) {
    try {
      await connectDB()
      
      const updateData = {}
      if (action === 'approve') updateData.status = 'reviewed'
      else if (action === 'escalate' || action === 'request_senior_review') updateData.status = 'reviewed'
      
      if (action === 'modify' && new_score !== undefined) {
        updateData.priority_score = Number(new_score)
      }
      if (reviewer_notes) {
        updateData.reviewer_notes = reviewer_notes
      }

      const doc = await Case.findOneAndUpdate(
        { _id: params.id, uid: decoded.uid },
        { $set: updateData },
        { new: true, lean: true }
      )

      if (!doc) return apiError('Case not found', 404)

      return Response.json({
        ok: true,
        updated: { status: doc.status, priority_score: doc.priority_score }
      })
    } catch (err) {
      console.error('[cases/id PATCH action]', err.message)
      return apiError('Internal server error', 500)
    }
  }

  return apiError('Missing status or action in body', 400)
}
