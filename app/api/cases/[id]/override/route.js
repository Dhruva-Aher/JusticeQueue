// POST /api/cases/:id/override — staff override with reason, writes to staff_actions
import { verifyToken } from '../../../../../lib/verifyToken.js'
import { apiError } from '../../../../../lib/apiError.js'
import { connectDB } from '../../../../../lib/mongodb.js'
import Case from '../../../../../lib/models/Case.js'
import StaffAction from '../../../../../lib/models/StaffAction.js'

export async function POST(request, { params }) {
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

  const { reason, new_rank } = body
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return apiError('reason is required and must be a non-empty string', 400)
  }
  if (typeof new_rank !== 'number') {
    return apiError('new_rank is required and must be a number', 400)
  }

  try {
    await connectDB()
    const doc = await Case.findById(params.id)
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    await StaffAction.create({
      case_id:        doc._id,
      staff_uid:      decoded.uid,
      action:         'override',
      previous_score: doc.priority_score,
      new_rank,
      reason:         reason.trim(),
    })

    doc.status = 'overridden'
    await doc.save()

    const plain      = doc.toObject()
    const sanitized  = Object.fromEntries(
      Object.entries(plain).filter(([k]) => !['_id', 'uid', '__v'].includes(k))
    )
    return Response.json({ case: { id: plain._id.toString(), ...sanitized } })
  } catch (err) {
    return apiError(err.message, 500)
  }
}
