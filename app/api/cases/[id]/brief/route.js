// GET /api/cases/:id/brief — return printable case brief as HTML
// Browser prints to PDF natively — zero dependencies, works on Vercel serverless
import { verifyToken }    from '../../../../../lib/verifyToken.js'
import { apiError }       from '../../../../../lib/apiError.js'
import { connectDB }      from '../../../../../lib/mongodb.js'
import Case               from '../../../../../lib/models/Case.js'
import { buildBriefHTML } from '../../../../../lib/caseBrief.js'
import { assertObjectId } from '../../../../../lib/validate.js'

export async function GET(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  try {
    await connectDB()
    const doc = await Case.findById(params.id).lean()
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)
    if (!doc.brief?.available)           return apiError('No brief available for this case', 404)

    const caseData = {
      case_type:         doc.case_type,
      priority_score:    doc.priority_score,
      summary:           doc.summary,
      extracted: {
        summary:            doc.summary,
        deadline_days:      doc.deadline_days,
        vulnerability_flags: doc.vulnerability_flags,
        missing_info:       doc.missing_info,
      },
      urgency_breakdown: doc.score_breakdown,
      similar_cases:     doc.similar_cases,
      recommendation:    doc.recommendation,
    }

    const html = buildBriefHTML(caseData, doc.brief.content)

    return new Response(html, {
      headers: {
        'Content-Type':        'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="case-brief-${params.id}.html"`,
      },
    })
  } catch (err) {
    console.error('[brief GET]', err.message)
    return apiError('Internal server error', 500)
  }
}
