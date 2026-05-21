'use client'
import { useAuth } from '../context/AuthContext.jsx'

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name) {
  const colors = ['#4f6ef7', '#22c97a', '#e9a12c', '#e84444', '#9b6ef7', '#22b8cf']
  if (!name) return colors[0]
  const i = name.charCodeAt(0) % colors.length
  return colors[i]
}

export default function Navbar({ clinicName, caseCount }) {
  const { user, profile, signOut } = useAuth()
  const displayClinic = clinicName || profile?.clinic || 'Legal Aid Clinic'
  const displayName   = profile?.name || user?.displayName || user?.email?.split('@')[0] || ''
  const color         = avatarColor(displayName)

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: '56px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.75rem',
      gap: '1rem',
    }}>

      {/* Left: logo + clinic */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
          <div style={{
            width: '28px', height: '28px', background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '4px', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#000', lineHeight: 1 }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            JusticeQueue
          </span>
        </a>

        <div style={{ width: '1px', height: '16px', background: 'var(--border-mid)', flexShrink: 0 }} />

        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayClinic}
        </span>

        {caseCount != null && caseCount > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            background: 'var(--bg-hover)', border: '1px solid var(--border-mid)',
            color: 'var(--text-3)', padding: '1px 7px', borderRadius: '10px',
            flexShrink: 0,
          }}>
            {caseCount} cases
          </span>
        )}
      </div>

      {/* Right: date + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-3)', letterSpacing: '0.03em',
          display: 'none',
        }}
          className="nav-date"
        >
          {formatDate(new Date())}
        </span>

        {/* Inline date for wider screens via inline style on container */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.03em' }}>
          {formatDate(new Date())}
        </span>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Avatar */}
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: `0 0 0 2px var(--bg-surface), 0 0 0 3px ${color}33`,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#000', fontWeight: 700 }}>
                {initials(displayName)}
              </span>
            </div>

            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px',
              color: 'var(--text-2)', fontWeight: 500,
              maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName}
            </span>

            <button
              onClick={signOut}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--text-3)', padding: '5px 12px',
                border: '1px solid var(--border)', background: 'none',
                borderRadius: 'var(--radius-sm)',
                transition: 'color 150ms, border-color 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--urgent)'
                e.currentTarget.style.borderColor = 'rgba(232,68,68,0.3)'
                e.currentTarget.style.background = 'rgba(232,68,68,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-3)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'none'
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
