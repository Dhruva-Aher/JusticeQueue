// GET /api/demo/queue — fetch top 5 live pending cases, no auth required.
export const dynamic = 'force-dynamic'

import { connectDB } from '../../../../lib/mongodb.js'
import Case          from '../../../../lib/models/Case.js'

export async function GET() {
  try {
    await connectDB()
    const docs = await Case.find({ status: 'pending' })
                           .sort({ priority_score: -1 })
                           .limit(5)
                           .lean()

    const cases = docs.map((doc, i) => ({
      id:                  doc._id.toString(),
      rank:                i + 1,
      client_name:         doc.client_name,
      case_type:           doc.case_type,
      summary:             doc.summary,
      deadline_days:       doc.deadline_days,
      vulnerability_flags: doc.vulnerability_flags,
      priority_score:      doc.priority_score,
      score_breakdown:     doc.score_breakdown,
      priority_reason:     doc.priority_reason,
      recommendation:      doc.recommendation,
      similar_cases:       doc.similar_cases,
      missing_info:        doc.missing_info,
      status:              doc.status,
      createdAt:           doc.createdAt,
      outreach:            doc.outreach,
      calendar:            doc.calendar,
      brief:               doc.brief,
      agent_trace:         doc.agent_trace,
      mongodb_via:         doc.mongodb_via,
    }))

    return Response.json({ cases, demo: true })
  } catch (err) {
    console.error('[/api/demo/queue]', err.message)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
