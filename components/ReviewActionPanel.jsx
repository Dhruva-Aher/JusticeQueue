export default function ReviewActionPanel({ status, uid }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border)',
      position: 'sticky',
      top: '1.5rem',
      padding: '16px',
      marginBottom: '1.25rem'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Review Action Required
        </h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button style={{
          width: '100%', height: '44px',
          background: 'var(--text)', color: 'white',
          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
          borderRadius: 'var(--radius-sm)', border: 'none',
          boxShadow: 'var(--shadow-sm)', transition: 'background 150ms', cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#000'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--text)'}>
          Approve Priority Escalation
        </button>

        <button style={{
          width: '100%', height: '44px',
          background: 'var(--bg-surface)', color: 'var(--text-2)',
          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-mid)',
          transition: 'background 150ms', cursor: 'pointer'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}>
          Modify Priority Score
        </button>

        <div style={{ paddingTop: '16px', marginTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button style={{
            width: '100%', background: 'none', color: 'var(--text-2)',
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            border: 'none', textAlign: 'center', transition: 'color 150ms', cursor: 'pointer',
            padding: '8px 0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}>
            Escalate to Litigation
          </button>
          
          <button style={{
            width: '100%', background: 'none', color: 'var(--text-2)',
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            border: 'none', textAlign: 'center', transition: 'color 150ms', cursor: 'pointer',
            padding: '8px 0'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}>
            Request Senior Review
          </button>
        </div>
      </div>

      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
        textAlign: 'center', marginTop: '16px', lineHeight: 1.4
      }}>
        Actions logged to case record
      </p>
    </div>
  );
}
