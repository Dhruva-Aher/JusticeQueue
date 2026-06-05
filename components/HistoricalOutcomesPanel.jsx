import StatusBadge from './StatusBadge.jsx'

function outcomeVariant(o) {
  if (o === 'won' || o === 'Won')     return 'clear'
  if (o === 'settled' || o === 'Settled') return 'warn'
  if (o === 'lost' || o === 'Lost')    return 'danger'
  return 'neutral'
}

export default function HistoricalOutcomesPanel({ precedents = [] }) {
  if (!precedents || precedents.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border)',
      marginBottom: '1.25rem',
      overflow: 'hidden'
    }}>
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid var(--border)', 
        background: 'var(--bg-raised)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ 
          fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, 
          color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' 
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-3)' }}>
            <path d="M3 6h18"/><path d="M12 6v14"/><path d="M8 10h8"/><path d="M8 14h8"/>
          </svg>
          Historical Precedents
        </h3>
        <span style={{ 
          fontSize: '10px', fontWeight: 600, color: 'var(--text-3)', 
          background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px' 
        }}>
          {precedents.length} Relevant Outcomes Retrieved
        </span>
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', divideY: '1px solid var(--border)' }}>
          {precedents.map((p, i) => {
            const pct = p.similarity_score != null ? Math.round(p.similarity_score * 100) : null;
            return (
              <div key={p.uid || p.id || i} style={{ padding: '16px', transition: 'background 150ms', cursor: 'default' }}
                   onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                   onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>
                      {p.uid || p.id || `PREC-${2023+i}-X`}
                    </span>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                      {p.key_factor || p.description?.slice(0, 80) || p.outcome_notes?.slice(0, 80) || 'Similar Eviction Defense'}
                    </h4>
                  </div>
                  <StatusBadge 
                    label={p.outcome ? p.outcome.charAt(0).toUpperCase() + p.outcome.slice(1) : 'Unknown'} 
                    variant={outcomeVariant(p.outcome)} 
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-sans)' }}>
                    Resolved: {p.resolution_date ? new Date(p.resolution_date).toLocaleDateString() : p.year || '2023'}
                  </span>
                  <span style={{ 
                    fontSize: '11px', fontWeight: 500, color: 'var(--clear)', 
                    background: 'var(--clear-subtle)', padding: '2px 6px', borderRadius: '4px',
                    fontFamily: 'var(--font-sans)'
                  }}>
                    {pct != null ? `${pct}% Match` : 'Highly Relevant'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
