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

  // Step 2 — try models in order until one responds
  const candidates = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-001',
    'gemini-1.5-pro-001',
  ]

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
      if (res.status === 404) { results[modelId] = '404 not found'; continue }
      if (!res.ok) {
        const errText = await res.text()
        results[modelId] = `${res.status}: ${errText.slice(0, 200)}`
        continue
      }
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      return Response.json({ ok: true, working_model: modelId, response: text?.trim(), all_results: results, env: envCheck })
    } catch (err) {
      results[modelId] = `fetch error: ${err.message}`
    }
  }

  return Response.json({ ok: false, stage: 'vertex_api', message: 'No models responded successfully', results, env: envCheck }, { status: 500 })
}
