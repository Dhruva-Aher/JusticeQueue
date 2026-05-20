// POST /api/intake/upload — parse file, extract facts, score urgency, persist cases
import { verifyToken } from '../../../../lib/verifyToken.js'
import { rateLimitUpload } from '../../../../lib/ratelimit.js'
import { apiError } from '../../../../lib/apiError.js'
import { parseFile } from '../../../../lib/parser.js'
import { extractCaseFacts } from '../../../../lib/gemini.js'
import { findSimilarCases } from '../../../../lib/vectorSearch.js'
import { computeScore } from '../../../../lib/urgencyScore.js'
import { writeRecommendation } from '../../../../lib/gemini.js'
import { connectDB } from '../../../../lib/mongodb.js'
import Case from '../../../../lib/models/Case.js'

const ALLOWED_TYPES = ['text/csv', 'text/plain', 'application/pdf', 'application/vnd.ms-excel']
const MAX_SIZE = 10 * 1024 * 1024

async function processIntake(rawText) {
  const extracted = await extractCaseFacts(rawText)
  const similarCases = await findSimilarCases(extracted.summary)
  const { score, breakdown, reason_string } = computeScore(extracted, similarCases)
  return { extracted, similarCases, score, breakdown, reason_string, rawText }
}

async function chunkPromiseAll(items, fn, size) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const settled = await Promise.allSettled(chunk.map(fn))
    results.push(...settled)
  }
  return results
}

export async function POST(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  const { success } = await rateLimitUpload(decoded.uid)
  if (!success) return apiError('Rate limit exceeded. Try again in 15 minutes.', 429)

  let formData
  try {
    formData = await request.formData()
  } catch {
    return apiError('Invalid form data', 400)
  }

  const file = formData.get('file')
  if (!file) return apiError('No file provided', 400)

  const mimetype = file.type
  if (!ALLOWED_TYPES.includes(mimetype)) {
    return apiError('Invalid file type. Accepted: CSV, TXT, PDF', 400)
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (buffer.length > MAX_SIZE) return apiError('File exceeds 10MB limit', 400)

  let intakeTexts
  try {
    intakeTexts = await parseFile(buffer, mimetype)
  } catch {
    return apiError('Failed to parse file', 422)
  }

  if (intakeTexts.length === 0) return apiError('No intake records found in file', 400)

  const settled = await chunkPromiseAll(intakeTexts, processIntake, 5)

  const batchId = crypto.randomUUID()
  const now = new Date()

  const caseDocs = settled
    .map((r, i) => {
      if (r.status === 'rejected') return null
      const { extracted, similarCases, score, breakdown, reason_string, rawText } = r.value
      return {
        uid: decoded.uid,
        batch_id: batchId,
        client_name: extracted.client_name || `Intake #${i + 1}`,
        case_type: extracted.case_type,
        summary: extracted.summary,
        deadline_days: extracted.deadline_days,
        vulnerability_flags: extracted.vulnerability_flags,
        missing_info: extracted.missing_info,
        priority_score: score,
        score_breakdown: breakdown,
        priority_reason: reason_string,
        similar_cases: similarCases,
        recommendation: '',
        status: 'pending',
        raw_text: rawText,
        createdAt: now,
      }
    })
    .filter(Boolean)

  // Write recommendations only for top 3 by score
  const sorted = [...caseDocs].sort((a, b) => b.priority_score - a.priority_score)
  await Promise.allSettled(
    sorted.slice(0, 3).map(async (doc) => {
      const topSim = doc.similar_cases?.[0] ?? null
      doc.recommendation = await writeRecommendation(
        { case_type: doc.case_type, deadline_days: doc.deadline_days, summary: doc.summary, vulnerability_flags: doc.vulnerability_flags },
        topSim
      )
    })
  )

  await connectDB()
  const inserted = await Case.insertMany(caseDocs)

  const queue = inserted
    .map((doc, i) => ({
      id: doc._id.toString(),
      batch_id: doc.batch_id,
      rank: i + 1,
      client_name: doc.client_name,
      case_type: doc.case_type,
      summary: doc.summary,
      deadline_days: doc.deadline_days,
      vulnerability_flags: doc.vulnerability_flags,
      priority_score: doc.priority_score,
      score_breakdown: doc.score_breakdown,
      priority_reason: doc.priority_reason,
      status: doc.status,
      createdAt: doc.createdAt,
    }))
    .sort((a, b) => b.priority_score - a.priority_score)
    .map((c, i) => ({ ...c, rank: i + 1 }))

  return Response.json({ batch_id: batchId, cases: queue })
}
