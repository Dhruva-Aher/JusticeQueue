'use client'

// Mock queue shown in the product section — reflects what the real app produces
const MOCK_QUEUE = [
  { rank: 1, score: 94, name: 'Maria R.',  type: 'Eviction',    deadline: 2,  flags: ['Critical'] },
  { rank: 2, score: 81, name: 'James C.',  type: 'Wage Theft',  deadline: 5,  flags: ['Urgent']   },
  { rank: 3, score: 67, name: 'Aisha P.',  type: 'Immigration', deadline: 12, flags: []           },
  { rank: 4, score: 45, name: 'Tom W.',    type: 'Custody',     deadline: 18, flags: []           },
  { rank: 5, score: 29, name: 'Sarah J.',  type: 'Employment',  deadline: 26, flags: []           },
]

const STATS = [
  { n: '900+',  label: 'Legal aid organizations in the US' },
  { n: '~80%',  label: 'Of eligible clients turned away each year' },
  { n: '72hrs', label: 'Average time before a family loses their home' },
  { n: '< 30s', label: 'Intake batch to ranked queue' },
]

const STEPS = [
  {
    n: '01',
    title: 'Upload your intake batch',
    body: 'Drop a CSV, TXT, or PDF of client intake notes. JusticeQueue handles any volume and format without manual reformatting.',
  },
  {
    n: '02',
    title: 'AI scores and ranks every case',
    body: 'Gemini extracts key facts. Atlas vector search finds similar past cases. A transparent algorithm scores 0–100 across four dimensions.',
  },
  {
    n: '03',
    title: 'Act on the ranked queue',
    body: 'Cases surface by urgency — deadline, vulnerability, case type, and precedent. Click any row for the full breakdown. Override any score with a logged reason.',
  },
]

function scoreColor(s) {
  if (s >= 80) return '#E84444'
  if (s >= 50) return '#E8962A'
  return '#22C97A'
}

function deadlineColor(d) {
  if (d <= 3) return '#E84444'
  if (d <= 7) return '#E8962A'
  return null
}

function PrimaryButton({ href, onClick, children }) {
  const style = {
    fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
    letterSpacing: '-0.01em',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 'var(--radius-sm)', padding: '12px 24px',
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    transition: 'opacity 180ms',
    textDecoration: 'none',
  }
  const handleEnter = (e) => { e.currentTarget.style.opacity = '0.85' }
  const handleLeave = (e) => { e.currentTarget.style.opacity = '1' }

  if (href) {
    return (
      <a href={href} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {children}
      </a>
    )
  }
  return (
    <button onClick={onClick} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
    </button>
  )
}

