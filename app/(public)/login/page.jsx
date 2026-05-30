'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { getFirebaseAuth } from '../../../lib/firebase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')  // replace not push — prevents back-button loop
    }
  }, [user, loading, router])

  function authError(code) {
    const MAP = {
      'auth/invalid-credential':      'Incorrect email or password.',
      'auth/user-not-found':          'No account found with this email.',
      'auth/wrong-password':          'Incorrect password. Please try again.',
      'auth/invalid-email':           'Please enter a valid email address.',
      'auth/user-disabled':           'This account has been disabled. Contact your admin.',
      'auth/too-many-requests':       'Too many failed attempts. Try again in a few minutes.',
      'auth/network-request-failed':  'Network error. Check your connection and try again.',
      'auth/operation-not-allowed':   'This sign-in method is not enabled. Contact your admin.',
      'auth/unauthorized-domain':     'Sign-in is not authorised from this domain. Contact your admin.',
      'auth/popup-blocked':           'Pop-up was blocked by your browser. Allow pop-ups and try again.',
    }
    return MAP[code] || 'Sign-in failed. Please check your details and try again.'
  }

  async function handleEmail(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const auth = getFirebaseAuth()
      const cred = await signInWithEmailAndPassword(auth, email, password)
      // Fire-and-forget profile upsert — do NOT await
      cred.user.getIdToken().then((token) =>
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: cred.user.displayName || email.split('@')[0], provider: 'email' }),
        })
      ).catch(() => {})
      // Do NOT router.push here — onAuthStateChanged fires → useEffect above redirects
    } catch (err) {
      setError(authError(err.code))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true); setError('')
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      cred.user.getIdToken().then((token) =>
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: cred.user.displayName || cred.user.email.split('@')[0], provider: 'google' }),
        })
      ).catch(() => {})
      // Do NOT router.push here — useEffect handles redirect
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(authError(err.code))
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms',
    display: 'block',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', marginBottom: '2.5rem', textDecoration: 'none' }}>
          <div style={{
            width: '28px', height: '28px', background: 'var(--accent)',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '14px', color: '#fff' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            JusticeQueue
          </span>
        </a>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '2rem',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: '22px', fontWeight: 700,
            color: 'var(--text)', marginBottom: '6px', letterSpacing: '-0.03em',
          }}>
            Welcome back
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)', marginBottom: '1.75rem' }}>
            Sign in to your clinic&apos;s triage queue
          </p>

          <form onSubmit={handleEmail} noValidate>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="email" placeholder="Email address" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password" placeholder="Password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(232,68,68,0.08)', border: '1px solid rgba(232,68,68,0.25)',
                borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: '14px',
              }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--urgent)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.65 : 1, transition: 'opacity 150ms',
                letterSpacing: '-0.01em',
              }}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleGoogle} disabled={busy}
            style={{
              width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
              background: 'var(--bg-raised)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '10px', cursor: 'pointer', fontWeight: 500,
              opacity: busy ? 0.65 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'border-color 150ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginTop: '1.5rem', textAlign: 'center' }}>
            Don&apos;t have an account?{' '}
            <a href="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create one</a>
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginTop: '0.5rem', textAlign: 'center' }}>
            Need help?{' '}
            <a href="mailto:admin@justicequeue.org" style={{ color: 'var(--text-2)' }}>Contact your clinic admin</a>
          </p>
        </div>
      </div>
    </div>
  )
}
