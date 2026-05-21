// POST /api/auth/register — create user profile in MongoDB after Firebase signup
import { verifyToken } from '../../../../lib/verifyToken.js'
import { connectDB } from '../../../../lib/mongodb.js'
import { apiError } from '../../../../lib/apiError.js'
import User from '../../../../lib/models/User.js'

export async function POST(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 400)
  }

  const { name, clinic, provider } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return apiError('Name must be at least 2 characters', 400)
  }

  await connectDB()

  // Upsert — safe for Google OAuth (may be called on every sign-in)
  const user = await User.findOneAndUpdate(
    { uid: decoded.uid },
    {
      $setOnInsert: {
        uid:      decoded.uid,
        email:    decoded.email,
        name:     name.trim(),
        clinic:   (clinic || '').trim(),
        provider: provider || 'email',
        role:     'staff',
      },
      $set: { lastLogin: new Date() },
    },
    { upsert: true, new: true }
  )

  return Response.json({
    user: {
      uid:    user.uid,
      email:  user.email,
      name:   user.name,
      clinic: user.clinic,
      role:   user.role,
    },
  })
}
