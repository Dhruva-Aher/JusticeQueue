'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'

const STATS = [
  { n: '< 30s', label: 'Intake file to ranked queue' },
  { n: '100%', label: 'Transparent — every point explained' },
  { n: 'Zero', label: 'Cases scored without reason' },
  { n: 'Free', label: 'For qualifying legal aid orgs' },
]

const STEPS = [
  { n: '01', title: 'Upload intake batch', body: 'Drop a CSV, TXT, or PDF of client intake notes. One record or a hundred — JusticeQueue handles any format.' },
  { n: '02', title: 'AI extracts and scores', body: 'Gemini Flash extracts facts. Atlas vector search finds similar past cases. A transparent algorithm scores each case 0–100.' },
  { n: '03', title: 'Act on your ranked queue', body: 'Cases surface by urgency. Click any row for the full breakdown, AI recommendation, and case precedents. Override any score with a logged reason.' },
]

const TECH = [
  { name: 'Google Cloud Vertex AI', desc: 'Gemini 2.0 Flash for fact extraction · Gemini 1.5 Pro for recommendations' },
  { name: 'MongoDB Atlas', desc: 'Vector search on 1024-dim embeddings · stores case history and outcomes' },
  { name: 'Voyage AI', desc: 'voyage-large-2 embeddings — legal domain–tuned similarity search' },
  { name: 'Upstash Redis', desc: 'Serverless rate limiting on upload and query endpoints' },
  { name: 'Firebase Auth', desc: 'Clinic staff authentication · Google SSO · role-based access' },
  { name: 'Next.js + Vercel', desc: 'App Router · serverless functions · global edge network' },
]

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
          <div style={{ width: '28px', height: '28px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--text)' }}>JusticeQueue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <a href="/dashboard?demo=true" style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', fontWeight: 500, transition: 'color 150ms' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-2)'}>
            Live Demo
          </a>
          <button
            onClick={() => router.push('/register')}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase',
              letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
              border: 'none', padding: '7px 16px', cursor: 'pointer', fontWeight: 700, borderRadius: '2px',
            }}>
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '6rem 2.5rem 5rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'var(--gold-subtle)', border: '1px solid rgba(233,161,44,0.2)',
          padding: '4px 12px', borderRadius: '2px', marginBottom: '2rem',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AI Triage for Legal Aid Clinics
          </span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 6vw, 68px)', color: 'var(--text)', lineHeight: 1.08, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
          The right client,<br />seen at the{' '}
          <span style={{ color: 'var(--gold)' }}>right time.</span>
        </h1>

        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--text-2)', lineHeight: 1.75, maxWidth: '580px', marginBottom: '2.5rem', fontWeight: 400 }}>
          JusticeQueue ranks your intake queue by urgency in under 30 seconds.
          Upload a batch of client files and get a scored, explained priority queue —
          backed by Gemini AI, MongoDB Atlas vector search, and your clinic&apos;s own case history.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/register')}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
              letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
              border: 'none', padding: '13px 28px', cursor: 'pointer', fontWeight: 700, borderRadius: '2px',
            }}>
            Request Access →
          </button>
          <a href="/dashboard?demo=true" style={{
            fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'var(--text-2)', background: 'transparent',
            border: '1px solid var(--border-mid)', padding: '13px 28px',
            display: 'inline-block', borderRadius: '2px', transition: 'border-color 150ms, color 150ms',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}>
            View Live Demo
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '0' }}>
          {STATS.map(({ n, label }, i) => (
            <div key={label} style={{
              padding: '2rem 2rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', color: 'var(--gold)', lineHeight: 1, marginBottom: '6px' }}>{n}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5, fontWeight: 400 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '5rem 2.5rem' }}>
        <div style={{ marginBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '10px' }}>How it works</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Three steps to a ranked queue
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--border)', background: 'var(--border)' }}>
          {STEPS.map(({ n, title, body }) => (
            <div key={n} style={{ padding: '2rem', background: 'var(--bg-surface)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--gold)', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{n}</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text)', fontWeight: 600, marginBottom: '0.6rem' }}>{title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built with */}
      <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '5rem 2.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: '10px' }}>Built with</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: 'var(--text)', letterSpacing: '-0.01em' }}>
              The infrastructure behind every decision
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>
            {TECH.map(({ name, desc }) => (
              <div key={name} style={{ padding: '1.5rem', background: 'var(--bg-raised)' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 600, marginBottom: '5px' }}>{name}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ maxWidth: '680px', margin: '0 auto', padding: '5rem 2.5rem', textAlign: 'center' }}>
        <div style={{ width: '40px', height: '2px', background: 'var(--gold)', margin: '0 auto 2rem' }} />
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--text)', lineHeight: 1.65, marginBottom: '1.25rem' }}>
          &ldquo;The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.&rdquo;
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          — Legal Aid Director
        </p>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '5rem 2.5rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--text)', marginBottom: '1rem', letterSpacing: '-0.01em' }}>
          Every intake record deserves a decision.
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-2)', marginBottom: '2.5rem', maxWidth: '440px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Free for qualifying legal aid organizations. No infrastructure setup beyond adding your credentials.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/register')}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
              letterSpacing: '0.07em', background: 'var(--gold)', color: '#000',
              border: 'none', padding: '13px 32px', cursor: 'pointer', fontWeight: 700, borderRadius: '2px',
            }}>
            Request Access →
          </button>
          <a href="/dashboard?demo=true" style={{
            fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'var(--text-2)',
            border: '1px solid var(--border-mid)', padding: '13px 32px',
            display: 'inline-block', borderRadius: '2px',
          }}>
            View Live Demo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 2.5rem', borderTop: '1px solid var(--border)',
        background: 'var(--bg)', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '11px', color: '#000' }}>⚖</span>
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text)' }}>JusticeQueue</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Google Cloud Rapid Agent Hackathon 2025 · MongoDB Track
        </span>
        <a href="mailto:admin@justicequeue.org" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Contact
        </a>
      </footer>
    </div>
  )
}
