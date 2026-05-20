// Login page — split layout, email/password + Google OAuth via Firebase
'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { getFirebaseAuth } from '../../../lib/firebase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

const inputStyle = {
  width: '100%',
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 0,
  padding: '10px 12px',
  color: 'var(--ink)',
  outline: 'none',
  marginBottom: '0.75rem',
}

const LEFT_STATS = [
  { number: '< 30s', label: 'triage time' },
  { number: '100%', label: 'transparent scoring' },
  { number: 'Zero', label: 'paperwork missed' },
  { number: 'Free', label: 'for legal aid' },
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

  async function handleEmail(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : err.message)
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true)
    setError('')
    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
      router.push('/dashboard')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <div style={{ width: '45%', background: 'var(--ink)', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)', fontSize: '20px' }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: '#fff' }}>JusticeQueue</span>
        </div>

        <div>
          <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '22px', color: '#fff', lineHeight: 1.55, marginBottom: '1rem' }}>
            &ldquo;The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.&rdquo;
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9a9187', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            — Legal Aid Director
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {LEFT_STATS.map(({ number, label }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#fff', lineHeight: 1 }}>{number}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9a9187', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: 'var(--bg)', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '30px', color: 'var(--ink)', marginBottom: '0.5rem' }}>Welcome back</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-3)', marginBottom: '2rem' }}>Sign in to access your clinic&apos;s triage queue</p>

        <form onSubmit={handleEmail}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: '1rem' }}
          />
          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--stamp)', marginBottom: '0.75rem' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--stamp)', color: '#fff', border: 'none', borderRadius: 0, padding: '11px', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-raised)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 0, padding: '11px', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          Continue with Google
        </button>

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', marginTop: '1.5rem', textAlign: 'center' }}>
          Need access?{' '}
          <a href="mailto:admin@justicequeue.org" style={{ color: 'var(--stamp)' }}>Request from your clinic admin</a>
        </p>
      </div>
    </div>
  )
}
