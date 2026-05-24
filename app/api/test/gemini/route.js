// GET /api/test/gemini — quick Gemini 3.1 connectivity check
// Confirmed working: aiplatform.googleapis.com/v1/projects/{project}/locations/global
import { testGemini } from '../../../../lib/gemini.js'

export async function GET() {
  const result = await testGemini()
  return Response.json(result, { status: result.ok ? 200 : 500 })
}
