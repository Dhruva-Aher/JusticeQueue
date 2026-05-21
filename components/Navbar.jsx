'use client'
import { useAuth } from '../context/AuthContext.jsx'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Navbar({ clinicName = 'Legal Aid Clinic' }) {
  const { user, signOut } = useAuth()

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: '56px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 2rem',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '28px', height: '28px', background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#000', lineHeight: 1 }}>⚖</span>
        </div>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text)', letterSpacing: '-0.01em' }}>
          JusticeQueue
        </span>
        <div style={{ width: '1px', height: '16px', background: 'var(--border-mid)', margin: '0 0.25rem' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {clinicName}
        </span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
          {formatDate(new Date())}
        </span>
        {user && (
          <>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>
              {user.email}
            </span>
            <button
              onClick={signOut}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--text-3)', padding: '4px 10px',
                border: '1px solid var(--border)', background: 'none',
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
