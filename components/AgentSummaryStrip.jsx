'use client'
import { useEffect, useState } from 'react'

function StatItem({ n, label, color }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: '12px',
        color, fontWeight: 700,
      }}>
        {n}
      </span>
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: '12px',
        color, fontWeight: 400,
      }}>
        {label}
      </span>
    </span>
  )
}

export default function AgentSummaryStrip({ stats, onDismiss, isDemo = false }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (isDemo) return   // Never auto-dismiss in demo mode
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 400)   // let fade finish before unmounting
    }, 60_000)
    return () => clearTimeout(t)
  }, [isDemo, onDismiss])

  if (!stats || stats.cases_scored === 0) return null

  const durationSec = stats.duration_ms ? (stats.duration_ms / 1000).toFixed(1) : null

  return (
    <div
      style={{
        background: 'var(--bg-raised)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem',
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease',
        marginBottom: '1rem',
      }}
    >
      {/* Left — stat items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
        <StatItem n={stats.cases_scored}           label=" Cases Scored"        color="var(--text)" />
        <Dot />
        <StatItem n={stats.emails_drafted}         label=" Email Drafts Ready"  color="var(--clear)" />
        <Dot />
        <StatItem n={stats.calendar_blocks_created} label=" Calendar Blocks"    color="var(--medium)" />
        <Dot />
        <StatItem n={stats.briefs_generated}        label=" Case Briefs Ready"  color="var(--stamp)" />
      </div>

      {/* Right — duration + dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: '11px',
          color: 'var(--text-3)', whiteSpace: 'nowrap',
        }}>
          Agent complete{durationSec ? ` · ${durationSec}s` : ''}
        </span>
        {!isDemo && (
          <button
            onClick={() => { setVisible(false); setTimeout(onDismiss, 400) }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '13px',
              color: 'var(--text-3)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '0 4px', lineHeight: 1,
              transition: 'color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

function Dot() {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '12px',
      color: 'var(--border-mid)', margin: '0 10px',
    }}>·</span>
  )
}
