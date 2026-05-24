// Vertex AI — Gemini fact extraction and recommendations
// Uses OAuth 2.0 user credentials (no service account key required)
// Env vars needed:
//   GOOGLE_CLOUD_PROJECT_ID      — your GCP project ID
//   GOOGLE_OAUTH_CLIENT_ID       — OAuth 2.0 client ID from GCP Console
//   GOOGLE_OAUTH_CLIENT_SECRET   — OAuth 2.0 client secret
//   GOOGLE_OAUTH_REFRESH_TOKEN   — refresh token from OAuth Playground
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,  threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

function getVertexAI() {
  const project       = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientId      = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret  = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken  = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!project || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Vertex AI credentials. Set GOOGLE_CLOUD_PROJECT_ID, ' +
      'GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN.'
    )
  }

  return new VertexAI({
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    googleAuthOptions: {
      // "authorized_user" credentials use your Google account OAuth token —
      // no service account key required, not blocked by org policy.
      credentials: {
        type:          'authorized_user',
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    },
  })
}

const EXTRACTION_SYSTEM = `You are a legal intake analyst for a legal aid clinic. Extract structured information from intake documents. Return ONLY valid JSON with no explanation, no markdown fences, no preamble. If a field cannot be determined, use null for strings/numbers or false for booleans.`

const EXTRACTION_SCHEMA = `Extract the following fields from the intake text and return as JSON:
{
  "client_name": "string or null",
  "case_type": "eviction|immigration|wage_theft|custody|employment|other",
  "summary": "1-2 sentence plain English summary of the legal issue",
  "deadline_days": number or null (days until court date, filing deadline, or eviction date),
  "vulnerability_flags": {
    "minor_children": boolean,
    "language_barrier": boolean,
    "medical_condition": boolean
  },
  "missing_info": ["list of critically missing details needed to assess the case"]
}`

const SAFE_DEFAULT = {
  client_name:   null,
  case_type:     'other',
  summary:       'Unable to extract case details.',
  deadline_days: null,
  vulnerability_flags: { minor_children: false, language_barrier: false, medical_condition: false },
  missing_info:  ['Full case description required'],
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function callGemini(modelId, systemPrompt, userMessage, retries = 2, timeoutMs = null) {
  const vertex = getVertexAI()
  const model  = vertex.getGenerativeModel({
    model: modelId,
    safetySettings: SAFETY_SETTINGS,
    systemInstruction: { parts: [{ text: systemPrompt }] },
  })

  const attempt = async () => {
    const req = model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    })
    let result
    if (timeoutMs) {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs)
      )
      result = await Promise.race([req, timeout])
    } else {
      result = await req
    }
    return result.response.candidates[0].content.parts[0].text
  }

  let lastErr
  for (let i = 0; i <= retries; i++) {
    try { return await attempt() }
    catch (err) { lastErr = err; if (i < retries) await sleep(1000) }
  }
  throw lastErr
}

export async function extractCaseFacts(rawText) {
  const truncated = rawText.slice(0, 4000)
  const modelId   = process.env.GEMINI_MODEL_FLASH || 'gemini-2.0-flash-001'
  try {
    const response = await callGemini(
      modelId, EXTRACTION_SYSTEM,
      `${EXTRACTION_SCHEMA}\n\n[TEXT]: ${truncated}`
    )
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    return {
      client_name:   parsed.client_name  ?? null,
      case_type:     parsed.case_type    ?? 'other',
      summary:       parsed.summary      ?? '',
      deadline_days: typeof parsed.deadline_days === 'number' ? parsed.deadline_days : null,
      vulnerability_flags: {
        minor_children:    Boolean(parsed.vulnerability_flags?.minor_children),
        language_barrier:  Boolean(parsed.vulnerability_flags?.language_barrier),
        medical_condition: Boolean(parsed.vulnerability_flags?.medical_condition),
      },
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
    }
  } catch { return SAFE_DEFAULT }
}

export async function writeRecommendation(extracted, topSimilarCase) {
  const modelId = process.env.GEMINI_MODEL_PRO || 'gemini-1.5-pro-001'
  const systemPrompt = `You are a senior legal aid advisor writing triage recommendations for intake workers at a legal aid clinic. Be direct, practical, and specific. No hedging language. 2-3 sentences maximum.`
  const similarContext = topSimilarCase
    ? `Most similar past case: ${topSimilarCase.case_type} (${topSimilarCase.outcome}) — ${topSimilarCase.outcome_notes}`
    : 'No closely matching past cases found.'
  const flags = Object.entries(extracted.vulnerability_flags || {})
    .filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'none'
  const message = `Case type: ${extracted.case_type}
Deadline: ${extracted.deadline_days != null ? extracted.deadline_days + ' days' : 'unknown'}
Summary: ${extracted.summary}
Vulnerability flags: ${flags}
${similarContext}

Write a brief triage recommendation for the intake worker.`
  try { return await callGemini(modelId, systemPrompt, message, 1, 10000) }
  catch { return 'Review this case manually. Insufficient context for automated recommendation.' }
}

export async function testGemini() {
  try {
    const result = await callGemini(
      process.env.GEMINI_MODEL_FLASH || 'gemini-2.0-flash-001',
      'You are a test assistant.', 'Reply with the single word: OK', 0
    )
    return { ok: true, response: result.trim() }
  } catch (err) { return { ok: false, error: err.message } }
}
