// POST /api/intake/upload — parse file, run agent orchestrator, persist cases
export const maxDuration = 60   // Vercel hobby-plan max; increase to 300 on Pro

import { verifyToken }      from '../../../../lib/verifyToken.js'
import { rateLimitUpload }  from '../../../../lib/ratelimit.js'
import { apiError }         from '../../../../lib/apiError.js'
import { parseFile }        from '../../../../lib/parser.js'
import { runIntakeAgent }   from '../../../../lib/agent/orchestrator.js'
import { connectDB }        from '../../../../lib/mongodb.js'
import Case                 from '../../../../lib/models/Case.js'

const ALLOWED_TYPES = [
  'text/csv',
  'text/plain',
  'application/pdf',
  'application/vnd.ms-excel',
]
const MAX_SIZE       = 10 * 1024 * 1024   // 10 MB
const CHUNK_SIZE     = 20                 // cases processed in parallel per batch

// Process items in sequential chunks so we stay within Vercel's concurrency
// limits and Gemini/Voyage rate limits, but still parallelise within each chunk.
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
  } catch (err) {
    return apiError(`Unauthorized: ${err.message}`, 401)
  }

  // ── Rate limit (gracefully disabled when Upstash not configured) ─────────
  try {
    const { success } = await rateLimitUpload(decoded.uid)
    if (!success) return apiError('Rate limit exceeded. Try again in 15 minutes.', 429)
  } catch {
    // Upstash error — fail open, continue with upload
  }

  // ── Parse multipart body ─────────────────────────────────────────────────
  let formData
  try {
    formData = await request.formData()
  } catch {
    return apiError('Could not read request body — make sure you are uploading a file', 400)
  }

  const file = formData.get('file')
  if (!file) return apiError('No file attached. Include a file field named "file".', 400)

  const mimetype = file.type || 'text/plain'

  // Normalise browser quirks (some send text/csv as application/octet-stream)
  const effectiveMime = mimetype === 'application/octet-stream'
    ? 'text/plain'
    : mimetype

  if (!ALLOWED_TYPES.includes(effectiveMime)) {
    return apiError(
      `Unsupported file type "${mimetype}". Accepted: CSV, TXT, PDF`,
      415
    )
  }

  let buffer
  try {
    const ab = await file.arrayBuffer()
    buffer   = Buffer.from(ab)
  } catch {
    return apiError('Failed to read file contents', 400)
  }

  if (buffer.length > MAX_SIZE) return apiError('File exceeds 10 MB limit', 413)
  if (buffer.length === 0)      return apiError('File is empty', 400)

  // ── Parse intake records ─────────────────────────────────────────────────
  let intakeTexts
  try {
    intakeTexts = await parseFile(buffer, effectiveMime)
  } catch (err) {
    return apiError(`Failed to parse file: ${err.message}`, 422)
  }

  if (!intakeTexts || intakeTexts.length === 0) {
    return apiError('No intake records found in file. Make sure records are separated by blank lines.', 400)
  }

  // ── Run agent pipeline ───────────────────────────────────────────────────
  // Each runIntakeAgent call handles its own errors internally and never
  // throws — so chunkPromiseAll always resolves.
  let settled
  try {
    settled = await chunkPromiseAll(intakeTexts, runIntakeAgent, CHUNK_SIZE)
  } catch (err) {
    return apiError(`Agent pipeline failed: ${err.message}`, 500)
  }

  // ── Build case documents ─────────────────────────────────────────────────
  const batchId = crypto.randomUUID()
  const now     = new Date()

  const caseDocs = settled
    .map((r, i) => {
      if (r.status === 'rejected') return null
      const {
        extracted, similarCases, score,
        breakdown, reason_string, recommendation, rawText, agent_trace,
      } = r.value
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
        status:            'pending',
        raw_text:          rawText,
        createdAt:         now,
      }
    })
    .filter(Boolean)

  if (caseDocs.length === 0) {
    return apiError('All intake records failed to process. Check that the file contains valid intake text.', 422)
  }

  // ── Persist to MongoDB ───────────────────────────────────────────────────
  let inserted
  try {
    await connectDB()
    // Clear previous cases before inserting new batch — ensures a fresh queue
    await Case.deleteMany({ uid: decoded.uid })
    inserted = await Case.insertMany(caseDocs, { ordered: false })
  } catch (err) {
    console.error('[upload] MongoDB error:', err.message)
    return apiError(`Database error: ${err.message}`, 500)
  }

  // ── Build response queue ─────────────────────────────────────────────────
  const queue = inserted
    .map((doc, i) => ({
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
    }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .map((c, i) => ({ ...c, rank: i + 1 }))

  const failed = settled.filter((r) => r.status === 'rejected').length

  return Response.json({
    batch_id: batchId,
    cases:    queue,
    stats:    { total: intakeTexts.length, processed: caseDocs.length, failed },
  })
}
