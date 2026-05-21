'use client'

const VARIANTS = {
  danger:  { bg: 'rgba(232,68,68,0.12)',    color: '#e84444', border: 'rgba(232,68,68,0.25)' },
  warn:    { bg: 'rgba(240,160,48,0.12)',   color: '#f0a030', border: 'rgba(240,160,48,0.25)' },
  clear:   { bg: 'rgba(34,201,122,0.12)',   color: '#22c97a', border: 'rgba(34,201,122,0.25)' },
  gold:    { bg: 'rgba(233,161,44,0.12)',   color: '#e9a12c', border: 'rgba(233,161,44,0.25)' },
  neutral: { bg: 'rgba(255,255,255,0.04)',  color: '#6e8fa8', border: 'rgba(255,255,255,0.08)' },
}

export default function StatusBadge({ label, variant = 'neutral' }) {
  const s = VARIANTS[variant] ?? VARIANTS.neutral
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: '10px',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      padding: '2px 7px',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: '2px',
      whiteSpace: 'nowrap', fontWeight: 500,
    }}>
      {label}
    </span>
  )
}
