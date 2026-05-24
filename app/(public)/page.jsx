'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'

// Mock queue shown in the hero — reflects what the real app produces
const MOCK_QUEUE = [
  { rank: 1, score: 94, name: 'Maria R.',    type: 'Eviction',    deadline: '2d',  flags: ['CRITICAL'] },
  { rank: 2, score: 81, name: 'James C.',    type: 'Wage Theft',  deadline: '5d',  flags: ['URGENT']   },
  { rank: 3, score: 67, name: 'Aisha P.',    type: 'Immigration', deadline: '12d', flags: []           },
  { rank: 4, score: 45, name: 'Tom W.',      type: 'Custody',     deadline: '18d', flags: []           },
  { rank: 5, score: 29, name: 'Sarah J.',    type: 'Employment',  deadline: '26d', flags: []           },
]

const STATS = [
  { n: '900+',  label: 'Legal aid orgs in the US'          },
  { n: '~80%',  label: 'Of eligible clients turned away'   },
  { n: '72hrs', label: 'Average time before a family loses their home' },
  { n: '< 30s', label: 'Intake batch to ranked queue'      },
]

const STEPS = [
  {
    n: '01', title: 'Upload your intake batch',
    body: 'Drop a CSV, TXT, or PDF of client intake notes. One record or hundreds — JusticeQueue handles any volume and format without manual reformatting.',
  },
  {
    n: '02', title: 'AI extracts facts and scores',
    body: 'Gemini AI extracts key facts from every record. Atlas vector search finds similar past cases. A transparent algorithm scores each case 0–100 across four dimensions. The agent searches your clinic\'s entire case history for similar situations — and surfaces what worked before. Your institutional knowledge becomes part of every decision.',
  },
  {
    n: '03', title: 'Act on your ranked queue',
    body: 'Cases surface by urgency — deadline, vulnerability, case type, and precedent. Click any row for the full AI breakdown. Override any score with a logged reason.',
  },
]

const QUOTES = [
  {
    text: 'The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.',
    attr: 'Legal Aid Director, Northeast US',
  },
  {
    text: 'We used to spend an hour every morning sorting intake notes by hand. Now we upload the file and the queue is ready before our first coffee.',
    attr: 'Intake Coordinator, Bay Area Legal Aid',
  },
]

function scoreColor(s) {
  if (s >= 80) return '#e84444'
  if (s >= 50) return '#f0a030'
  return '#22c97a'
}

