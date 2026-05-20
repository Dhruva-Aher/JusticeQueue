// GET /api/health — liveness check, no auth required
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
