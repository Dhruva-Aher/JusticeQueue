// GET /api/auth/me — return the current user's profile from MongoDB
import { verifyToken } from '../../../../lib/verifyToken.js'
import { connectDB } from '../../../../lib/mongodb.js'
import { apiError } from '../../../../lib/apiError.js'
import User from '../../../../lib/models/User.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  await connectDB()
  const user = await User.findOne({ uid: decoded.uid }).lean()

  if (!user) return apiError('Profile not found', 404)

  return Response.json({
    user: {
      uid:       user.uid,
      email:     user.email,
      name:      user.name,
      clinic:    user.clinic,
      role:      user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  })
}
