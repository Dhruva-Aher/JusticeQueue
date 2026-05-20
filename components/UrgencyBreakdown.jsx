// 4-row breakdown of scoring points by category
'use client'

const ROWS = [
  { key: 'deadline_points',       label: 'Deadline' },
  { key: 'vulnerability_points',  label: 'Vulnerability' },
  { key: 'case_type_points',      label: 'Case Type' },
  { key: 'similarity_points',     label: 'Precedent' },
]

export default function UrgencyBreakdown({ breakdown }) {
  if (!breakdown) return null
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
        Scoring Breakdown
      </p>
      {ROWS.map(({ key, label }) => {
        const pts = breakdown[key] ?? 0
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
              opacity: pts === 0 ? 0.4 : 1,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-2)' }}>{label}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--ink)' }}>+{pts}</span>
          </div>
        )
      })}
    </div>
  )
}
