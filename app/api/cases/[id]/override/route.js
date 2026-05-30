// POST /api/cases/:id/override — staff override with reason, writes to staff_actions
import { verifyToken }  from '../../../../../lib/verifyToken.js'
import { apiError }     from '../../../../../lib/apiError.js'
import { connectDB }    from '../../../../../lib/mongodb.js'
import Case             from '../../../../../lib/models/Case.js'
import StaffAction      from '../../../../../lib/models/StaffAction.js'
import { assertObjectId, sanitizeString } from '../../../../../lib/validate.js'

export async function POST(request, { params }) {
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

  const { new_rank } = body
  const reason = sanitizeString(body.reason, 500)

  if (!reason) {
    return apiError('reason is required and must be a non-empty string', 400)
  }
  if (
    typeof new_rank !== 'number' ||
    !Number.isInteger(new_rank) ||
    new_rank < 1 ||
    new_rank > 9999
  ) {
    return apiError('new_rank must be a positive integer between 1 and 9999', 400)
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
      reason,
    })

    doc.status = 'overridden'
    await doc.save()

    const plain      = doc.toObject()
    const sanitized  = Object.fromEntries(
      Object.entries(plain).filter(([k]) => !['_id', 'uid', '__v'].includes(k))
    )
    return Response.json({ case: { id: plain._id.toString(), ...sanitized } })
  } catch (err) {
    console.error('[cases/override]', err.message)
    return apiError('Internal server error', 500)
  }
}
