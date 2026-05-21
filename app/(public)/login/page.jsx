'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { getFirebaseAuth } from '../../../lib/firebase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

const STATS = [
  { n: '< 30s', label: 'Intake to ranked queue' },
  { n: '100%', label: 'Transparent scoring' },
  { n: '4+',   label: 'Legal case types' },
  { n: 'Free', label: 'For legal aid clinics' },
]

export default function LoginPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
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
    }
    return MAP[code] || 'Sign-in failed. Please check your details and try again.'
  }

  async function handleEmail(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const auth = getFirebaseAuth()
      const cred = await signInWithEmailAndPassword(auth, email, password)
      // Record last login — fire and forget, do NOT await
      cred.user.getIdToken().then((token) =>
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: cred.user.displayName || email.split('@')[0], provider: 'email' }),
        })
      ).catch(() => {})
      router.push('/dashboard')
    } catch (err) {
      setError(authError(err.code))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true); setError('')
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      // Upsert profile — fire and forget
      cred.user.getIdToken().then((token) =>
        fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: cred.user.displayName || cred.user.email.split('@')[0], provider: 'google' }),
        })
      ).catch(() => {})
      router.push('/dashboard')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(authError(err.code))
      setBusy(false)
    }
  }

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '3px', padding: '11px 13px', color: 'var(--text)',
    outline: 'none', marginBottom: '10px', transition: 'border-color 150ms',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Left panel */}
      <div style={{
        width: '42%', minWidth: '340px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        padding: '3rem',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--text)' }}>JusticeQueue</span>
        </div>

        <div>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '20px', color: 'var(--text)', lineHeight: 1.65, marginBottom: '1rem' }}>
            &ldquo;The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.&rdquo;
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            — Legal Aid Director
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {STATS.map(({ n, label }) => (
            <div key={label} style={{ padding: '1rem', background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--gold)', lineHeight: 1, marginBottom: '4px' }}>{n}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
            Welcome back
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', marginBottom: '2rem' }}>
            Sign in to access your clinic&apos;s triage queue
          </p>

          <form onSubmit={handleEmail}>
            <input
              type="email" placeholder="Email address" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <input
              type="password" placeholder="Password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, marginBottom: '14px' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            {error && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--urgent)', marginBottom: '12px' }}>
                {error}
              </p>
            )}
            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                background: 'var(--gold)', color: '#000', border: 'none',
                borderRadius: '3px', padding: '12px', cursor: 'pointer',
                fontWeight: 700, opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.06em' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleGoogle} disabled={busy}
            style={{
              width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
              background: 'var(--bg-raised)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: '3px',
              padding: '11px', cursor: 'pointer', fontWeight: 500,
              opacity: busy ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
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
            <a href="/register" style={{ color: 'var(--gold)', fontWeight: 500 }}>Create one</a>
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginTop: '0.5rem', textAlign: 'center' }}>
            Need help?{' '}
            <a href="mailto:admin@justicequeue.org" style={{ color: 'var(--text-2)' }}>
              Contact your clinic admin
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
