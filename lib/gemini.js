// Vertex AI calls — extractCaseFacts (Flash) and writeRecommendation (Pro)
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'
import { GoogleAuth } from 'google-auth-library'

function getVertexAI() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })

  return new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT_ID,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    googleAuthOptions: { authClient: auth },
  })
}

const EXTRACTION_SYSTEM_PROMPT = `You are a legal case analyst. Return only valid JSON, no explanation, no markdown, no preamble.`

const EXTRACTION_SCHEMA = `Extract the following fields from the intake text and return as JSON:
{
  "client_name": "string or null",
  "case_type": "eviction|immigration|wage_theft|custody|employment|other",
  "summary": "1-2 sentence plain English summary",
  "deadline_days": number or null,
  "vulnerability_flags": {
    "minor_children": boolean,
    "language_barrier": boolean,
    "medical_condition": boolean
  },
  "missing_info": ["list of critically missing details needed to assess the case"]
}`

const SAFE_DEFAULT = {
  client_name: null,
  case_type: 'other',
  summary: 'Unable to extract case details.',
  deadline_days: null,
  vulnerability_flags: { minor_children: false, language_barrier: false, medical_condition: false },
  missing_info: ['Full case description required'],
}

async function callGemini(modelId, systemPrompt, userMessage, retries = 1) {
  const vertex = getVertexAI()
  const model = vertex.getGenerativeModel({
    model: modelId,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  })

  try {
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: userMessage }] }] })
    return result.response.candidates[0].content.parts[0].text
  } catch (err) {
    if (retries > 0) return callGemini(modelId, systemPrompt, userMessage, retries - 1)
    throw err
  }
}

export async function extractCaseFacts(rawText) {
  const truncated = rawText.slice(0, 4000)
  const modelId = process.env.GEMINI_MODEL_FLASH || 'gemini-2.0-flash-001'

  try {
    const response = await callGemini(
      modelId,
      EXTRACTION_SYSTEM_PROMPT,
      `${EXTRACTION_SCHEMA}\n\n[TEXT]: ${truncated}`
    )

    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      client_name: parsed.client_name ?? null,
      case_type: parsed.case_type ?? 'other',
      summary: parsed.summary ?? '',
      deadline_days: typeof parsed.deadline_days === 'number' ? parsed.deadline_days : null,
      vulnerability_flags: {
        minor_children: Boolean(parsed.vulnerability_flags?.minor_children),
        language_barrier: Boolean(parsed.vulnerability_flags?.language_barrier),
        medical_condition: Boolean(parsed.vulnerability_flags?.medical_condition),
      },
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
    }
  } catch {
    return SAFE_DEFAULT
  }
}

export async function writeRecommendation(extracted, topSimilarCase) {
  const modelId = process.env.GEMINI_MODEL_PRO || 'gemini-1.5-pro-001'
  const systemPrompt = `You are a legal aid advisor. Write a 2-3 sentence case recommendation for a legal clinic intake worker. Be direct, practical, and specific. No hedging language.`

  const similarContext = topSimilarCase
    ? `Most similar past case: ${topSimilarCase.case_type} (${topSimilarCase.outcome}) — ${topSimilarCase.outcome_notes}`
    : 'No closely matching past cases found.'

  const userMessage = `Case type: ${extracted.case_type}
Deadline: ${extracted.deadline_days != null ? extracted.deadline_days + ' days' : 'unknown'}
Summary: ${extracted.summary}
Flags: ${Object.entries(extracted.vulnerability_flags).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}
${similarContext}

Write a brief recommendation for the intake worker.`

  try {
    return await callGemini(modelId, systemPrompt, userMessage)
  } catch {
    return 'Review this case manually. Insufficient context for automated recommendation.'
  }
}
