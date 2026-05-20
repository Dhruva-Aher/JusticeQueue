// Sticky top bar — logo, clinic name, date, user name, logout
'use client'
import { useAuth } from '../context/AuthContext.jsx'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Navbar({ clinicName = 'Legal Aid Clinic' }) {
  const { user, signOut } = useAuth()

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '52px',
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)', fontSize: '18px', lineHeight: 1 }}>⚖</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          JusticeQueue
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--ink-3)',
            borderLeft: '1px solid var(--border)',
            paddingLeft: '0.75rem',
            marginLeft: '0.25rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {clinicName}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)' }}>
          {formatDate(new Date())}
        </span>
        {user && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>
              {user.email}
            </span>
            <button
              onClick={signOut}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--stamp)',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
