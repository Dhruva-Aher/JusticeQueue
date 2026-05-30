'use client'
export const dynamic = 'force-dynamic'

const MOCK_QUEUE = [
  { rank: 1, score: 94, name: 'Maria Santos',   type: 'Eviction',    deadline: 2,  status: 'pending',  flags: ['Minor'] },
  { rank: 2, score: 87, name: 'James Okafor',   type: 'Immigration', deadline: 5,  status: 'pending',  flags: [] },
  { rank: 3, score: 71, name: 'Sarah Chen',     type: 'Custody',     deadline: 9,  status: 'reviewed', flags: ['Medical'] },
  { rank: 4, score: 58, name: 'David Kim',      type: 'Wage Theft',  deadline: 14, status: 'pending',  flags: ['Lang'] },
  { rank: 5, score: 31, name: 'Alex Rivera',    type: 'Employment',  deadline: 22, status: 'closed',   flags: [] },
]

const SCORE_STEPS = [
  { label: 'Deadline urgency',   pts: '40 pts', desc: 'Days until the legal deadline' },
  { label: 'Vulnerability',      pts: '25 pts', desc: 'Minor children, medical needs, language' },
  { label: 'Case severity',      pts: '20 pts', desc: 'Type of legal issue and complexity' },
  { label: 'Precedent match',    pts: '15 pts', desc: 'Similarity to prior resolved cases' },
]

const WORKFLOW = [
  { n: '01', label: 'Retrieve',     desc: 'The agent connects to MongoDB Atlas and retrieves all active cases — hundreds of intake records, structured and ready for analysis.' },
  { n: '02', label: 'Analyze',      desc: 'Deadline urgency is computed across every case. Critical matters (≤3 days) and urgent matters (≤7 days) are isolated automatically.' },
  { n: '03', label: 'Research',     desc: 'A vector similarity search identifies precedent patterns. The CourtListener API pulls relevant judicial opinions in real time.' },
  { n: '04', label: 'Recommend',    desc: 'Gemini Pro synthesizes case data and precedents into specific, actionable attorney instructions — one per client, ready for tomorrow.' },
]

const AGENT_TOOLS = [
  { label: 'Gemini Pro',        color: '#4338CA', desc: 'Reasoning & recommendations' },
  { label: 'MongoDB Atlas',     color: '#16A34A', desc: 'Case storage & vector search' },
  { label: 'CourtListener',     color: '#2563EB', desc: 'Judicial precedent retrieval' },
  { label: 'Reasoning Engine',  color: '#78716C', desc: 'Urgency & gap analysis' },
]

function ScoreDot({ score }) {
  const color = score >= 80 ? '#DC2626' : score >= 50 ? '#C2710C' : '#16A34A'
  const bg    = score >= 80 ? 'rgba(220,38,38,0.08)' : score >= 50 ? 'rgba(194,113,12,0.08)' : 'rgba(22,163,74,0.08)'
  const br    = score >= 80 ? 'rgba(220,38,38,0.18)' : score >= 50 ? 'rgba(194,113,12,0.18)' : 'rgba(22,163,74,0.18)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '38px', padding: '2px 6px',
      background: bg, color, border: `1px solid ${br}`,
      borderRadius: '3px',
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', fontWeight: 700,
    }}>
      {score}
    </span>
  )
}

const TYPE_COLORS = {
  'Eviction':    '#DC2626',
  'Immigration': '#2563EB',
  'Custody':     '#7C3AED',
  'Wage Theft':  '#C2710C',
  'Employment':  '#16A34A',
}

function DeadlineDot({ days }) {
  const color = days <= 3 ? '#DC2626' : days <= 7 ? '#C2710C' : '#A8A29E'
  return (
    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color, fontWeight: 500 }}>
      {days <= 7 && <span style={{ marginRight: '3px', fontSize: '8px' }}>●</span>}
      {days}d
    </span>
  )
}

