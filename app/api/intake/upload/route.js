// POST /api/intake/upload — parse file, run agent orchestrator, persist cases
// Deduplication logic:
//   - Already processed case (same raw_text, score > 5) → skip, keep existing
//   - Previously failed case (SAFE_DEFAULT, score ≤ 5)  → delete + retry
//   - New case (no matching raw_text)                   → process + insert
export const maxDuration = 60   // Vercel hobby-plan max

import { verifyToken }           from '../../../../lib/verifyToken.js'
import { rateLimitUpload }       from '../../../../lib/ratelimit.js'
import { apiError }              from '../../../../lib/apiError.js'
import { parseFile }             from '../../../../lib/parser.js'
import { runIntakeAgent }        from '../../../../lib/agent/orchestrator.js'
import { generateOutreachEmail } from '../../../../lib/draftEmail.js'
import { createCalendarEvent }   from '../../../../lib/calendar.js'
import { generateBriefContent }  from '../../../../lib/caseBrief.js'
import { connectDB }             from '../../../../lib/mongodb.js'
import Case                      from '../../../../lib/models/Case.js'

const ALLOWED_TYPES  = ['text/csv', 'text/plain', 'application/pdf', 'application/vnd.ms-excel']
const MAX_SIZE       = 10 * 1024 * 1024   // 10 MB
const CHUNK_SIZE     = 20
const EMAIL_CHUNK    = 5
const FAILED_SUMMARY = 'Unable to extract case details.'

// Fingerprint for deduplication — first 300 chars of trimmed text
function fingerprint(text) { return text.trim().slice(0, 300) }

async function chunkPromiseAll(items, fn, size) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    const chunk   = items.slice(i, i + size)
    const settled = await Promise.allSettled(chunk.map(fn))
    results.push(...settled)
  }
  return results
}

