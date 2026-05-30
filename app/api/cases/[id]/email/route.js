// GET  /api/cases/:id/email — return outreach draft content
// POST /api/cases/:id/email — create Gmail draft
// PATCH /api/cases/:id/email — send the draft
import { verifyToken }     from '../../../../../lib/verifyToken.js'
import { apiError }        from '../../../../../lib/apiError.js'
import { connectDB }       from '../../../../../lib/mongodb.js'
import Case                from '../../../../../lib/models/Case.js'
import { createGmailDraft, sendGmailDraft } from '../../../../../lib/gmail.js'
import { assertObjectId }  from '../../../../../lib/validate.js'

export async function GET(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  try {
    await connectDB()
    const doc = await Case.findById(params.id).lean()
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    return Response.json({ outreach: doc.outreach ?? null })
  } catch (err) {
    console.error('[email GET]', err.message)
    return apiError('Internal server error', 500)
  }
}

export async function POST(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  let body
  try { body = await request.json() }
  catch { return apiError('Invalid JSON body', 400) }

  const { to } = body   // caller provides recipient address
  if (!to || typeof to !== 'string') return apiError('to (email address) is required', 400)

  try {
    await connectDB()
    const doc = await Case.findById(params.id)
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    if (doc.outreach?.status === 'sent') return apiError('Already sent', 409)

    const subject = doc.outreach?.subject || `Re: Your legal aid request`
    const content = doc.outreach?.body || ''

    const draft = await createGmailDraft(to, subject, content)
    if (!draft.skipped) {
      await Case.updateOne(
        { _id: doc._id },
        { $set: { 'outreach.draft_id': draft.id } }
      )
    }

    return Response.json({ draft_id: draft.id, subject, body: content })
  } catch (err) {
    console.error('[email POST]', err.message)
    return apiError('Failed to create draft — please try again', 500)
  }
}

export async function PATCH(request, { params }) {
  try { assertObjectId(params.id) } catch { return apiError('Invalid case ID', 400) }

  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  try {
    await connectDB()
    const doc = await Case.findById(params.id)
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    if (!doc.outreach?.draft_id) return apiError('No draft exists — create one first', 400)
    if (doc.outreach?.status === 'sent') return apiError('Already sent', 409)

    await sendGmailDraft(doc.outreach.draft_id)
    const sent_at = new Date()
    await Case.updateOne(
      { _id: doc._id },
      { $set: { 'outreach.status': 'sent', 'outreach.sent_at': sent_at } }
    )

    return Response.json({ sent: true, sent_at })
  } catch (err) {
    console.error('[email PATCH]', err.message)
    return apiError('Failed to send email — please try again', 500)
  }
}
