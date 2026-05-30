// GET /api/agent/runs/:runId — full run detail including steps and results
export const dynamic = 'force-dynamic'

import { verifyToken } from '../../../../../lib/verifyToken.js'
import { apiError }    from '../../../../../lib/apiError.js'
import { connectDB }   from '../../../../../lib/mongodb.js'
import AgentRun        from '../../../../../lib/models/AgentRun.js'

export async function GET(request, { params }) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  const { runId } = params
  if (!runId || runId.length > 64) return apiError('Invalid run ID', 400)

  try {
    await connectDB()

    const run = await AgentRun.findOne({ run_id: runId, uid: decoded.uid }).lean()
    if (!run) return apiError('Run not found', 404)

    return Response.json({ run })
  } catch (err) {
    console.error('[agent/runs/id GET]', err.message)
    return apiError('Internal server error', 500)
  }
}
