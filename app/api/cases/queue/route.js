// GET /api/cases/queue — return all cases for user sorted by priority_score desc
import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import Case            from '../../../../lib/models/Case.js'
import { assertUUID }  from '../../../../lib/validate.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const batchId = searchParams.get('batch_id')
  const RAW_LIMIT = parseInt(searchParams.get('limit') || '200', 10)
  const cap = Math.min(Math.max(Number.isFinite(RAW_LIMIT) ? RAW_LIMIT : 200, 1), 500)

  if (batchId) {
    try { assertUUID(batchId) } catch { return apiError('Invalid batch ID', 400) }
  }

  try {
    await connectDB()
    const query = { uid: decoded.uid }
    if (batchId) query.batch_id = batchId

    const docs = await Case.find(query).sort({ priority_score: -1 }).limit(cap).lean()

    const cases = docs.map((doc, i) => ({
      id:               doc._id.toString(),
      rank:             i + 1,
      batch_id:         doc.batch_id,
      client_name:      doc.client_name,
      case_type:        doc.case_type,
      summary:          doc.summary,
      deadline_days:    doc.deadline_days,
      vulnerability_flags: doc.vulnerability_flags,
      priority_score:   doc.priority_score,
      score_breakdown:  doc.score_breakdown,
      priority_reason:  doc.priority_reason,
      missing_info:     doc.missing_info,
      brief:            doc.brief,
      status:           doc.status,
      createdAt:        doc.createdAt,
    }))

    return Response.json({ cases, cap })
  } catch (err) {
    console.error('[cases/queue]', err.message)
    return apiError('Internal server error', 500)
  }
}
