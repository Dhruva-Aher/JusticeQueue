// Dense HTML table — RANK, SCORE, NAME, TYPE, DEADLINE, FLAGS, STATUS columns
'use client'
import StatusBadge from './StatusBadge.jsx'

function scoreColor(score) {
  if (score >= 80) return 'var(--stamp)'
  if (score >= 50) return 'var(--ochre)'
  return 'var(--forest)'
}

function deadlineColor(days) {
  if (days == null) return 'var(--ink-3)'
  if (days <= 3) return 'var(--stamp)'
  if (days <= 7) return 'var(--ochre)'
  return 'var(--forest)'
}

function statusVariant(status) {
  if (status === 'overridden') return 'warn'
  if (status === 'reviewed') return 'clear'
  if (status === 'closed') return 'neutral'
  return 'neutral'
}

function flagBadges(flags) {
  if (!flags) return null
  const active = []
  if (flags.minor_children) active.push({ label: 'CHILDREN', variant: 'danger' })
  if (flags.language_barrier) active.push({ label: 'LANG', variant: 'warn' })
  if (flags.medical_condition) active.push({ label: 'MEDICAL', variant: 'warn' })
  return active
}

const TH = ({ children }) => (
  <th
    style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--ink-3)',
      padding: '8px 12px',
      textAlign: 'left',
      fontWeight: 400,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
)

export default function CaseTable({ cases = [], selectedId, onSelectCase }) {
  if (cases.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
          NO CASES — UPLOAD AN INTAKE FILE ABOVE
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <TH>#</TH>
            <TH>Score</TH>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Deadline</TH>
            <TH>Flags</TH>
            <TH>Status</TH>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => {
            const isSelected = c.id === selectedId
            const flags = flagBadges(c.vulnerability_flags) || []
            return (
              <tr
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                style={{
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-raised)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-raised)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)' }}>
                  {c.rank}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: scoreColor(c.priority_score), lineHeight: 1 }}>
                    {c.priority_score}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink)', maxWidth: '200px' }}>
                  {c.client_name}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                  {c.case_type?.replace('_', ' ')}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: deadlineColor(c.deadline_days), whiteSpace: 'nowrap' }}>
                  {c.deadline_days != null ? `${c.deadline_days}d` : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {flags.map((f) => <StatusBadge key={f.label} label={f.label} variant={f.variant} />)}
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge label={c.status || 'PENDING'} variant={statusVariant(c.status)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
