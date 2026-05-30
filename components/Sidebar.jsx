'use client'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext.jsx'

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const NAV = [
  { label: 'Priority Queue', href: '/dashboard' },
  { label: 'Agent Activity',  href: '/agent' },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const pathname = usePathname()

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || ''
  const clinic      = profile?.clinic || ''

  if (!user) return null

  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '16px', lineHeight: 1, color: 'var(--text)' }}>⚖</span>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--text)', letterSpacing: '-0.02em',
          }}>
            JusticeQueue
          </span>
        </a>

        {clinic && (
          <div style={{
            marginTop: '8px', paddingLeft: '35px',
            fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {clinic}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px' }}>
        {NAV.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text)' : 'var(--text-2)',
                background: active ? 'var(--bg-raised)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms, color 120ms',
                marginBottom: '2px',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--bg-raised)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-2)'
                }
              }}
            >
              {label}
            </a>
          )
        })}
      </nav>

      {/* User section */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px', padding: '0 2px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--bg-hover)', border: '1px solid var(--border-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--text-2)', fontWeight: 700, lineHeight: 1,
            }}>
              {initials(displayName)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
              color: 'var(--text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              maxWidth: '150px',
            }}>
              {displayName}
            </div>
          </div>
        </div>

        <button
          onClick={signOut}
          style={{
            width: '100%',
            fontFamily: 'var(--font-sans)', fontSize: '12px',
            color: 'var(--text-3)', background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px',
            cursor: 'pointer', textAlign: 'left',
            transition: 'color 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--urgent)'
            e.currentTarget.style.borderColor = 'rgba(232,68,68,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-3)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
