// 3-row list of similar past cases with similarity %, description, outcome badge
'use client'
import StatusBadge from './StatusBadge.jsx'

function outcomeVariant(outcome) {
  if (outcome === 'won') return 'clear'
  if (outcome === 'settled') return 'warn'
  return 'neutral'
}

export default function SimilarCases({ cases = [] }) {
  if (cases.length === 0) return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
        Similar Past Cases
      </p>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)' }}>No similar cases found.</p>
    </div>
  )

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
        Similar Past Cases
      </p>
      {cases.map((c, i) => (
        <div key={c.id || i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr auto', gap: '0.75rem', alignItems: 'start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--ink)', lineHeight: 1.2 }}>
            {c.similarity_score != null ? `${Math.round(c.similarity_score * 100)}%` : '—'}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
            {c.description?.slice(0, 80)}{c.description?.length > 80 ? '…' : ''}
          </span>
          <StatusBadge label={c.outcome?.toUpperCase() || '—'} variant={outcomeVariant(c.outcome)} />
        </div>
      ))}
    </div>
  )
}
