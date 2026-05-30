// GET /api/agent/runs — list all agent runs for the authenticated user
export const dynamic = 'force-dynamic'

import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import AgentRun        from '../../../../lib/models/AgentRun.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  try {
    await connectDB()

    const runs = await AgentRun
      .find({ uid: decoded.uid })
      .sort({ started_at: -1 })
      .limit(20)
      .lean()

    const shaped = runs.map((r) => ({
      run_id:       r.run_id,
      goal:         r.goal,
      status:       r.status,
      started_at:   r.started_at,
      completed_at: r.completed_at,
      duration_ms:  r.duration_ms,
      summary: {
        cases_reviewed:    r.result?.cases_reviewed ?? null,
        critical_cases:    r.result?.critical_cases ?? null,
        urgent_cases:      r.result?.urgent_cases ?? null,
        recommendations:   r.result?.recommendations_count ?? null,
        court_opinions:    r.result?.court_opinions_count ?? null,
        missing_documents: r.result?.missing_documents ?? null,
      },
    }))

    return Response.json({ runs: shaped })
  } catch (err) {
    console.error('[agent/runs GET]', err.message)
    return apiError('Internal server error', 500)
  }
}
