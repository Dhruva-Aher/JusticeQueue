// GET /api/auth/me — return current user profile, auto-creating it for Google sign-in
import { verifyToken } from '../../../../lib/verifyToken.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import { apiError }    from '../../../../lib/apiError.js'
import User            from '../../../../lib/models/User.js'

export async function GET(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  try {
    await connectDB()

    // Upsert — auto-create profile for Google OAuth users on first visit
    const user = await User.findOneAndUpdate(
      { uid: decoded.uid },
      {
        $setOnInsert: {
          uid:      decoded.uid,
          email:    decoded.email  ?? '',
          name:     decoded.name   ?? decoded.email ?? 'User',
          provider: 'google',
          role:     'staff',
        },
        $set: { lastLogin: new Date() },
      },
      { upsert: true, new: true, lean: true }
    )

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
  } catch (err) {
    return apiError(err.message, 500)
  }
}
