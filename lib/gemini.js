// Gemini 3.1 via Agent Platform — OAuth 2.0 Bearer token + generativelanguage.googleapis.com
// Uses refresh token to get Bearer token, then calls Gemini API directly.
// This avoids API keys (blocked by org policy) and the Vertex AI API enablement requirement.
//
// Env vars needed:
//   GOOGLE_OAUTH_CLIENT_ID       — OAuth 2.0 client ID from GCP Console
//   GOOGLE_OAUTH_CLIENT_SECRET   — OAuth 2.0 client secret
//   GOOGLE_OAUTH_REFRESH_TOKEN   — refresh token from OAuth Playground
//   GEMINI_MODEL_FLASH           — optional, default: gemini-3.1-flash-lite
//   GEMINI_MODEL_PRO             — optional, default: gemini-3.1-pro-preview

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Exchange refresh token for access token
async function getAccessToken() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing OAuth credentials: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`OAuth token error: ${data.error} — ${data.error_description ?? ''}`)
  if (!data.access_token) throw new Error('No access_token in token response')
  return data.access_token
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',  threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
]

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
  const attempt = async () => {
    const token = await getAccessToken()
    const url   = `${GEMINI_BASE}/${modelId}:generateContent`

    const fetchCall = fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents:          [{ role: 'user', parts: [{ text: userMessage }] }],
        safetySettings:    SAFETY_SETTINGS,
      }),
    })

    const res = timeoutMs
      ? await Promise.race([fetchCall, new Promise((_, r) => setTimeout(() => r(new Error('Gemini timeout')), timeoutMs))])
      : await fetchCall

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')
    return text
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
  const modelId   = process.env.GEMINI_MODEL_FLASH || 'gemini-3.1-flash-lite'
  try {
    const response = await callGemini(modelId, EXTRACTION_SYSTEM, `${EXTRACTION_SCHEMA}\n\n[TEXT]: ${truncated}`)
    const cleaned  = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed   = JSON.parse(cleaned)
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
  } catch (err) {
    console.error('[gemini] extractCaseFacts failed:', err?.message ?? err)
    return SAFE_DEFAULT
  }
}

export async function writeRecommendation(extracted, topSimilarCase) {
  const modelId      = process.env.GEMINI_MODEL_PRO || 'gemini-3.1-pro-preview'
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
      process.env.GEMINI_MODEL_FLASH || 'gemini-3.1-flash-lite',
      'You are a test assistant.', 'Reply with the single word: OK', 0
    )
    return { ok: true, response: result.trim() }
  } catch (err) { return { ok: false, error: err.message } }
}
