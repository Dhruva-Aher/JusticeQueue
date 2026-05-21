// Client-side Firebase initialization — exports auth object (lazy, browser-only)
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            "AIzaSyCwN3x0KjXOwY_28p4rrOk9h9VfpYCwfu8",
  authDomain:        "justicequeue.firebaseapp.com",
  projectId:         "justicequeue",
  storageBucket:     "justicequeue.firebasestorage.app",
  messagingSenderId: "515585521541",
  appId:             "1:515585521541:web:abfee4920f98fe810876ec",
  measurementId:     "G-73EC9HDK82",
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
