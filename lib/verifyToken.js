// firebase-admin token verification — verifyToken(request) → decoded token or throws
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function verifyToken(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    throw new Error('Missing authorization token')
  }

  const app = getAdminApp()
  const decoded = await getAuth(app).verifyIdToken(token)
  return decoded
}
