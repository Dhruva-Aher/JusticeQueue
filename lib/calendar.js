// Google Calendar API helpers — create and delete events via OAuth 2.0 bearer token
// Requires CALENDAR_ENABLED=true and a refresh token scoped with calendar.events
import { getAccessToken } from './gemini.js'

export async function createCalendarEvent(caseData, customDate = null) {
  if (!process.env.CALENDAR_ENABLED || process.env.CALENDAR_ENABLED !== 'true') {
    console.log('[JusticeQueue] Calendar disabled — set CALENDAR_ENABLED=true')
    return { id: 'disabled', htmlLink: null, skipped: true }
  }

  const accessToken = await getAccessToken()

  // Schedule for 9am tomorrow (or customDate if provided)
  const start = customDate ? new Date(customDate) : (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  })()

  const end = new Date(start)
  end.setHours(start.getHours() + 1, 0, 0, 0)

  const breakdown = caseData.urgency_breakdown || caseData.score_breakdown || {}
  const description = [
    `Case type: ${caseData.case_type}`,
    `Priority score: ${caseData.priority_score}/100`,
    ``,
    `Summary:`,
    caseData.extracted?.summary || 'No summary available',
    ``,
    `Scoring breakdown:`,
    `  Deadline:      ${breakdown.deadline_points || 0} pts`,
    `  Vulnerability: ${breakdown.vulnerability_points || 0} pts`,
    `  Case type:     ${breakdown.case_type_points || 0} pts`,
    `  Precedent:     ${breakdown.similarity_points || 0} pts`,
    ``,
    `Missing documents: ${caseData.extracted?.missing_info?.join(', ') || 'None'}`,
    ``,
    `Scheduled automatically by JusticeQueue`,
  ].join('\n')

  const event = {
    summary: `[JQ] ${caseData.case_type.replace('_', ' ')} — Priority ${caseData.priority_score}`,
    description,
    start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
    end:   { dateTime: end.toISOString(),   timeZone: 'America/New_York' },
    colorId: caseData.priority_score >= 80 ? '11' : '5',
    // 11 = Tomato (urgent), 5 = Banana (medium)
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!response.ok) {
    const err = await response.json()
    throw new Error(`Calendar event failed: ${err.error?.message || 'unknown'}`)
  }

  return response.json()
}

export async function deleteCalendarEvent(eventId) {
  const accessToken = await getAccessToken()

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  )

  if (!response.ok && response.status !== 404) {
    throw new Error('Calendar event deletion failed')
  }
}