function AppPreview() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      width: '100%', maxWidth: '500px',
    }}>
      {/* Fake window chrome */}
      <div style={{
        background: 'var(--bg-raised)', padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#ff5f57','#febc2e','#28c840'].map((c) => (
            <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: 'var(--bg-hover)', borderRadius: '4px',
          padding: '4px 10px', marginLeft: '6px',
          fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)',
        }}>
          justicequeue.app/dashboard
        </div>
      </div>

      {/* Mini navbar */}
      <div style={{
        padding: '0 14px', height: '38px',
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '18px', height: '18px', background: 'var(--gold)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '12px', color: 'var(--text)' }}>JusticeQueue</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)' }}>· City Legal Aid</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#4f6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#000', fontWeight: 700 }}>JD</span>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-2)' }}>Jane D.</span>
        </div>
      </div>

      {/* Mini stats bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
        gap: '1px', background: 'var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Total', val: '5',  accent: null },
          { label: 'Critical', val: '2', accent: '#e84444' },
          { label: 'Avg Score', val: '63', accent: '#f0a030' },
          { label: 'Overridden', val: '0', accent: null },
        ].map(({ label, val, accent }) => (
          <div key={label} style={{ background: 'var(--bg-surface)', padding: '8px 10px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: accent || 'var(--text)', lineHeight: 1 }}>{val}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 48px 1fr 80px 50px',
        gap: '0', padding: '6px 12px',
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      }}>
        {['#', 'Score', 'Client', 'Type', 'Deadline'].map((h) => (
          <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Table rows */}
      {MOCK_QUEUE.map((c, i) => (
        <div key={c.rank} style={{
          display: 'grid', gridTemplateColumns: '32px 48px 1fr 80px 50px',
          alignItems: 'center',
          padding: '8px 12px',
          background: i === 0 ? 'rgba(233,161,44,0.04)' : 'var(--bg-surface)',
          borderLeft: i === 0 ? '2px solid var(--gold)' : '2px solid transparent',
          borderBottom: i < MOCK_QUEUE.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)' }}>{c.rank}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', padding: '2px 0',
            background: `${scoreColor(c.score)}20`,
            border: `1px solid ${scoreColor(c.score)}44`,
            borderRadius: '3px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            color: scoreColor(c.score),
          }}>
            {c.score}
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text)', fontWeight: 500 }}>{c.name}</div>
            {c.flags.length > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '8px',
                color: '#e84444', background: 'rgba(232,68,68,0.1)',
                border: '1px solid rgba(232,68,68,0.2)',
                padding: '1px 4px', borderRadius: '2px',
              }}>
                {c.flags[0]}
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-3)' }}>{c.type}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: scoreColor(parseInt(c.deadline)) || 'var(--text-3)' }}>
            {c.deadline}
          </span>
        </div>
      ))}

      {/* Footer bar */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)' }}>
          5 cases · scored in 18s · Click any row for AI breakdown
        </span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '56px', background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)', padding: '0 2.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text)', letterSpacing: '-0.01em' }}>JusticeQueue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/dashboard?demo=true"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500, transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}>
            Live Demo
          </a>
          <a href="/login"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500, transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}>
            Sign in
          </a>
          <button
            onClick={() => router.push('/register')}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase',
              letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
              border: 'none', padding: '7px 18px', cursor: 'pointer', fontWeight: 700, borderRadius: '4px',
            }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero — split layout */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 2.5rem 4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>

          {/* Left: copy */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(233,161,44,0.08)', border: '1px solid rgba(233,161,44,0.2)',
              padding: '4px 12px', borderRadius: '20px', marginBottom: '1.75rem',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                AI Triage for Legal Aid Clinics
              </span>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.8vw, 48px)',
              color: 'var(--text)', lineHeight: 1.15, marginBottom: '1.25rem', letterSpacing: '-0.02em',
            }}>
              Families lose their homes not because no lawyer existed —{' '}
              <span style={{ color: 'var(--gold)' }}>but because the right case never reached the right lawyer in time.</span>
            </h1>

            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--text-2)',
              lineHeight: 1.75, marginBottom: '2.25rem', fontWeight: 400,
            }}>
              JusticeQueue reads every intake submission, searches your clinic&apos;s case
              history for similar situations, and tells your team who needs help first —
              in under 30 seconds.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <a
                href="/dashboard?demo=true"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
                  letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
                  border: 'none', padding: '13px 28px', cursor: 'pointer', fontWeight: 700, borderRadius: '5px',
                  transition: 'opacity 150ms', display: 'inline-flex', alignItems: 'center',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                See it working →
              </a>
              <button
                onClick={() => router.push('/register')}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--text-2)',
                  background: 'transparent',
                  border: '1px solid var(--border-mid)', padding: '13px 28px',
                  cursor: 'pointer', borderRadius: '5px', transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}
              >
                Get Started Free
              </button>
            </div>

            {/* Trust signals */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {['No credit card required', 'Free for legal aid orgs', 'GDPR-ready'].map((label) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--clear)', fontSize: '12px' }}>✓</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: app preview */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppPreview />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STATS.map(({ n, label }, i) => (
            <div key={label} style={{
              padding: '2rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--gold)', lineHeight: 1, marginBottom: '6px' }}>{n}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 2.5rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '10px' }}>
            How it works
          </p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 3.5vw, 40px)', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            From intake file to ranked queue
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {STEPS.map(({ n, title, body }) => (
            <div key={n} style={{ padding: '2rem', background: 'var(--bg-surface)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{n}</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text)', fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.3 }}>{title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quotes */}
      <section style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        padding: '5rem 2.5rem',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {QUOTES.map(({ text, attr }, i) => (
            <div key={i} style={{ padding: '2.5rem', background: 'var(--bg-raised)' }}>
              <div style={{ width: '32px', height: '2px', background: 'var(--gold)', marginBottom: '1.5rem' }} />
              <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                &ldquo;{text}&rdquo;
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                — {attr}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '6rem 2.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)', color: 'var(--text)', marginBottom: '1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Every intake record<br />deserves a decision.
          </h2>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-2)', marginBottom: '2.5rem', lineHeight: 1.75 }}>
            Free for qualifying legal aid organizations. Sign up in under two minutes —
            no infrastructure setup, no subscription required.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/register')}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
                letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
                border: 'none', padding: '14px 36px', cursor: 'pointer', fontWeight: 700, borderRadius: '5px',
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Create Free Account →
            </button>
            <a href="/dashboard?demo=true" style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--text-2)',
              border: '1px solid var(--border-mid)', padding: '14px 36px',
              display: 'inline-flex', alignItems: 'center',
              borderRadius: '5px', transition: 'border-color 150ms, color 150ms',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}>
              View Live Demo
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '1.5rem 2.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '1rem',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '11px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)' }}>JusticeQueue</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
            © {new Date().getFullYear()}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a href="/dashboard?demo=true"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}>
            Live Demo
          </a>
          <a href="/login"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}>
            Sign In
          </a>
          <a href="mailto:admin@justicequeue.org"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}>
            Contact
          </a>
        </div>
      </footer>
    </div>
  )
}
