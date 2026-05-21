'use client'
import StatusBadge from './StatusBadge.jsx'

function outcomeVariant(o) {
  if (o === 'won')     return 'clear'
  if (o === 'settled') return 'warn'
  if (o === 'lost')    return 'danger'
  return 'neutral'
}

export default function SimilarCases({ cases = [] }) {
  if (cases.length === 0) {
    return (
      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
          Similar Past Cases
        </p>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', padding: '12px 0' }}>
          No similar cases found in the case history database.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
        Similar Past Cases
        <span style={{ color: 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '6px', fontSize: '10px' }}>
          · {cases.length} found
        </span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {cases.map((c, i) => {
          const pct = c.similarity_score != null ? Math.round(c.similarity_score * 100) : null
          const pctColor = pct >= 80 ? '#22c97a' : pct >= 60 ? '#f0a030' : 'var(--text-3)'

          return (
            <div key={c.id || i} style={{
              display: 'grid', gridTemplateColumns: '52px 1fr auto',
              gap: '12px', alignItems: 'center',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              borderBottom: i < cases.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Similarity % */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: pctColor, fontWeight: 600, lineHeight: 1 }}>
                  {pct != null ? `${pct}%` : '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                  match
                </div>
              </div>

              {/* Description + year */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {c.description?.slice(0, 120) || c.outcome_notes?.slice(0, 120) || 'No description available'}
                </div>
                {c.year && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>
                    {c.year}
                  </div>
                )}
              </div>

              {/* Outcome badge */}
              <StatusBadge
                label={c.outcome ? c.outcome.charAt(0).toUpperCase() + c.outcome.slice(1) : '—'}
                variant={outcomeVariant(c.outcome)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
