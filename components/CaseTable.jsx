'use client'
import StatusBadge from './StatusBadge.jsx'

function scoreColor(s) {
  if (s >= 80) return '#e84444'
  if (s >= 50) return '#f0a030'
  return '#22c97a'
}

function deadlineColor(d) {
  if (d == null) return 'var(--text-3)'
  if (d <= 3) return '#e84444'
  if (d <= 7) return '#f0a030'
  return '#22c97a'
}

function flagBadges(flags) {
  if (!flags) return []
  const out = []
  if (flags.minor_children)  out.push({ label: 'Children', variant: 'warn' })
  if (flags.language_barrier) out.push({ label: 'Language', variant: 'neutral' })
  if (flags.medical_condition) out.push({ label: 'Medical', variant: 'danger' })
  return out
}

function statusVariant(s) {
  if (s === 'overridden') return 'gold'
  if (s === 'reviewed')   return 'clear'
  if (s === 'closed')     return 'neutral'
  return 'neutral'
}

const TYPE_LABELS = {
  eviction: 'Eviction', immigration: 'Immigration',
  wage_theft: 'Wage Theft', custody: 'Custody',
  employment: 'Employment', other: 'Other',
}

export default function CaseTable({ cases = [], selectedId, onSelectCase }) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-3)', marginBottom: '8px' }}>
          No cases in queue
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
          Upload an intake file to begin triage
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Score', 'Client', 'Type', 'Deadline', 'Flags', 'Status'].map((h) => (
              <th key={h} style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--text-3)', textAlign: 'left',
                padding: '10px 14px', fontWeight: 400,
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => {
            const selected = c.id === selectedId
            const flags = flagBadges(c.vulnerability_flags)
            return (
              <tr
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                style={{
                  cursor: 'pointer',
                  background: selected ? 'var(--bg-hover)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: selected ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Rank */}
                <td style={{ padding: '13px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', width: '40px' }}>
                  {c.rank}
                </td>

                {/* Score */}
                <td style={{ padding: '13px 14px', width: '70px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: scoreColor(c.priority_score), lineHeight: 1 }}>
                      {c.priority_score}
                    </span>
                  </div>
                </td>

                {/* Name */}
                <td style={{ padding: '13px 14px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                    {c.client_name}
                  </div>
                  {c.summary && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.summary}
                    </div>
                  )}
                </td>

                {/* Type */}
                <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', fontWeight: 500 }}>
                    {TYPE_LABELS[c.case_type] || c.case_type}
                  </span>
                </td>

                {/* Deadline */}
                <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: deadlineColor(c.deadline_days), fontWeight: 500 }}>
                    {c.deadline_days != null ? `${c.deadline_days}d` : '—'}
                  </span>
                </td>

                {/* Flags */}
                <td style={{ padding: '13px 14px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {flags.map((f) => <StatusBadge key={f.label} label={f.label} variant={f.variant} />)}
                  </div>
                </td>

                {/* Status */}
                <td style={{ padding: '13px 14px' }}>
                  <StatusBadge label={c.status || 'Pending'} variant={statusVariant(c.status)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
