// GET /api/test/gemini — diagnostic: test Vertex AI connectivity via REST + OAuth
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

  // Step 1 — exchange refresh token for access token via Google token endpoint directly
  let token
  try {
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
    if (!res.ok) {
      return Response.json({
        ok: false,
        stage: 'get_access_token',
        error: data.error,
        error_description: data.error_description,
        hint: 'Check that client_id/client_secret match the OAuth client used to generate the refresh token',
        env: envCheck,
      }, { status: 500 })
    }
    token = data.access_token
    if (!token) throw new Error('No access_token returned')
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