export async function POST(request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  // ── Rate limit ───────────────────────────────────────────────────────────
  try {
    const { success } = await rateLimitUpload(decoded.uid)
    if (!success) return apiError('Rate limit exceeded. Try again in 15 minutes.', 429)
  } catch { /* fail open */ }

  // ── Parse multipart body ─────────────────────────────────────────────────
  let formData
  try { formData = await request.formData() }
  catch { return apiError('Could not read request body', 400) }

  const file = formData.get('file')
  if (!file) return apiError('No file attached. Include a file field named "file".', 400)

  const mimetype      = file.type || 'text/plain'
  const effectiveMime = mimetype === 'application/octet-stream' ? 'text/plain' : mimetype

  if (!ALLOWED_TYPES.includes(effectiveMime)) {
    return apiError(`Unsupported file type "${mimetype}". Accepted: CSV, TXT, PDF`, 415)
  }

  let buffer
  try { const ab = await file.arrayBuffer(); buffer = Buffer.from(ab) }
  catch { return apiError('Failed to read file contents', 400) }

  if (buffer.length > MAX_SIZE) return apiError('File exceeds 10 MB limit', 413)
  if (buffer.length === 0)      return apiError('File is empty', 400)

  // ── Parse intake records ─────────────────────────────────────────────────
  let intakeTexts
  try { intakeTexts = await parseFile(buffer, effectiveMime) }
  catch (err) {
    console.error('[upload] Parse error:', err.message)
    return apiError('Failed to parse file — check the format (CSV, TXT, or PDF) and try again', 422)
  }

  if (!intakeTexts?.length) {
    return apiError('No intake records found. Separate records with blank lines.', 400)
  }

  // ── Deduplication — check existing cases for this user ───────────────────
  await connectDB()

  const existingCases = await Case.find(
    { uid: decoded.uid },
    { raw_text: 1, summary: 1, priority_score: 1 }
  ).lean()

  // Split existing into: processed (keep) vs failed (retry)
  const processedFPs  = new Set()   // fingerprints of successfully processed cases
  const failedIds     = []          // _ids of SAFE_DEFAULT cases to delete + retry

  for (const c of existingCases) {
    const fp = fingerprint(c.raw_text || '')
    if (c.summary === FAILED_SUMMARY || (c.priority_score ?? 0) <= 5) {
      failedIds.push(c._id)
    } else {
      processedFPs.add(fp)
    }
  }

  // Delete previously-failed cases so they get retried
  if (failedIds.length > 0) {
    await Case.deleteMany({ _id: { $in: failedIds } })
  }

  // Filter intake: skip already-processed, retry failed, add new
  const textsToProcess = intakeTexts.filter(
    (t) => !processedFPs.has(fingerprint(t))
  )

  if (textsToProcess.length === 0) {
    // All cases already processed — return existing queue
    const existing = await Case.find({ uid: decoded.uid }).sort({ priority_score: -1 }).lean()
    const queue = existing.map((doc, i) => ({
      id: doc._id.toString(), rank: i + 1,
      batch_id: doc.batch_id, client_name: doc.client_name,
      case_type: doc.case_type, summary: doc.summary,
      deadline_days: doc.deadline_days, vulnerability_flags: doc.vulnerability_flags,
      priority_score: doc.priority_score, score_breakdown: doc.score_breakdown,
      priority_reason: doc.priority_reason, status: doc.status, createdAt: doc.createdAt,
      outreach: doc.outreach, calendar: doc.calendar, brief: doc.brief,
    }))
    return Response.json({
      batch_id: null, cases: queue,
      stats: {
        total: intakeTexts.length, processed: 0, failed: 0, skipped: intakeTexts.length,
        emails_drafted: 0, calendar_blocks_created: 0, briefs_generated: 0,
      },
    })
  }

  // ── Run agent pipeline on new/failed cases ───────────────────────────────
  let settled
  try {
    settled = await chunkPromiseAll(textsToProcess, runIntakeAgent, CHUNK_SIZE)
  } catch (err) {
    console.error('[upload] Agent pipeline failed:', err.message)
    return apiError('Agent pipeline failed — please try again', 500)
  }

  // ── Build new case documents ──────────────────────────────────────────────
  const batchId = crypto.randomUUID()
  const now     = new Date()

  const caseDocs = settled
    .map((r, i) => {
      if (r.status === 'rejected') return null
      const { extracted, similarCases, score, breakdown, reason_string, recommendation, rawText, agent_trace, mongodb_via, mcp_config } = r.value
      return {
        uid:               decoded.uid,
        batch_id:          batchId,
        client_name:       extracted.client_name || `Intake #${i + 1}`,
        case_type:         extracted.case_type,
        summary:           extracted.summary,
        deadline_days:     extracted.deadline_days,
        vulnerability_flags: extracted.vulnerability_flags,
        missing_info:      extracted.missing_info,
        priority_score:    score,
        score_breakdown:   breakdown,
        priority_reason:   reason_string,
        similar_cases:     similarCases,
        recommendation,
        agent_trace,
        mongodb_via,
        mcp_config,
        status:            'pending',
        raw_text:          rawText,
        createdAt:         now,
      }
    })
    .filter(Boolean)

  if (caseDocs.length === 0) {
    return apiError('All intake records failed to process.', 422)
  }

  // ── Insert new cases (existing processed ones stay untouched) ─────────────
  let inserted
  try {
    inserted = await Case.insertMany(caseDocs, { ordered: false })
  } catch (err) {
    console.error('[upload] MongoDB error:', err.message)
    return apiError('Database error — please try again', 500)
  }

  // ── Draft outreach emails — chunks of 5, non-fatal ───────────────────────
  let emailsDrafted = 0
  const emailInputs = inserted.map((doc, i) => ({
    _id:            doc._id,
    extracted:      caseDocs[i]?.extracted || { client_name: doc.client_name, summary: doc.summary, missing_info: doc.missing_info },
    case_type:      doc.case_type,
    priority_score: doc.priority_score,
  }))

  const emailSettled = await chunkPromiseAll(emailInputs, async (item) => {
    const { subject, body } = await generateOutreachEmail(item)
    await Case.updateOne(
      { _id: item._id },
      { $set: { 'outreach.subject': subject, 'outreach.body': body, 'outreach.status': 'draft' } }
    )
    return true
  }, EMAIL_CHUNK)

  emailsDrafted = emailSettled.filter((r) => r.status === 'fulfilled').length
  emailSettled.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[upload] Email draft failed for case', emailInputs[i]?._id, r.reason?.message)
  })

  // ── Calendar blocks — top 3 by priority score, non-fatal ─────────────────
  let calendarBlocksCreated = 0
  const sortedForCal = [...inserted]
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
    .slice(0, 3)

  await Promise.allSettled(sortedForCal.map(async (doc) => {
    const caseData = {
      _id:               doc._id,
      case_type:         doc.case_type,
      priority_score:    doc.priority_score,
      extracted:         caseDocs.find((c) => c.client_name === doc.client_name) || {},
      urgency_breakdown: doc.score_breakdown,
    }
    try {
      const calEvent = await createCalendarEvent(caseData)
      if (!calEvent.skipped) {
        await Case.updateOne(
          { _id: doc._id },
          { $set: {
            'calendar.event_id':     calEvent.id,
            'calendar.event_link':   calEvent.htmlLink,
            'calendar.scheduled_at': new Date(),
            'calendar.status':       'scheduled',
          }}
        )
        calendarBlocksCreated++
      }
    } catch (err) {
      console.error('[upload] Calendar event failed:', err.message)
      await Case.updateOne({ _id: doc._id }, { $set: { 'calendar.status': 'failed' } })
    }
  }))

  // ── Case briefs — score >= 80 only, non-fatal ─────────────────────────────
  let briefsGenerated = 0
  const briefCandidates = inserted.filter((doc) => (doc.priority_score ?? 0) >= 80)

  await Promise.allSettled(briefCandidates.map(async (doc) => {
    const caseData = {
      case_type:         doc.case_type,
      priority_score:    doc.priority_score,
      extracted:         caseDocs.find((c) => c.client_name === doc.client_name) || {},
      urgency_breakdown: doc.score_breakdown,
      similar_cases:     doc.similar_cases,
      recommendation:    doc.recommendation,
    }
    try {
      const briefContent = await generateBriefContent(caseData)
      await Case.updateOne(
        { _id: doc._id },
        { $set: {
          'brief.available':    true,
          'brief.content':      briefContent,
          'brief.generated_at': new Date(),
        }}
      )
      briefsGenerated++
    } catch (err) {
      console.error('[upload] Brief generation failed:', err.message)
    }
  }))

  // ── Build full queue (new + existing processed) ───────────────────────────
  const allCases = await Case.find({ uid: decoded.uid }).sort({ priority_score: -1 }).lean()
  const queue = allCases.map((doc, i) => ({
    id:              doc._id.toString(),
    batch_id:        doc.batch_id,
    rank:            i + 1,
    client_name:     doc.client_name,
    case_type:       doc.case_type,
    summary:         doc.summary,
    deadline_days:   doc.deadline_days,
    vulnerability_flags: doc.vulnerability_flags,
    priority_score:  doc.priority_score,
    score_breakdown: doc.score_breakdown,
    priority_reason: doc.priority_reason,
    status:          doc.status,
    createdAt:       doc.createdAt,
    outreach:        doc.outreach,
    calendar:        doc.calendar,
    brief:           doc.brief,
  }))

  const skipped = intakeTexts.length - textsToProcess.length
  const failed  = settled.filter((r) => r.status === 'rejected').length

  return Response.json({
    batch_id: batchId,
    cases:    queue,
    stats:    {
      total: intakeTexts.length, processed: inserted.length, failed, skipped,
      emails_drafted: emailsDrafted,
      calendar_blocks_created: calendarBlocksCreated,
      briefs_generated: briefsGenerated,
    },
  })
}
