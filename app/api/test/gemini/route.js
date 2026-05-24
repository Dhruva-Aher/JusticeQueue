// GET /api/test/gemini — diagnostic: tries every known Vertex AI endpoint + model combo
export async function GET() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  const project      = process.env.GOOGLE_CLOUD_PROJECT_ID || 'justice-queue-497013'
  const location     = process.env.GOOGLE_CLOUD_LOCATION   || 'us-central1'

  const envCheck = {
    GOOGLE_OAUTH_CLIENT_ID:     clientId     ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret ? '✓ set' : '✗ MISSING',
    GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken ? '✓ set' : '✗ MISSING',
    GOOGLE_CLOUD_PROJECT_ID:    project,
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
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok) return Response.json({ ok: false, stage: 'get_access_token', error: data.error, error_description: data.error_description }, { status: 500 })
    token = data.access_token
  } catch (err) {
    return Response.json({ ok: false, stage: 'get_access_token', error: err.message }, { status: 500 })
  }

  const results = {}

  // Try multiple regions × models — find what this project actually has access to
  const regions = ['us-central1', 'us-east4', 'us-west1', 'europe-west1', 'asia-northeast1']
  const models  = ['gemini-3.1-flash-lite', 'gemini-2.0-flash-001', 'gemini-1.5-flash-001']

  for (const loc of regions) {
    for (const model of models) {
      for (const ver of ['v1', 'v1beta']) {
        const key = `[${loc}][${ver}] ${model}`
        const url = `https://${loc}-aiplatform.googleapis.com/${ver}/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }] }),
          })
          if (res.status === 404) { results[key] = '404'; continue }
          if (!res.ok) { const t = await res.text(); results[key] = `${res.status}: ${t.slice(0, 100)}`; continue }
          const data = await res.json()
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
          return Response.json({ ok: true, working_model: model, working_version: ver, working_location: loc, response: text?.trim(), all_results: results })
        } catch (err) { results[key] = err.message }
      }
    }
  }

  return Response.json({ ok: false, message: 'No region/model combo worked', results }, { status: 500 })
}
