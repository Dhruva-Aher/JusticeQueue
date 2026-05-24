// DELETE /api/cases/clear — wipe all cases for the current user
import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import Case            from '../../../../lib/models/Case.js'

export async function DELETE(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  try {
    await connectDB()
    const result = await Case.deleteMany({ uid: decoded.uid })
    return Response.json({ deleted: result.deletedCount })
  } catch (err) {
    console.error('[cases/clear]', err.message)
    return apiError('Internal server error', 500)
  }
}
