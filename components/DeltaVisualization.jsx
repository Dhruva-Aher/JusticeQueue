export default function DeltaVisualization({ baseline, final, reasoning }) {
  if (baseline == null || final == null || baseline === final) return null;
  const delta = final - baseline;

  return (
    <div style={{
      borderLeft: '4px solid var(--urgent)',
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      marginBottom: '1.25rem',
      border: '1px solid var(--border)',
      borderLeftWidth: '4px'
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Queue Priority Evaluation
        </h3>
      </div>
      <div style={{ padding: '16px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          background: 'var(--bg-raised)', 
          borderRadius: 'var(--radius)', 
          padding: '24px', 
          border: '1px solid var(--border)',
          position: 'relative'
        }}>
          {/* Baseline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Zero-Shot Baseline</span>
            <span style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text-2)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{baseline}</span>
            <span style={{ fontSize: '10px', background: 'var(--bg-hover)', color: 'var(--text-2)', padding: '2px 8px', borderRadius: '12px', marginTop: '8px' }}>Tier 2</span>
          </div>

          {/* Delta Flow */}
          <div style={{ flex: 1, margin: '0 24px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'var(--border-mid)' }} />
            <div className="animate-slide-in-from-left" style={{ position: 'absolute', width: '100%', height: '2px', background: 'var(--urgent)', transformOrigin: 'left' }} />
            <div className="animate-zoom-in delay-500" style={{ 
              position: 'relative', zIndex: 10, background: 'var(--bg-surface)', 
              color: 'var(--urgent)', border: '1px solid rgba(220,38,38,0.2)', 
              padding: '4px 12px', borderRadius: '16px', fontSize: '12px', 
              fontWeight: 600, boxShadow: 'var(--shadow-sm)', fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              +{delta} Points →
            </div>
          </div>

          {/* Final */}
          <div className="animate-zoom-in delay-500" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
            <span style={{ fontSize: '11px', color: 'var(--urgent)', fontWeight: 600, marginBottom: '4px', fontFamily: 'var(--font-sans)' }}>Retrieval-Informed</span>
            <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--urgent)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{final}</span>
            <span style={{ fontSize: '10px', background: 'var(--urgent-subtle)', color: 'var(--urgent)', border: '1px solid rgba(220,38,38,0.3)', padding: '2px 8px', borderRadius: '12px', marginTop: '8px', fontWeight: 600 }}>Tier 1 Critical</span>
          </div>
        </div>
        {reasoning && (
          <p style={{ 
            fontSize: '12px', color: 'var(--text-2)', marginTop: '16px', 
            lineHeight: 1.6, borderLeft: '2px solid var(--border-mid)', 
            paddingLeft: '12px', fontFamily: 'var(--font-sans)' 
          }}>
            <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Adjustment Justification:</strong> {reasoning}
          </p>
        )}
      </div>
    </div>
  );
}
