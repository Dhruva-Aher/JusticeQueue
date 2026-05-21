'use client'

const ROWS = [
  { key: 'deadline_points',      label: 'Deadline',      max: 40 },
  { key: 'vulnerability_points', label: 'Vulnerability', max: 25 },
  { key: 'case_type_points',     label: 'Case Type',     max: 20 },
  { key: 'similarity_points',    label: 'Precedent',     max: 15 },
]

function barColor(pct) {
  if (pct >= 0.75) return '#e84444'
  if (pct >= 0.40) return '#f0a030'
  return '#22c97a'
}

export default function UrgencyBreakdown({ breakdown }) {
  if (!breakdown) return null
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '1rem' }}>
        Score Breakdown
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ROWS.map(({ key, label, max }) => {
          const pts = breakdown[key] ?? 0
          const pct = max > 0 ? pts / max : 0
          const color = barColor(pct)
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: pts > 0 ? 'var(--text-2)' : 'var(--text-3)', fontWeight: 500 }}>
                  {label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: pts > 0 ? color : 'var(--text-3)' }}>
                  +{pts} <span style={{ color: 'var(--text-3)' }}>/ {max}</span>
                </span>
              </div>
              <div style={{ height: '3px', background: 'var(--bg-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round(pct * 100)}%`,
                  background: pts > 0 ? color : 'transparent',
                  borderRadius: '2px', transition: 'width 600ms ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
