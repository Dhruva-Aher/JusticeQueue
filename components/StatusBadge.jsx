// Rubber-stamp style badge — danger | warn | clear | neutral variants
'use client'

const VARIANTS = {
  danger:  { background: 'var(--stamp-light)',  color: 'var(--stamp)',  border: '#d4a0a0' },
  warn:    { background: 'var(--ochre-light)',  color: 'var(--ochre)',  border: '#c4aa80' },
  clear:   { background: 'var(--forest-light)', color: 'var(--forest)', border: '#90b894' },
  neutral: { background: 'var(--bg-inset)',     color: 'var(--ink-3)',  border: 'var(--border)' },
}

export default function StatusBadge({ label, variant = 'neutral' }) {
  const style = VARIANTS[variant] ?? VARIANTS.neutral
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        padding: '2px 6px',
        borderRadius: 0,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
