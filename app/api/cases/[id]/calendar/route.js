// DELETE /api/cases/:id/calendar — cancel the calendar event
// POST   /api/cases/:id/calendar — reschedule (create new event)
import { verifyToken }        from '../../../../../lib/verifyToken.js'
import { apiError }           from '../../../../../lib/apiError.js'
import { connectDB }          from '../../../../../lib/mongodb.js'
import Case                   from '../../../../../lib/models/Case.js'
import { createCalendarEvent, deleteCalendarEvent } from '../../../../../lib/calendar.js'

export async function DELETE(request, { params }) {
  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  try {
    await connectDB()
    const doc = await Case.findById(params.id)
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)
    if (!doc.calendar?.event_id)        return apiError('No calendar event found', 404)

    await deleteCalendarEvent(doc.calendar.event_id)
    await Case.updateOne({ _id: doc._id }, { $set: { 'calendar.status': 'cancelled' } })
    return Response.json({ cancelled: true })
  } catch (err) {
    console.error('[calendar DELETE]', err.message)
    return apiError('Failed to cancel calendar event — please try again', 500)
  }
}

export async function POST(request, { params }) {
  let decoded
  try { decoded = await verifyToken(request) }
  catch { return apiError('Unauthorized', 401) }

  let body
  try { body = await request.json() }
  catch { return apiError('Invalid JSON body', 400) }

  const { iso_date } = body
  if (!iso_date) return apiError('iso_date is required', 400)

  const parsed = new Date(iso_date)
  if (isNaN(parsed.getTime()) || parsed < new Date()) {
    return apiError('iso_date must be a valid future date', 400)
  }

  try {
    await connectDB()
    const doc = await Case.findById(params.id)
    if (!doc || doc.uid !== decoded.uid) return apiError('Case not found', 404)

    // Delete existing event if present
    if (doc.calendar?.event_id) {
      try { await deleteCalendarEvent(doc.calendar.event_id) } catch { /* non-fatal */ }
    }

    const caseData = {
      case_type:         doc.case_type,
      priority_score:    doc.priority_score,
      extracted:         { summary: doc.summary, missing_info: doc.missing_info },
      urgency_breakdown: doc.score_breakdown,
    }
    const calEvent = await createCalendarEvent(caseData, iso_date)

    const scheduled_at = new Date()
    await Case.updateOne(
      { _id: doc._id },
      { $set: {
        'calendar.event_id':     calEvent.id,
        'calendar.event_link':   calEvent.htmlLink,
        'calendar.scheduled_at': scheduled_at,
        'calendar.status':       'scheduled',
      }}
    )

    return Response.json({
      event_id:     calEvent.id,
      event_link:   calEvent.htmlLink,
      scheduled_at,
    })
  } catch (err) {
    console.error('[calendar POST]', err.message)
    return apiError('Failed to reschedule — please try again', 500)
  }
}
