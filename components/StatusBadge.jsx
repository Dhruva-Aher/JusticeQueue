'use client'

const VARIANTS = {
  danger:   { bg: 'rgba(232,68,68,0.12)',    color: '#e84444', border: 'rgba(232,68,68,0.25)' },
  warn:     { bg: 'rgba(240,160,48,0.12)',   color: '#f0a030', border: 'rgba(240,160,48,0.25)' },
  clear:    { bg: 'rgba(34,201,122,0.12)',   color: '#22c97a', border: 'rgba(34,201,122,0.25)' },
  gold:     { bg: 'rgba(91,110,247,0.10)',   color: '#7b8ef9', border: 'rgba(91,110,247,0.25)' },
  neutral:  { bg: 'rgba(255,255,255,0.04)',  color: '#8E8EA0', border: 'rgba(255,255,255,0.08)' },
  blue:     { bg: 'rgba(91,110,247,0.12)',   color: '#7b8ef9', border: 'rgba(91,110,247,0.25)' },
}

export default function StatusBadge({ label, variant = 'neutral', dot = false }) {
  const s = VARIANTS[variant] ?? VARIANTS.neutral
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: dot ? '5px' : 0,
      fontFamily: 'var(--font-sans)', fontSize: '11px',
      fontWeight: 500,
      padding: '2px 7px',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: '4px',
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      )}
      {label}
    </span>
  )
}
