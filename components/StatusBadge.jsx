'use client'

const VARIANTS = {
  danger:  { bg: 'rgba(220,38,38,0.08)',   color: '#DC2626', border: 'rgba(220,38,38,0.18)'  },
  warn:    { bg: 'rgba(194,113,12,0.08)',  color: '#C2710C', border: 'rgba(194,113,12,0.18)' },
  clear:   { bg: 'rgba(22,163,74,0.08)',   color: '#16A34A', border: 'rgba(22,163,74,0.18)'  },
  gold:    { bg: 'rgba(67,56,202,0.07)',   color: '#4338CA', border: 'rgba(67,56,202,0.18)'  },
  neutral: { bg: 'rgba(0,0,0,0.04)',       color: '#78716C', border: 'rgba(0,0,0,0.10)'      },
  blue:    { bg: 'rgba(37,99,235,0.07)',   color: '#2563EB', border: 'rgba(37,99,235,0.18)'  },
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
