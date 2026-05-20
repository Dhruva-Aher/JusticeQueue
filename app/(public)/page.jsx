// Landing page — hero, stats bar, features grid, how-it-works, CTA
'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'

const STATS = [
  { number: '< 30s', label: 'Average triage time' },
  { number: '4', label: 'Case types covered' },
  { number: '5+', label: 'Urgency signals scored' },
]

const FEATURES = [
  { title: 'Automated Extraction', body: 'Gemini Flash reads raw intake notes and extracts structured facts — case type, deadline, vulnerability flags — in seconds.' },
  { title: 'Vector Precedent Search', body: 'Atlas vector search finds the most similar past cases and their outcomes, giving attorneys instant context before they read a word.' },
  { title: 'Urgency Scoring', body: 'A transparent, reproducible algorithm weights deadlines, case type, vulnerability, and precedent similarity into a single priority score.' },
  { title: 'Staff Override', body: 'Any score can be manually overridden with a documented reason. Every override is logged for audit and accountability.' },
]

const STEPS = [
  { n: '01', label: 'Upload intake file' },
  { n: '02', label: 'AI extracts and scores' },
  { n: '03', label: 'Review ranked queue' },
]

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)', padding: '0 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)', fontSize: '18px' }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px' }}>JusticeQueue</span>
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--stamp)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          Sign in →
        </button>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '5rem 2rem 4rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--ink)', lineHeight: 1.15, marginBottom: '1.25rem' }}>
          Every second counts.<br />Who gets help first?
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.7, maxWidth: '520px', marginBottom: '2rem' }}>
          JusticeQueue is an AI triage agent for legal aid clinics. Upload a batch of intake files and get a ranked priority queue in under 30 seconds — backed by Gemini, Atlas vector search, and your clinic&apos;s own case history.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--stamp)', color: '#fff', border: 'none', borderRadius: 0, padding: '12px 28px', cursor: 'pointer' }}
        >
          Request Access →
        </button>
      </section>

      {/* Stats bar */}
      <section style={{ background: 'var(--ink)', padding: '2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', gap: '2rem', flexWrap: 'wrap' }}>
          {STATS.map(({ number, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', color: '#fff', lineHeight: 1 }}>{number}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#9a9187', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', marginBottom: '2rem', color: 'var(--ink)' }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {FEATURES.map(({ title, body }, i) => (
            <div key={title} style={{ padding: '1.5rem', borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink)', marginBottom: '0.5rem' }}>{title}</h3>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem 4rem', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', margin: '2rem 0', color: 'var(--ink)' }}>Three steps</h2>
        <div style={{ display: 'flex', gap: 0 }}>
          {STEPS.map(({ n, label }, i) => (
            <div key={n} style={{ flex: 1, padding: '1.5rem', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--stamp)', display: 'block', marginBottom: '0.5rem' }}>{n}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--stamp)', padding: '4rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', color: '#fff', marginBottom: '1rem' }}>Ready to triage smarter?</h2>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>Built for legal aid clinics. No setup required beyond credentials.</p>
        <button
          onClick={() => router.push('/login')}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#fff', color: 'var(--stamp)', border: 'none', borderRadius: 0, padding: '12px 28px', cursor: 'pointer' }}
        >
          Get Started →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-serif)', color: 'var(--stamp)' }}>⚖</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--ink)' }}>JusticeQueue</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Google Cloud Rapid Agent Hackathon 2026 · MongoDB Track
        </span>
      </footer>
    </div>
  )
}
