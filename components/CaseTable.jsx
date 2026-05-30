'use client'
import StatusBadge from './StatusBadge.jsx'

function ScorePill({ score }) {
  let bg, color, border
  if (score >= 80) {
    bg = 'rgba(220,38,38,0.08)'; color = '#DC2626'; border = 'rgba(220,38,38,0.18)'
  } else if (score >= 50) {
    bg = 'rgba(194,113,12,0.08)'; color = '#C2710C'; border = 'rgba(194,113,12,0.18)'
  } else {
    bg = 'rgba(22,163,74,0.08)'; color = '#16A34A'; border = 'rgba(22,163,74,0.18)'
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '44px', padding: '3px 8px',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: '4px',
      fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700,
    }}>
      {score}
    </span>
  )
}

function DeadlineCell({ days }) {
  if (days == null) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>—</span>
  let color = '#16A34A'
  let label = `${days}d`
  if (days <= 3)      { color = '#DC2626'; label = `${days}d` }
  else if (days <= 7) { color = '#C2710C'; label = `${days}d` }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'var(--font-mono)', fontSize: '12px', color, fontWeight: 500,
    }}>
      {days <= 7 && <span style={{ fontSize: '9px', lineHeight: 1 }}>●</span>}
      {label}
    </span>
  )
}

function flagBadges(flags) {
  if (!flags) return []
  const out = []
  if (flags.minor_children)    out.push({ label: 'Minor',   variant: 'warn' })
  if (flags.medical_condition) out.push({ label: 'Medical', variant: 'danger' })
  if (flags.language_barrier)  out.push({ label: 'Lang',    variant: 'neutral' })
  return out
}

function statusVariant(s) {
  if (s === 'overridden') return 'gold'
  if (s === 'reviewed')   return 'clear'
  if (s === 'closed')     return 'neutral'
  return 'neutral'
}

const TYPE_LABELS = {
  eviction:    'Eviction',
  immigration: 'Immigration',
  wage_theft:  'Wage Theft',
  custody:     'Custody',
  employment:  'Employment',
  other:       'Other',
}

const TYPE_COLORS = {
  eviction:    '#DC2626',
  immigration: '#2563EB',
  wage_theft:  '#C2710C',
  custody:     '#7C3AED',
  employment:  '#16A34A',
  other:       '#78716C',
}

const COLS = [
  { label: '#',        w: '44px'  },
  { label: 'Score',    w: '72px'  },
  { label: 'Client',   w: null    },
  { label: 'Type',     w: '110px' },
  { label: 'Deadline', w: '90px'  },
  { label: 'Flags',    w: '150px' },
  { label: 'Status',   w: '100px' },
]

export default function CaseTable({ cases = [], selectedId, onSelectCase }) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-2)', fontWeight: 500, marginBottom: '6px' }}>
          No cases in queue
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
          Upload an intake file to generate a scored, ranked priority queue.
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {COLS.map(({ label, w }) => (
              <th key={label} style={{ width: w || undefined }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c, idx) => {
            const selected   = c.id === selectedId
            const flags      = flagBadges(c.vulnerability_flags)
            const typeColor  = TYPE_COLORS[c.case_type] || 'var(--text-3)'
            const isOverdue  = c.deadline_days != null && c.deadline_days <= 3

            return (
              <tr
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                style={{
                  cursor: 'pointer',
                  background: selected ? 'rgba(67,56,202,0.05)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Rank */}
                <td style={{ paddingLeft: selected ? '14px' : '16px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
                    {c.rank ?? idx + 1}
                  </span>
                </td>

                {/* Score */}
                <td><ScorePill score={c.priority_score} /></td>

                {/* Client name + summary */}
                <td>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: '13px',
                    color: isOverdue ? '#DC2626' : 'var(--text)', fontWeight: 500,
                  }}>
                    {c.client_name}
                  </div>
                  {c.summary && (
                    <div style={{
                      fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
                      marginTop: '1px', maxWidth: '280px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.summary}
                    </div>
                  )}
                </td>

                {/* Type */}
                <td>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: typeColor, fontWeight: 500 }}>
                    {TYPE_LABELS[c.case_type] || c.case_type || '—'}
                  </span>
                </td>

                {/* Deadline */}
                <td><DeadlineCell days={c.deadline_days} /></td>

                {/* Flags */}
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {flags.length > 0
                      ? flags.map((f) => <StatusBadge key={f.label} label={f.label} variant={f.variant} />)
                      : <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</span>
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
