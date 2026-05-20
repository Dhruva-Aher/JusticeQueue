// Landing page — hero, stats bar, how-it-works, built-with, CTA, footer
'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'

const STATS = [
  { number: '< 30s', label: 'From intake file to ranked queue' },
  { number: '100%', label: 'Transparent scoring — every point explained' },
  { number: 'Zero', label: 'Paperwork slips through unscored' },
  { number: 'Free', label: 'For qualifying legal aid clinics' },
]

const STEPS = [
  {
    n: '01',
    title: 'Upload intake batch',
    body: 'Drop a CSV, TXT, or PDF of client intake notes. JusticeQueue handles any format — one record or a hundred.',
  },
  {
    n: '02',
    title: 'AI extracts and scores',
    body: 'Gemini Flash extracts structured facts. Atlas vector search finds similar past cases. A transparent algorithm computes an urgency score.',
  },
  {
    n: '03',
    title: 'Act on your ranked queue',
    body: 'Cases surface by priority. Click any row for the full breakdown, AI recommendation, and precedent context. Override any score with a logged reason.',
  },
]

const BUILT_WITH = [
  { name: 'Google Cloud Vertex AI', role: 'Gemini 2.0 Flash for fact extraction, Gemini 1.5 Pro for recommendations' },
  { name: 'MongoDB Atlas', role: 'Vector search on 1024-dim embeddings to retrieve similar past cases' },
  { name: 'Voyage AI', role: 'voyage-large-2 embeddings — legal domain–optimized' },
  { name: 'Upstash Redis', role: 'Serverless rate limiting on upload and query endpoints' },
  { name: 'Firebase Auth', role: 'Clinic staff authentication with Google SSO' },
  { name: 'Next.js + Vercel', role: 'App Router with edge-compatible serverless functions' },
]

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)', fontSize: '18px' }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--ink)' }}>JusticeQueue</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a
            href="/dashboard?demo=true"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            Live Demo
          </a>
          <button
            onClick={() => router.push('/login')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--stamp)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            Sign in →
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '5rem 2rem 4rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--stamp)', marginBottom: '1rem' }}>
          AI Triage for Legal Aid Clinics
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(38px, 5.5vw, 62px)', color: 'var(--ink)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
          The difference between<br />Monday and Friday is<br />
          <span style={{ color: 'var(--stamp)' }}>a home.</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.75, maxWidth: '560px', marginBottom: '2.5rem' }}>
          JusticeQueue ranks your intake queue by urgency in under 30 seconds.
          Upload a batch of client files and get a scored, explained priority queue —
          backed by Gemini, MongoDB Atlas vector search, and your clinic&apos;s own case history.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/login')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--stamp)', color: '#fff', border: 'none', borderRadius: 0, padding: '13px 28px', cursor: 'pointer' }}
          >
            Request Access →
          </button>
          <a
            href="/dashboard?demo=true"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border-dark)', borderRadius: 0, padding: '13px 28px', cursor: 'pointer', display: 'inline-block' }}
          >
            View Live Demo →
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ background: 'var(--ink)', padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {STATS.map(({ number, label }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '36px', color: '#fff', lineHeight: 1 }}>{number}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9a9187', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '6px', lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '5rem 2rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>How it works</p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: 'var(--ink)', marginBottom: '3rem' }}>Three steps to a ranked queue</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--border)' }}>
          {STEPS.map(({ n, title, body }, i) => (
            <div key={n} style={{ padding: '2rem', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--stamp)', display: 'block', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{n}</span>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink)', marginBottom: '0.75rem' }}>{title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.65 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built with */}
      <section style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>Built with</p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--ink)', marginBottom: '2.5rem' }}>The infrastructure behind every decision</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: '1px solid var(--border)' }}>
            {BUILT_WITH.map(({ name, role }, i) => (
              <div
                key={name}
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none',
                  borderBottom: i < BUILT_WITH.length - 2 ? '1px solid var(--border)' : 'none',
                }}
              >
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink)', marginBottom: '4px', letterSpacing: '0.02em' }}>{name}</p>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--ink-3)', lineHeight: 1.5 }}>{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section style={{ maxWidth: '680px', margin: '0 auto', padding: '5rem 2rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--ink)', lineHeight: 1.6, marginBottom: '1rem' }}>
          &ldquo;The difference between seeing a client on Monday and seeing them on Friday is often the difference between keeping their home and losing it.&rdquo;
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          — Legal Aid Director
        </p>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--stamp)', padding: '4.5rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 36px)', color: '#fff', marginBottom: '1rem' }}>
          Every intake record deserves a decision.
        </h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '2.5rem', maxWidth: '480px', margin: '0 auto 2.5rem' }}>
          Built for legal aid clinics. Free for qualifying organizations. No setup beyond credentials.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/login')}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fff', color: 'var(--stamp)', border: 'none', borderRadius: 0, padding: '13px 28px', cursor: 'pointer' }}
          >
            Request Access →
          </button>
          <a
            href="/dashboard?demo=true"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 0, padding: '13px 28px', cursor: 'pointer', display: 'inline-block' }}
          >
            View Live Demo →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)' }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--ink)' }}>JusticeQueue</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Google Cloud Rapid Agent Hackathon 2025 · MongoDB Track
        </span>
        <a
          href="mailto:admin@justicequeue.org"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Contact
        </a>
      </footer>
    </div>
  )
}
