'use client'
import StatusBadge from './StatusBadge.jsx'

function outcomeVariant(o) {
  if (o === 'won') return 'clear'
  if (o === 'settled') return 'warn'
  return 'neutral'
}

export default function SimilarCases({ cases = [] }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
        Similar Past Cases
      </p>
      {cases.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
          No similar cases in history.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
          {cases.map((c, i) => {
            const pct = c.similarity_score != null ? Math.round(c.similarity_score * 100) : null
            return (
              <div key={c.id || i} style={{
                display: 'grid', gridTemplateColumns: '44px 1fr auto',
                gap: '12px', alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--bg-surface)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                    {pct != null ? `${pct}%` : '—'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    match
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description?.slice(0, 90) || c.outcome_notes?.slice(0, 90) || 'No description'}
                  </div>
                  {c.year && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                      {c.year}
                    </div>
                  )}
                </div>
                <StatusBadge label={c.outcome || '—'} variant={outcomeVariant(c.outcome)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
