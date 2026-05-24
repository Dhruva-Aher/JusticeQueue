// GET /api/test/gemini — diagnostic: OAuth token + generativelanguage.googleapis.com
export async function GET() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN

  const envCheck = {
    GOOGLE_OAUTH_CLIENT_ID:     clientId     ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken ? '✓ set' : '✗ MISSING',
  }

  if (!clientId || !clientSecret || !refreshToken) {
    return Response.json({ ok: false, stage: 'env_check', env: envCheck }, { status: 500 })
  }

  // Step 1 — get access token
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
      return Response.json({ ok: false, stage: 'get_access_token', error: data.error, error_description: data.error_description, env: envCheck }, { status: 500 })
    }
    token = data.access_token
  } catch (err) {
    return Response.json({ ok: false, stage: 'get_access_token', error: err.message, env: envCheck }, { status: 500 })
  }

  // Step 2 — try Gemini 3.1 models via Vertex AI REST API with Bearer token
  // Requires Vertex AI API to be enabled: console.cloud.google.com/apis/library → "Vertex AI API"
  const project  = process.env.GOOGLE_CLOUD_PROJECT_ID || 'justice-queue-497013'
  const location = process.env.GOOGLE_CLOUD_LOCATION  || 'us-central1'
  const candidates = ['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.0-flash', 'gemini-1.5-flash-001']
  const results = {}

  for (const modelId of candidates) {
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${modelId}:generateContent`
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        results[modelId] = `${res.status}: ${t.slice(0, 200)}`
        continue
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      return Response.json({ ok: true, working_model: modelId, response: text?.trim(), env: envCheck })
    } catch (err) {
      results[modelId] = err.message
    }
  }

  return Response.json({ ok: false, message: 'No models worked', results, env: envCheck }, { status: 500 })
}
