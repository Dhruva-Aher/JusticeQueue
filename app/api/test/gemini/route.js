// GET /api/test/gemini — diagnostic: test Vertex AI connectivity via REST + OAuth
import { UserRefreshClient } from 'google-auth-library'

export async function GET() {
  const project      = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  const location     = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'

  const envCheck = {
    GOOGLE_CLOUD_PROJECT_ID:    project      ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_ID:     clientId     ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken ? '✓ set' : '✗ MISSING',
  }

  if (!project || !clientId || !clientSecret || !refreshToken) {
    return Response.json({ ok: false, stage: 'env_check', env: envCheck }, { status: 500 })
  }

  // Step 1 — get access token
  let token
  try {
    const authClient = new UserRefreshClient({ clientId, clientSecret, refreshToken })
    const result = await authClient.getAccessToken()
    token = result.token
    if (!token) throw new Error('getAccessToken returned null token')
  } catch (err) {
    return Response.json({ ok: false, stage: 'get_access_token', error: err.message, env: envCheck }, { status: 500 })
  }

  // Step 2 — call Vertex AI REST API
  try {
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.0-flash-001:generateContent`
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return Response.json({ ok: false, stage: 'vertex_api', status: res.status, error: errText, env: envCheck }, { status: 500 })
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return Response.json({ ok: true, response: text?.trim(), env: envCheck })
  } catch (err) {
    return Response.json({ ok: false, stage: 'fetch', error: err.message, env: envCheck }, { status: 500 })
  }
}
