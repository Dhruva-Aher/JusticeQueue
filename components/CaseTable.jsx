'use client'
import StatusBadge from './StatusBadge.jsx'

function ScorePill({ score }) {
  let bg, color, border
  if (score >= 80) {
    bg = 'rgba(232,68,68,0.15)'; color = '#e84444'; border = 'rgba(232,68,68,0.3)'
  } else if (score >= 50) {
    bg = 'rgba(240,160,48,0.15)'; color = '#f0a030'; border = 'rgba(240,160,48,0.3)'
  } else {
    bg = 'rgba(34,201,122,0.12)'; color = '#22c97a'; border = 'rgba(34,201,122,0.25)'
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '46px', padding: '4px 8px',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: '4px',
      fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
      letterSpacing: '0.02em',
    }}>
      {score}
    </span>
  )
}

function DeadlineCell({ days }) {
  if (days == null) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>—</span>
  let color = '#22c97a'
  let icon  = null
  if (days <= 3)       { color = '#e84444'; icon = '⚑' }
  else if (days <= 7)  { color = '#f0a030'; icon = '⚐' }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px', color, fontWeight: 500 }}>
      {icon && <span style={{ fontSize: '10px' }}>{icon}</span>}
      {days}d
    </span>
  )
}

function flagBadges(flags) {
  if (!flags) return []
  const out = []
  if (flags.minor_children)   out.push({ label: 'Minor', variant: 'warn' })
  if (flags.medical_condition) out.push({ label: 'Medical', variant: 'danger' })
  if (flags.language_barrier)  out.push({ label: 'Lang', variant: 'neutral' })
  return out
}

function statusVariant(s) {
  if (s === 'overridden') return 'gold'
  if (s === 'reviewed')   return 'clear'
  if (s === 'closed')     return 'neutral'
  return 'neutral'
}

const TYPE_LABELS = {
  eviction:   'Eviction',
  immigration:'Immigration',
  wage_theft: 'Wage Theft',
  custody:    'Custody',
  employment: 'Employment',
  other:      'Other',
}

const TYPE_COLORS = {
  eviction:   '#e84444',
  immigration:'#4f8ef7',
  wage_theft: '#f0a030',
  custody:    '#9b6ef7',
  employment: '#22c97a',
  other:      '#6e8fa8',
}

export default function CaseTable({ cases = [], selectedId, onSelectCase }) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-2)', fontWeight: 500, marginBottom: '6px' }}>
          No cases in queue
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
          Upload an intake file above to generate a scored, ranked priority queue.
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[
              { label: '#',         w: '48px'  },
              { label: 'Score',     w: '80px'  },
              { label: 'Client',    w: null    },
              { label: 'Type',      w: '120px' },
              { label: 'Deadline',  w: '100px' },
              { label: 'Flags',     w: '160px' },
              { label: 'Status',    w: '100px' },
            ].map(({ label, w }) => (
              <th key={label} style={{ width: w || undefined }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c, idx) => {
            const selected = c.id === selectedId
            const flags    = flagBadges(c.vulnerability_flags)
            const typeColor = TYPE_COLORS[c.case_type] || 'var(--text-3)'

            return (
              <tr
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                style={{
                  cursor: 'pointer',
                  background: selected
                    ? 'linear-gradient(90deg, rgba(91,110,247,0.07) 0%, rgba(91,110,247,0.02) 100%)'
                    : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background 100ms',
                  animation: `fadeIn 200ms ease ${idx * 30}ms both`,
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = 'var(--bg-raised)'
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Rank */}
                <td style={{ paddingLeft: selected ? '13px' : '16px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                    {c.rank ?? idx + 1}
                  </span>
                </td>

                {/* Score */}
                <td>
                  <ScorePill score={c.priority_score} />
                </td>

                {/* Client name + summary */}
                <td>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                    {c.client_name}
                  </div>
                  {c.summary && (
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
                      marginTop: '2px', maxWidth: '300px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.summary}
                    </div>
                  )}
                </td>

                {/* Type */}
                <td>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '12px', color: typeColor, fontWeight: 500,
                  }}>
                    {TYPE_LABELS[c.case_type] || c.case_type || '—'}
                  </span>
                </td>

                {/* Deadline */}
                <td>
                  <DeadlineCell days={c.deadline_days} />
                </td>

                {/* Flags */}
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {flags.length > 0
                      ? flags.map((f) => <StatusBadge key={f.label} label={f.label} variant={f.variant} />)
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>—</span>
                    }
                  </div>
                </td>

                {/* Status */}
                <td>
                  <StatusBadge
                    label={c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : 'Pending'}
                    variant={statusVariant(c.status)}
                    dot
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
