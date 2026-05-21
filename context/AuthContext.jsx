'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) { setLoading(false); return }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)  // unblock the UI immediately — don't wait for profile fetch

      if (!firebaseUser) { setProfile(null); return }

      // Load MongoDB profile in background — non-blocking
      firebaseUser.getIdToken().then((token) =>
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      ).then((res) => {
        if (res.ok) return res.json()
      }).then((data) => {
        if (data?.user) setProfile(data.user)
      }).catch(() => { /* profile is optional */ })
    })

    return unsub
  }, [])

  async function signOut() {
    const auth = getFirebaseAuth()
    if (auth) await firebaseSignOut(auth)
    setProfile(null)
  }

  async function saveProfile(firebaseUser, { name, clinic, provider }) {
    const token = await firebaseUser.getIdToken()
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, clinic, provider }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfile(data.user)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, saveProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
