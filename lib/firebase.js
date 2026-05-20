// Client-side Firebase initialization — exports auth object (lazy, browser-only)
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

let _auth = null

export function getFirebaseAuth() {
  if (typeof window === 'undefined') return null
  if (_auth) return _auth

  const firebaseConfig = {
    apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  _auth = getAuth(app)
  return _auth
}

export const auth = {
  get currentUser() { return getFirebaseAuth()?.currentUser ?? null },
}

