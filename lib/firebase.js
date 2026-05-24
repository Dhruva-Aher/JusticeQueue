// Client-side Firebase initialization — exports auth object (lazy, browser-only)
// Config comes from NEXT_PUBLIC_FIREBASE_* env vars (set in .env.local and Vercel dashboard)
// Firebase client config is public by design but should not be hardcoded for portability.
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let _auth = null

export function getFirebaseAuth() {
  if (typeof window === 'undefined') return null
  if (_auth) return _auth
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  _auth = getAuth(app)
  return _auth
}

export const auth = {
  get currentUser() { return getFirebaseAuth()?.currentUser ?? null },
}
