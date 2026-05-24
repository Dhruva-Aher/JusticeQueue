// GET /api/test/gemini — diagnostic: test Vertex AI connectivity (no auth required)
// Returns the raw error so we can debug credential issues
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai'

export async function GET() {
  const project      = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  const envCheck = {
    GOOGLE_CLOUD_PROJECT_ID:     project      ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_ID:      clientId     ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_SECRET:  clientSecret ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_REFRESH_TOKEN:  refreshToken ? '✓ set' : '✗ MISSING',
  }

  if (!project || !clientId || !clientSecret || !refreshToken) {
    return Response.json({ ok: false, stage: 'env_check', env: envCheck }, { status: 500 })
  }

  let vertex
  try {
    vertex = new VertexAI({
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      googleAuthOptions: {
        credentials: {
          type:          'authorized_user',
          client_id:     clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      },
    })
  } catch (err) {
    return Response.json({ ok: false, stage: 'vertexai_init', error: err.message, env: envCheck }, { status: 500 })
  }

  try {
    const model = vertex.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT,  threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
    })
    const text = result.response.candidates[0].content.parts[0].text
    return Response.json({ ok: true, response: text.trim(), env: envCheck })
  } catch (err) {
    return Response.json({
      ok: false,
      stage: 'generate_content',
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
      env: envCheck,
    }, { status: 500 })
  }
}
