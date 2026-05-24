// GET /api/test/gemini — diagnostic: test Gemini 3.1 via API key
export async function GET() {
  const apiKey  = process.env.GEMINI_API_KEY
  const envCheck = { GEMINI_API_KEY: apiKey ? '✓ set' : '✗ MISSING' }

  if (!apiKey) {
    return Response.json({ ok: false, stage: 'env_check', env: envCheck }, { status: 500 })
  }

  const candidates = ['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.0-flash', 'gemini-1.5-flash-001']
  const results = {}

  for (const modelId of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        results[modelId] = `${res.status}: ${t.slice(0, 150)}`
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