function StatusPill({ status }) {
  const s = status === 'reviewed'
    ? { bg: 'rgba(22,163,74,0.08)', color: '#16A34A', border: 'rgba(22,163,74,0.18)', label: 'Reviewed' }
    : status === 'closed'
    ? { bg: 'rgba(0,0,0,0.04)', color: '#78716C', border: 'rgba(0,0,0,0.10)', label: 'Closed' }
    : { bg: 'rgba(0,0,0,0.04)', color: '#78716C', border: 'rgba(0,0,0,0.10)', label: 'Pending' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500,
      padding: '2px 6px', background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, borderRadius: '3px',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

function FlagChip({ label }) {
  return (
    <span style={{
      fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
      padding: '1px 5px',
      background: 'rgba(194,113,12,0.08)', color: '#C2710C',
      border: '1px solid rgba(194,113,12,0.18)', borderRadius: '3px',
    }}>
      {label}
    </span>
  )
}

export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Navigation */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: '56px',
        background: 'rgba(247,246,243,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 2rem',
        justifyContent: 'space-between',
      }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '16px', lineHeight: 1 }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            JusticeQueue
          </span>
        </a>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <a href="/judge" style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
            color: 'var(--accent)',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(67,56,202,0.2)',
            background: 'rgba(67,56,202,0.04)',
            textDecoration: 'none', display: 'inline-block',
          }}>
            Judge Mode
          </a>
          <a href="/dashboard?demo=true" style={{
            fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
          >
            Demo
          </a>
          <a href="/login" style={{
            fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
          >
            Sign in
          </a>
          <a href="/register" style={{
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
            color: '#FFFFFF',
            background: 'var(--text)',
            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            transition: 'opacity 150ms', display: 'inline-block',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Get access
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section style={{
        maxWidth: '1200px', margin: '0 auto',
        padding: 'clamp(4rem,8vw,7rem) 2rem clamp(3rem,6vw,5rem)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4rem',
        alignItems: 'center',
      }}>
        {/* Left — headline */}
        <div>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
            color: 'var(--accent)', letterSpacing: '0.04em',
            marginBottom: '1.25rem',
          }}>
            Autonomous Legal Operations Agent
          </p>
          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(36px,5vw,58px)',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
          }}>
            The docket prepares
            <br />itself.
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '17px',
            color: 'var(--text-2)', lineHeight: 1.65,
            marginBottom: '2rem',
            maxWidth: '440px',
          }}>
            One click triggers an 8-step autonomous agent: it retrieves your cases, analyzes deadlines,
            searches judicial precedents, and delivers a ranked docket with attorney recommendations —
            in under 60 seconds.
          </p>
          {/* Tool badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            {AGENT_TOOLS.map(({ label, color }) => (
              <span key={label} style={{
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500,
                padding: '4px 10px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-2)',
                display: 'inline-flex', alignItems: 'center', gap: '5px',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/register" style={{
              fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
              background: 'var(--text)', color: '#F7F6F3',
              padding: '12px 24px', borderRadius: 'var(--radius-sm)',
              transition: 'opacity 150ms', display: 'inline-block',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              Start free →
            </a>
            <a href="/dashboard?demo=true" style={{
              fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
              background: 'transparent',
              color: 'var(--text-2)',
              border: '1px solid var(--border-mid)',
              padding: '12px 24px', borderRadius: 'var(--radius-sm)',
              transition: 'border-color 150ms, color 150ms', display: 'inline-block',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              View demo
            </a>
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginTop: '1.25rem' }}>
            No configuration required. Upload an intake file and run the agent — docket ready in under 60 seconds.
          </p>
        </div>

        {/* Right — product preview */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          {/* Preview header */}
          <div style={{
            height: '44px',
            background: 'var(--bg-raised)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                Docket Preview
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                5 cases · Agent scored
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['#DC2626','#C2710C','#16A34A'].map((c, i) => (
                <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.5 }} />
              ))}
            </div>
          </div>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 50px 1fr 90px 60px 80px',
            padding: '0 14px',
            height: '32px',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}>
            {['#', 'Score', 'Client', 'Type', 'Due', 'Status'].map((h) => (
              <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, color: 'var(--text-3)' }}>{h}</span>
            ))}
          </div>
          {/* Mock rows */}
          {MOCK_QUEUE.map((row, i) => (
            <div key={row.rank} style={{
              display: 'grid',
              gridTemplateColumns: '32px 50px 1fr 90px 60px 80px',
              padding: '0 14px',
              height: '44px',
              alignItems: 'center',
              borderBottom: i < MOCK_QUEUE.length - 1 ? '1px solid var(--border)' : 'none',
              background: row.rank === 1 ? 'rgba(220,38,38,0.02)' : 'transparent',
            }}>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: 'var(--text-3)' }}>
                {row.rank}
              </span>
              <ScoreDot score={row.score} />
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: row.rank === 1 ? '#DC2626' : 'var(--text)', lineHeight: 1.2 }}>
                  {row.name}
                </div>
                {row.flags.length > 0 && (
                  <div style={{ marginTop: '2px', display: 'flex', gap: '3px' }}>
                    {row.flags.map((f) => <FlagChip key={f} label={f} />)}
                  </div>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: TYPE_COLORS[row.type] || 'var(--text-3)', fontWeight: 500 }}>
                {row.type}
              </span>
              <DeadlineDot days={row.deadline} />
              <StatusPill status={row.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto', padding: '0 2rem',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0',
        }}>
          {[
            { n: '8',      label: 'Autonomous agent steps' },
            { n: '< 60s',  label: 'Full docket preparation' },
            { n: '3',      label: 'Live APIs integrated' },
            { n: '100%',   label: 'Auditable decisions' },
          ].map(({ n, label }, i) => (
            <div key={label} style={{
              padding: '2.5rem 2rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 'clamp(28px,4vw,40px)',
                fontWeight: 700, color: 'var(--text)',
                letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '8px',
              }}>
                {n}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(4rem,8vw,6rem) 2rem' }}>
        <div style={{ marginBottom: '3.5rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: 'clamp(24px,3.5vw,36px)',
            fontWeight: 700, color: 'var(--text)',
            letterSpacing: '-0.025em', marginBottom: '12px',
          }}>
            The agent workflow
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--text-2)', maxWidth: '520px', lineHeight: 1.6 }}>
            One button triggers eight sequential steps. Every action is recorded, every tool call visible, every decision auditable.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
          {WORKFLOW.map(({ n, label, desc }) => (
            <div key={n}>
              <div style={{
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px',
                color: 'var(--accent)', fontWeight: 600, marginBottom: '12px',
                letterSpacing: '0.05em',
              }}>
                {n}
              </div>
              <h3 style={{
                fontFamily: 'var(--font-sans)', fontSize: '17px', fontWeight: 600,
                color: 'var(--text)', letterSpacing: '-0.015em', marginBottom: '10px',
              }}>
                {label}
              </h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', maxWidth: '1200px', margin: '0 auto' }} />

      {/* Scoring transparency */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: 'clamp(4rem,8vw,6rem) 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'start' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: 'clamp(24px,3.5vw,36px)',
              fontWeight: 700, color: 'var(--text)',
              letterSpacing: '-0.025em', marginBottom: '16px',
            }}>
              Transparent by design.
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Every priority score is explained. Attorneys see exactly how each case was ranked —
              and can override any score with a documented reason. Every decision is logged for audit.
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.7 }}>
              The algorithm doesn&apos;t replace attorney judgment. It ensures nothing falls through the cracks.
            </p>
          </div>
          <div>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600,
                color: 'var(--text-3)',
              }}>
                Priority Score Breakdown · 100 points
              </div>
              {SCORE_STEPS.map(({ label, pts, desc }, i) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: i < SCORE_STEPS.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: '12px',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>
                      {label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                      {desc}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px',
                    fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {pts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          padding: 'clamp(5rem,10vw,8rem) 2rem',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(30px,5vw,52px)',
            fontWeight: 700, color: 'var(--text)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            margin: '0 auto 1.5rem',
            maxWidth: '700px',
          }}>
            Every intake record deserves a decision.
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '17px', color: 'var(--text-2)',
            marginBottom: '2.5rem', lineHeight: 1.6,
          }}>
            An autonomous agent prepares tomorrow&apos;s docket so your team starts every morning with a clear plan.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" style={{
              fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600,
              background: 'var(--text)', color: '#F7F6F3',
              padding: '14px 32px', borderRadius: 'var(--radius-sm)',
              transition: 'opacity 150ms', display: 'inline-block',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              Create free account
            </a>
            <a href="/dashboard?demo=true" style={{
              fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 500,
              color: 'var(--text-2)',
              border: '1px solid var(--border-mid)',
              background: 'transparent',
              padding: '14px 32px', borderRadius: 'var(--radius-sm)',
              transition: 'border-color 150ms, color 150ms', display: 'inline-block',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              Explore demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        padding: '1.5rem 2rem',
      }}>
        <div style={{
          maxWidth: '1200px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚖</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)' }}>
              JusticeQueue · Built for legal aid clinics
            </span>
          </div>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            {[
              { label: 'Operations Center', href: '/dashboard?demo=true' },
              { label: 'Agent Activity', href: '/agent' },
              { label: 'Sign in', href: '/login' },
              { label: 'Register', href: '/register' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{
                fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
