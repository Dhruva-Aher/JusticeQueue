'use client'

const ROWS = [
  { key: 'deadline_points',      label: 'Deadline urgency',   max: 40, desc: 'Days until legal deadline' },
  { key: 'vulnerability_points', label: 'Vulnerability',      max: 25, desc: 'Children, medical, language' },
  { key: 'case_type_points',     label: 'Case severity',      max: 20, desc: 'Type of legal issue' },
  { key: 'similarity_points',    label: 'Precedent match',    max: 15, desc: 'Similar historical cases' },
]

function barColor(pct) {
  if (pct >= 0.75) return '#e84444'
  if (pct >= 0.40) return '#f0a030'
  return '#22c97a'
}

export default function UrgencyBreakdown({ breakdown }) {
  if (!breakdown) return null
  const total = ROWS.reduce((s, { key }) => s + (breakdown[key] ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>
          Score Breakdown
        </p>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
          {total} / 100 pts
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {ROWS.map(({ key, label, max, desc }) => {
          const pts   = breakdown[key] ?? 0
          const pct   = max > 0 ? pts / max : 0
          const color = barColor(pct)

          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: pts > 0 ? 'var(--text)' : 'var(--text-3)', fontWeight: 500 }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-3)', marginLeft: '6px' }}>
                    {desc}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: pts > 0 ? color : 'var(--text-3)', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                  +{pts}
                  <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> / {max}</span>
                </span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(pct * 100)}%`,
                  background: pts > 0
                    ? `linear-gradient(90deg, ${color}88, ${color})`
                    : 'transparent',
                  borderRadius: '2px',
                  transition: 'width 700ms cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
