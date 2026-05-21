'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth'
import { getFirebaseAuth } from '../../../lib/firebase.js'
import { useAuth } from '../../../context/AuthContext.jsx'

// Friendly Firebase error messages
function authError(code) {
  const MAP = {
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/operation-not-allowed':   'Email sign-up is not enabled. Contact your admin.',
  }
  return MAP[code] || 'Something went wrong. Please try again.'
}

export default function RegisterPage() {
  const router = useRouter()
  const { user, loading, saveProfile } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', clinic: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setErrors((err) => ({ ...err, [field]: '' }))
      setGlobalError('')
    }
  }

  function validate() {
    const e = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Full name is required (min 2 characters)'
    if (!form.email.trim()) e.email = 'Email address is required'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (!form.confirm) e.confirm = 'Please confirm your password'
    else if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  async function handleRegister(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setBusy(true)
    setGlobalError('')

    try {
      const auth = getFirebaseAuth()
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password)

      // Set display name in Firebase
      await updateProfile(cred.user, { displayName: form.name.trim() })

      // Persist full profile to MongoDB
      await saveProfile(cred.user, {
        name:     form.name.trim(),
        clinic:   form.clinic.trim(),
        provider: 'email',
      })

      router.push('/dashboard')
    } catch (err) {
      setGlobalError(authError(err.code))
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true)
    setGlobalError('')
    try {
      const auth = getFirebaseAuth()
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      const name = cred.user.displayName || cred.user.email.split('@')[0]

      await saveProfile(cred.user, {
        name,
        clinic:   '',
        provider: 'google',
      })

      router.push('/dashboard')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setGlobalError(authError(err.code))
      setBusy(false)
    }
  }

  const inputStyle = (hasError) => ({
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
    background: 'var(--bg-input)',
    border: `1px solid ${hasError ? 'var(--urgent)' : 'var(--border)'}`,
    borderRadius: '3px', padding: '11px 13px', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms',
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '2.5rem', textDecoration: 'none' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text)' }}>JusticeQueue</span>
        </a>

        {/* Card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text)', marginBottom: '6px', lineHeight: 1.2 }}>
            Create your account
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', marginBottom: '2rem' }}>
            Join your clinic&apos;s triage system
          </p>

          {globalError && (
            <div style={{ background: 'rgba(232,68,68,0.1)', border: '1px solid rgba(232,68,68,0.3)', borderRadius: '3px', padding: '10px 13px', marginBottom: '1.25rem' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--urgent)', fontWeight: 500 }}>{globalError}</p>
            </div>
          )}

          <form onSubmit={handleRegister} noValidate>

            {/* Name */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '6px' }}>
                Full name
              </label>
              <input
                type="text" placeholder="Jane Smith" autoComplete="name"
                value={form.name} onChange={set('name')}
                style={inputStyle(!!errors.name)}
                onFocus={(e) => { if (!errors.name) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onBlur={(e) => { if (!errors.name) e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {errors.name && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--urgent)', marginTop: '4px' }}>{errors.name}</p>}
            </div>

            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email" placeholder="jane@legalaid.org" autoComplete="email"
                value={form.email} onChange={set('email')}
                style={inputStyle(!!errors.email)}
                onFocus={(e) => { if (!errors.email) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onBlur={(e) => { if (!errors.email) e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {errors.email && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--urgent)', marginTop: '4px' }}>{errors.email}</p>}
            </div>

            {/* Clinic */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '6px' }}>
                Clinic name <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text" placeholder="City Legal Aid Society"
                value={form.clinic} onChange={set('clinic')}
                style={inputStyle(false)}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password" placeholder="At least 6 characters" autoComplete="new-password"
                value={form.password} onChange={set('password')}
                style={inputStyle(!!errors.password)}
                onFocus={(e) => { if (!errors.password) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onBlur={(e) => { if (!errors.password) e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {errors.password && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--urgent)', marginTop: '4px' }}>{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '6px' }}>
                Confirm password
              </label>
              <input
                type="password" placeholder="Repeat your password" autoComplete="new-password"
                value={form.confirm} onChange={set('confirm')}
                style={inputStyle(!!errors.confirm)}
                onFocus={(e) => { if (!errors.confirm) e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onBlur={(e) => { if (!errors.confirm) e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {errors.confirm && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--urgent)', marginTop: '4px' }}>{errors.confirm}</p>}
            </div>

            <button
              type="submit" disabled={busy}
              style={{
                width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                background: 'var(--gold)', color: '#000',
                border: 'none', borderRadius: '3px', padding: '12px',
                cursor: 'pointer', fontWeight: 700,
                opacity: busy ? 0.6 : 1, transition: 'opacity 150ms',
              }}
            >
              {busy ? 'Creating account…' : 'Create Account'}
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
            Sign up with Google
          </button>

          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginTop: '1.5rem', textAlign: 'center' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--gold)', fontWeight: 500 }}>Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
