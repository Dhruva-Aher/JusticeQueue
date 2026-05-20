// Firebase Auth context — provides user, loading, signOut via useAuth() hook
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const firebaseAuth = getFirebaseAuth()
    if (!firebaseAuth) { setLoading(false); return }
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signOut() {
    const firebaseAuth = getFirebaseAuth()
    if (firebaseAuth) await firebaseSignOut(firebaseAuth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
