// GET /api/stats/latest-run — return the most recently completed agent run
export const dynamic = 'force-dynamic'

import { connectDB } from '../../../../lib/mongodb.js'
import AgentRun      from '../../../../lib/models/AgentRun.js'

export async function GET() {
  try {
    await connectDB()

    const run = await AgentRun.findOne({ status: 'complete' })
                              .sort({ started_at: -1 })
                              .lean()

    if (!run) {
      return Response.json({ ok: false, error: 'No completed agent runs found' }, { status: 404 })
    }

    return Response.json({ ok: true, run })
  } catch (err) {
    console.error('[/api/stats/latest-run]', err.message)
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