function SecondaryButton({ href, onClick, children }) {
  const style = {
    fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
    color: 'var(--text-2)',
    background: 'transparent',
    border: '1px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)', padding: '12px 24px',
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color 150ms, color 150ms',
    textDecoration: 'none',
  }
  const handleEnter = (e) => {
    e.currentTarget.style.borderColor = 'var(--border-strong)'
    e.currentTarget.style.color = 'var(--text)'
  }
  const handleLeave = (e) => {
    e.currentTarget.style.borderColor = 'var(--border-mid)'
    e.currentTarget.style.color = 'var(--text-2)'
  }

  if (href) {
    return (
      <a href={href} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {children}
      </a>
    )
  }
  return (
    <button onClick={onClick} style={style} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
    </button>
  )
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500, transition: 'color 150ms', textDecoration: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
    >
      {children}
    </a>
  )
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px', background: 'var(--bg)',
        borderBottom: '1px solid var(--border)', padding: '0 2.5rem',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '17px', lineHeight: 1 }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            JusticeQueue
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <NavLink href="/dashboard?demo=true">Demo</NavLink>
          <NavLink href="/login">Sign in</NavLink>
          <PrimaryButton href="/register">Get started →</PrimaryButton>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '9rem 2.5rem 8rem' }}>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
          marginBottom: '2rem', letterSpacing: 0,
        }}>
          Legal aid triage infrastructure
        </p>
        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(52px, 7vw, 80px)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          lineHeight: 1.0,
          color: 'var(--text)',
          marginBottom: '2rem',
          maxWidth: '800px',
        }}>
          Modern judicial<br />infrastructure.
        </h1>
        <p style={{
          fontFamily: 'var(--font-sans)', fontSize: '18px', color: 'var(--text-2)',
          lineHeight: 1.65, maxWidth: '480px', marginBottom: '3rem', fontWeight: 400,
        }}>
          JusticeQueue reads every intake record, scores urgency across four dimensions, and ranks your queue in under 30 seconds.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <PrimaryButton href="/dashboard?demo=true">See it working →</PrimaryButton>
          <SecondaryButton href="/register">Get started free</SecondaryButton>
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderBottom: '1px solid var(--border)' }} />

      {/* Stats */}
      <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATS.map(({ n, label }, i) => (
            <div key={label} style={{
              padding: '3rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 700,
                letterSpacing: '-0.04em',
                color: 'var(--text)',
                lineHeight: 1,
                marginBottom: '10px',
              }}>
                {n}
              </div>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)',
                lineHeight: 1.5, maxWidth: '140px',
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product section */}
      <section style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '7rem 2.5rem' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
            marginBottom: '1.5rem',
          }}>
            The queue
          </p>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            marginBottom: '1.25rem',
            lineHeight: 1.1,
          }}>
            Every case scored and ranked automatically.
          </h2>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--text-2)',
            lineHeight: 1.7, maxWidth: '520px', marginBottom: '3rem',
          }}>
            Upload a batch of intake notes. Within seconds your team sees every case ranked by urgency, with a transparent breakdown of why each score was assigned.
          </p>

          {/* Case preview table */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '44px 72px 1fr 120px 80px 100px',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border)',
            }}>
              {['rank', 'score', 'client', 'type', 'deadline', 'flags'].map((h) => (
                <div key={h} style={{
                  fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500,
                  color: 'var(--text-3)', height: '36px',
                  padding: '0 16px', display: 'flex', alignItems: 'center',
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {MOCK_QUEUE.map((c, i) => {
              const sc = scoreColor(c.score)
              const dc = deadlineColor(c.deadline)
              return (
                <div
                  key={c.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 72px 1fr 120px 80px 100px',
                    alignItems: 'center',
                    height: '40px',
                    background: i === 0 ? 'rgba(200,130,58,0.04)' : 'var(--bg)',
                    borderLeft: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
                    borderBottom: i < MOCK_QUEUE.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'default',
                  }}
                >
                  {/* Rank */}
                  <div style={{ padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                    {c.rank}
                  </div>
                  {/* Score pill */}
                  <div style={{ padding: '0 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: '36px', padding: '2px 6px',
                      background: `${sc}18`,
                      border: `1px solid ${sc}40`,
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                      color: sc,
                    }}>
                      {c.score}
                    </span>
                  </div>
                  {/* Client name */}
                  <div style={{ padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                    {c.name}
                  </div>
                  {/* Type */}
                  <div style={{ padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)' }}>
                    {c.type}
                  </div>
                  {/* Deadline */}
                  <div style={{ padding: '0 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: dc || 'var(--text-3)' }}>
                    {c.deadline}d
                  </div>
                  {/* Flags */}
                  <div style={{ padding: '0 16px' }}>
                    {c.flags.map((f) => (
                      <span key={f} style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '11px', fontFamily: 'var(--font-sans)', fontWeight: 500,
                        background: f === 'Critical' ? 'rgba(232,68,68,0.10)' : 'rgba(232,150,42,0.10)',
                        color: f === 'Critical' ? '#E84444' : '#E8962A',
                        border: f === 'Critical' ? '1px solid rgba(232,68,68,0.25)' : '1px solid rgba(232,150,42,0.25)',
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Footer row */}
            <div style={{
              padding: '10px 16px',
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border)',
              fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
            }}>
              5 cases · scored in 18s · Click any row for the AI breakdown
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '7rem 2.5rem' }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
            marginBottom: '1.5rem',
          }}>
            How it works
          </p>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '40px', fontWeight: 700,
            letterSpacing: '-0.03em', color: 'var(--text)',
            marginBottom: '4rem', lineHeight: 1.1,
          }}>
            From intake file to ranked queue<br />in three steps.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem' }}>
            {STEPS.map(({ n, title, body }) => (
              <div key={n}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-3)',
                  marginBottom: '1.5rem',
                }}>
                  {n}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 600,
                  letterSpacing: '-0.02em', color: 'var(--text)',
                  marginBottom: '1rem', lineHeight: 1.3,
                }}>
                  {title}
                </h3>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-2)',
                  lineHeight: 1.7,
                }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '8rem 2.5rem', textAlign: 'center' }}>
          <blockquote style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(20px, 3vw, 28px)',
            fontWeight: 400,
            lineHeight: 1.55,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            marginBottom: '1.5rem',
          }}>
            &ldquo;The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.&rdquo;
          </blockquote>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)' }}>
            — Legal Aid Director, Northeast US
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '9rem 2.5rem', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            color: 'var(--text)',
            marginBottom: '2rem',
          }}>
            Every intake record<br />deserves a decision.
          </h2>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <PrimaryButton href="/register">Create free account →</PrimaryButton>
            <SecondaryButton href="/dashboard?demo=true">View live demo</SecondaryButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', lineHeight: 1 }}>⚖</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
              JusticeQueue © {new Date().getFullYear()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              { label: 'Demo', href: '/dashboard?demo=true' },
              { label: 'Sign in', href: '/login' },
              { label: 'Contact', href: 'mailto:admin@justicequeue.org' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', transition: 'color 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)' }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
