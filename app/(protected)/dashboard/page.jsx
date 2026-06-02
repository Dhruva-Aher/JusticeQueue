'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useCases } from '../../../hooks/useCases.js'
import { useUpload } from '../../../hooks/useUpload.js'
import axiosClient from '../../../lib/axiosClient.js'
import { getFirebaseAuth } from '../../../lib/firebase.js'
import UploadZone from '../../../components/UploadZone.jsx'
import CaseTable from '../../../components/CaseTable.jsx'
import CaseDetailPanel from '../../../components/CaseDetailPanel.jsx'
import AgentSummaryStrip from '../../../components/AgentSummaryStrip.jsx'

// ── DOCKET LOADING STEPS — mirrors the 9 real steps in app/api/agent/docket/route.js ─
const DOCKET_STEPS = [
  { label: 'Retrieving active cases from MongoDB Atlas…',  sub: 'Loading full caseload — Step 1 of 9' },
  { label: 'Analyzing deadline urgency…',                  sub: 'Identifying critical (≤3d) and urgent (≤7d) — Step 2' },
  { label: 'Detecting documentation gaps…',                sub: 'Finding incomplete files before hearings — Step 3' },
  { label: 'Gemini Flash selecting execution strategy…',   sub: 'Evaluating docket profile → choosing plan — Step 4' },
  { label: 'Running Atlas $vectorSearch…',                 sub: 'Matching against historical case outcomes — Step 5' },
  { label: 'Querying CourtListener API…',                  sub: 'Fetching relevant legal precedents (conditional) — Step 6' },
  { label: 'Gemini Flash generating recommendations…',     sub: 'Building attorney action plan — Step 7' },
  { label: 'Compiling executive docket report…',           sub: 'Drafting tomorrow\'s operational brief — Step 8' },
  { label: 'Persisting complete trace to MongoDB Atlas…',  sub: 'Saving execution trace, decisions, vector results — Step 9' },
]

function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      padding: '1.25rem 1.5rem',
      borderRight: '1px solid var(--border)',
    }}>
      {loading ? (
        <>
          <div className="skeleton" style={{ width: '48px', height: '26px', marginBottom: '6px', borderRadius: '3px' }} />
          <div className="skeleton" style={{ width: '70px', height: '10px', borderRadius: '3px' }} />
        </>
      ) : (
        <>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700,
            color: accent || 'var(--text)', lineHeight: 1, marginBottom: '6px',
            letterSpacing: '-0.035em',
          }}>
            {value ?? '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatsBar({ cases, loading }) {
  const total    = cases.length
  const critical = cases.filter((c) => (c.priority_score ?? 0) >= 80).length
  const dueWeek  = cases.filter((c) => c.deadline_days != null && c.deadline_days <= 7).length
  const avg      = total > 0 ? Math.round(cases.reduce((s, c) => s + (c.priority_score ?? 0), 0) / total) : null

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      border: '1px solid var(--border)',
      borderBottom: 'none',
      background: 'var(--border)',
      gap: '1px',
      borderRadius: 'var(--radius) var(--radius) 0 0',
      overflow: 'hidden',
    }}>
      <StatCard label="Active Cases"   value={total}    sub="in queue"         loading={loading} />
      <StatCard label="Critical"       value={critical} sub="score ≥ 80"       loading={loading}
        accent={critical > 0 ? 'var(--urgent)' : undefined} />
      <StatCard label="Due This Week"  value={dueWeek}  sub="within 7 days"    loading={loading}
        accent={dueWeek > 0 ? 'var(--medium)' : undefined} />
      <StatCard label="Average Score"  value={avg}      sub="urgency index"    loading={loading}
        accent={avg != null && avg >= 70 ? 'var(--medium)' : undefined} />
    </div>
  )
}

function ActionRequiredStrip({ cases }) {
  const criticalDeadlines = cases.filter((c) => c.deadline_days != null && c.deadline_days <= 3).length
  const missingDocs       = cases.filter((c) => Array.isArray(c.missing_info) && c.missing_info.length > 0).length
  const attorneyReview    = cases.filter((c) => (c.priority_score ?? 0) >= 80 || c.status === 'pending').length
  const briefsReady       = cases.filter((c) => c.brief?.available).length

  const items = [
    { label: 'Critical deadlines', value: criticalDeadlines, accent: criticalDeadlines > 0 ? 'var(--urgent)' : 'var(--text)' },
    { label: 'Missing documents',  value: missingDocs,       accent: missingDocs > 0 ? 'var(--medium)' : 'var(--text)' },
    { label: 'Needs review',       value: attorneyReview,    accent: attorneyReview > 0 ? 'var(--medium)' : 'var(--text)' },
    { label: 'Briefs ready',       value: briefsReady,       accent: briefsReady > 0 ? 'var(--clear)' : 'var(--text)' },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      gap: '1px',
      background: 'var(--border)',
      borderLeft: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          background: 'var(--bg-surface)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '10px',
          minWidth: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-3)',
            whiteSpace: 'nowrap',
          }}>
            {item.label}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 700,
            color: item.accent,
          }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function DashboardInner() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isDemo       = searchParams.get('demo') === 'true'

  const { cases: dbCases, loading: casesLoading, refetch } = useCases()
  const { status, cases: uploadedCases, stats: uploadStats, agentStats, error: uploadError, upload, reset } = useUpload()
  const [selectedId,     setSelectedId]     = useState(null)
  const [demoCases,      setDemoCases]      = useState([])
  const [demoLoading,    setDemoLoading]    = useState(false)
  const [demoError,      setDemoError]      = useState(false)
  const [clearing,       setClearing]       = useState(false)
  const [showStrip,      setShowStrip]      = useState(false)
  const [showUpload,     setShowUpload]     = useState(false)
  const [runningDocket,  setRunningDocket]  = useState(false)
  const [docketStep,     setDocketStep]     = useState(0)
  const [seedingDemo,    setSeedingDemo]    = useState(false)
  const [seedSuccess,    setSeedSuccess]    = useState(false)
  const docketIntervalRef = useRef(null)

  async function seedDemoData() {
    setSeedingDemo(true)
    setSeedSuccess(false)
    try {
      const auth  = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      const res   = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setSeedSuccess(true)
        refetch()
        setShowUpload(false)
        setTimeout(() => setSeedSuccess(false), 4000)
      }
    } catch { /* ignore */ }
    finally { setSeedingDemo(false) }
  }

  async function prepareDocket() {
    setRunningDocket(true)
    setDocketStep(0)
    docketIntervalRef.current = setInterval(() => {
      setDocketStep((s) => Math.min(s + 1, DOCKET_STEPS.length - 1))
    }, 2800)
    try {
      const auth  = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      const res   = await fetch('/api/agent/docket', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.run_id) {
        router.push(`/agent?run=${data.run_id}`)
      } else {
        alert('Agent run failed — please try again.')
      }
    } catch {
      alert('Agent run failed — please try again.')
    } finally {
      clearInterval(docketIntervalRef.current)
      setRunningDocket(false)
    }
  }

  async function clearQueue() {
    if (!confirm('Delete all cases in your queue? This cannot be undone.')) return
    setClearing(true)
    try {
      const auth  = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      await axiosClient.delete('/api/cases/clear', { headers: { Authorization: `Bearer ${token}` } })
      reset()
      refetch()
    } catch { /* ignore */ }
    finally { setClearing(false) }
  }

  useEffect(() => {
    if (!authLoading && !user && !isDemo) router.replace('/login')
  }, [user, authLoading, router, isDemo])

  useEffect(() => {
    if (status === 'complete') { refetch(); setShowStrip(true); setShowUpload(false) }
  }, [status, refetch])

  // Auto-show upload zone when queue is empty
  useEffect(() => {
    if (!isDemo && !casesLoading && dbCases.length === 0 && uploadedCases.length === 0) {
      setShowUpload(true)
    }
  }, [isDemo, casesLoading, dbCases.length, uploadedCases.length])

  useEffect(() => {
    if (!isDemo) return
    setDemoLoading(true)
    fetch('/api/demo/queue')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data) => setDemoCases(data.cases || []))
      .catch(() => setDemoError(true))
      .finally(() => setDemoLoading(false))
  }, [isDemo])

  if (authLoading && !isDemo) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>Loading…</span>
    </div>
  )

  const displayCases = isDemo
    ? demoCases
    : uploadedCases.length > 0 ? uploadedCases : dbCases

  const loading = isDemo ? demoLoading : casesLoading

  let queueHeading = isDemo ? 'Demo Queue' : 'Case Queue'
  if (status === 'complete') {
    queueHeading = `${displayCases.length} case${displayCases.length !== 1 ? 's' : ''} scored`
    if (uploadStats?.failed) queueHeading += ` · ${uploadStats.failed} failed`
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Docket preparation overlay */}
      {runningDocket && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(247,246,243,0.92)',
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '24px',
        }}>
          {/* Spinner */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            border: '2px solid var(--border)',
            borderTop: '2px solid var(--accent)',
            animation: 'spin 0.9s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '6px',
            }}>
              Preparing Tomorrow&apos;s Docket
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
              color: 'var(--text-2)', minHeight: '20px', marginBottom: '4px',
              transition: 'opacity 300ms',
            }}>
              {DOCKET_STEPS[docketStep]?.label}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
              minHeight: '16px',
            }}>
              {DOCKET_STEPS[docketStep]?.sub}
            </div>
          </div>
          {/* Step progress dots */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {DOCKET_STEPS.map((_, i) => (
              <span key={i} style={{
                width: i === docketStep ? '20px' : '5px',
                height: '5px',
                borderRadius: '3px',
                background: i < docketStep
                  ? 'var(--accent)'
                  : i === docketStep
                    ? 'var(--accent)'
                    : 'var(--border-mid)',
                transition: 'all 350ms ease',
                opacity: i < docketStep ? 0.5 : 1,
              }} />
            ))}
          </div>
          {/* Step count */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)',
          }}>
            Step {docketStep + 1} of {DOCKET_STEPS.length}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {[
              { label: 'Gemini Pro', color: 'rgba(67,56,202,0.07)', textColor: '#4338CA', border: 'rgba(67,56,202,0.18)' },
              { label: 'MongoDB Atlas', color: 'rgba(22,163,74,0.07)', textColor: '#16A34A', border: 'rgba(22,163,74,0.18)' },
              { label: 'CourtListener', color: 'rgba(37,99,235,0.07)', textColor: '#2563EB', border: 'rgba(37,99,235,0.18)' },
            ].map((t) => (
              <span key={t.label} style={{
                padding: '3px 9px',
                background: t.color,
                color: t.textColor,
                border: `1px solid ${t.border}`,
                borderRadius: '4px',
                fontWeight: 500,
              }}>{t.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Demo banner */}
      {isDemo && !demoError && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '9px 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)' }}>
              Demo mode — sample data, no account required
            </span>
          </div>
          <a href="/register" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
            Create free account →
          </a>
        </div>
      )}

      {/* Demo error */}
      {isDemo && demoError && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid rgba(220,38,38,0.2)',
          padding: '9px 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--urgent)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)' }}>
              Demo unavailable — please try signing in
            </span>
          </div>
          <a href="/login" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            Sign in →
          </a>
        </div>
      )}

      {/* Page header */}
      <div style={{
        height: '52px', padding: '0 2rem',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--text)', letterSpacing: '-0.015em',
          }}>
            {isDemo ? 'Operations Center · Demo' : 'Operations Center'}
          </h1>
          {(status === 'processing' || status === 'uploading') && (
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
              animation: 'pulse 1.4s ease-in-out infinite',
            }}>
              Analyzing…
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isDemo && uploadedCases.length > 0 && (
            <button
              onClick={reset}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)',
                padding: '5px 12px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'transparent',
                transition: 'color 150ms, border-color 150ms', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Clear upload
            </button>
          )}
          {!isDemo && displayCases.length > 0 && (
            <button
              onClick={clearQueue}
              disabled={clearing}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--urgent)',
                padding: '5px 12px', border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 'var(--radius-sm)', background: 'transparent',
                opacity: clearing ? 0.5 : 1, transition: 'opacity 150ms', cursor: 'pointer',
              }}
            >
              {clearing ? 'Clearing…' : 'Clear Queue'}
            </button>
          )}
          {!isDemo && (
            <button
              onClick={() => setShowUpload((v) => !v)}
              disabled={status === 'uploading' || status === 'processing'}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
                color: showUpload ? 'var(--text)' : 'var(--text-2)',
                padding: '5px 14px',
                background: showUpload ? 'var(--bg-raised)' : 'transparent',
                border: '1px solid var(--border-mid)',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 150ms', cursor: 'pointer',
                opacity: (status === 'uploading' || status === 'processing') ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { if (!showUpload) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' } }}
              onMouseLeave={(e) => { if (!showUpload) { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-mid)' } }}
            >
              {status === 'uploading' || status === 'processing' ? 'Processing…' : 'Import Cases'}
            </button>
          )}
          {!isDemo && (
            <button
              onClick={prepareDocket}
              disabled={runningDocket}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
                color: '#FFFFFF',
                background: runningDocket ? 'var(--accent-dim)' : 'var(--accent)',
                padding: '5px 16px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                transition: 'opacity 150ms', cursor: runningDocket ? 'wait' : 'pointer',
                opacity: runningDocket ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={(e) => { if (!runningDocket) e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={(e) => { if (!runningDocket) e.currentTarget.style.opacity = '1' }}
            >
              {runningDocket ? (
                <>
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    borderTop: '1.5px solid #FFF',
                    animation: 'spin 0.8s linear infinite',
                    flexShrink: 0,
                  }} />
                  Running…
                </>
              ) : 'Prepare Tomorrow\'s Docket'}
            </button>
          )}
        </div>
      </div>

      <main style={{ padding: '1.5rem 2rem 4rem' }}>

        {/* Agent summary strip */}
        {!isDemo && showStrip && agentStats && (
          <AgentSummaryStrip stats={agentStats} onDismiss={() => setShowStrip(false)} isDemo={false} />
        )}
        {isDemo && !demoLoading && !demoError && (
          <AgentSummaryStrip
            stats={{ cases_scored: 5, emails_drafted: 5, calendar_blocks_created: 3, briefs_generated: 2, duration_ms: 8300 }}
            onDismiss={() => {}}
            isDemo={true}
          />
        )}

        {/* Upload zone — collapsible */}
        {!isDemo && showUpload && (
          <div style={{ marginBottom: '1.5rem' }}>
            <UploadZone status={status} onUpload={upload} error={uploadError} />
            {/* Demo seed option */}
            <div style={{
              marginTop: '12px', padding: '12px 16px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>
                  Load sample dataset
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
                  50 realistic legal aid cases — optimized for demos and testing
                </div>
              </div>
              <button
                onClick={seedDemoData}
                disabled={seedingDemo}
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
                  color: seedSuccess ? '#16A34A' : 'var(--accent)',
                  background: seedSuccess ? 'rgba(22,163,74,0.08)' : 'rgba(67,56,202,0.06)',
                  border: `1px solid ${seedSuccess ? 'rgba(22,163,74,0.18)' : 'rgba(67,56,202,0.2)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '7px 16px',
                  cursor: seedingDemo ? 'wait' : 'pointer',
                  opacity: seedingDemo ? 0.7 : 1,
                  whiteSpace: 'nowrap', transition: 'all 150ms',
                  flexShrink: 0,
                }}
              >
                {seedingDemo ? 'Loading…' : seedSuccess ? '✓ 50 cases loaded' : 'Load 50 sample cases →'}
              </button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {(displayCases.length > 0 || loading) && (
          <StatsBar cases={displayCases} loading={loading && displayCases.length === 0} />
        )}

        {displayCases.length > 0 && (
          <ActionRequiredStrip cases={displayCases} />
        )}

        {/* Agent action prompt — visible when queue has cases */}
        {!isDemo && displayCases.length > 0 && !showUpload && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 16px',
            background: 'rgba(67,56,202,0.04)',
            border: '1px solid rgba(67,56,202,0.12)',
            borderTop: 'none',
            borderRadius: '0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                {displayCases.length} cases in queue
              </span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                · Run the autonomous agent to analyze urgency, retrieve precedents, and prepare tomorrow&apos;s docket
              </span>
            </div>
            <button
              onClick={prepareDocket}
              disabled={runningDocket}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600,
                color: 'var(--accent)', background: 'transparent', border: 'none',
                cursor: runningDocket ? 'wait' : 'pointer', padding: 0, whiteSpace: 'nowrap',
              }}
            >
              {runningDocket ? 'Running…' : 'Prepare docket →'}
            </button>
          </div>
        )}

        {/* Workflow clarity strip — shown when both workflows have been or can be used */}
        {!isDemo && displayCases.length > 0 && (
          <div style={{
            borderBottom: '1px solid var(--border)',
            borderLeft: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-raised)',
            padding: '8px 16px',
            display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap',
          }}>
            {/* Intake workflow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em' }}>INTAKE</span>
              {[
                { label: 'Upload', sub: 'CSV / TXT / PDF' },
                { label: 'Extract', sub: 'Gemini Flash' },
                { label: 'Score', sub: 'Deterministic' },
                { label: 'Queue', sub: 'MongoDB Atlas' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--text-3)' }}>›</span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
                    color: 'var(--text-2)', padding: '2px 6px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '3px',
                  }} title={s.sub}>{s.label}</span>
                </div>
              ))}
            </div>
            {/* Arrow to docket */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 10px', flexShrink: 0 }}>
              <div style={{ width: '24px', height: '1px', background: 'var(--accent)', opacity: 0.4 }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>↓</span>
              <div style={{ width: '24px', height: '1px', background: 'var(--accent)', opacity: 0.4 }} />
            </div>
            {/* Docket workflow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em' }}>DOCKET</span>
              {[
                { label: 'Model Decision', sub: 'Gemini Flash selects strategy' },
                { label: '$vectorSearch', sub: 'Atlas historical retrieval' },
                { label: 'Precedents', sub: 'CourtListener (conditional)' },
                { label: 'Recommendations', sub: 'Gemini Flash' },
                { label: 'Brief', sub: 'Printable PDF' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--text-3)' }}>›</span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
                    color: 'var(--accent)', padding: '2px 6px',
                    background: 'rgba(67,56,202,0.06)', border: '1px solid rgba(67,56,202,0.15)', borderRadius: '3px',
                  }} title={s.sub}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queue header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          height: '40px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderTop: displayCases.length > 0 || loading ? 'none' : '1px solid var(--border)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600,
            color: 'var(--text-3)', letterSpacing: '0',
          }}>
            {queueHeading}
          </h2>
        </div>

        {/* Cases table */}
        <div style={{
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 var(--radius) var(--radius)',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
        }}>
          {loading && displayCases.length === 0 ? (
            <div style={{ padding: '2rem 1.5rem' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                  <div className="skeleton" style={{ width: '20px', height: '11px', borderRadius: '3px' }} />
                  <div className="skeleton" style={{ width: '40px', height: '22px', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '130px', height: '13px', borderRadius: '3px', marginBottom: '4px' }} />
                    <div className="skeleton" style={{ width: '190px', height: '10px', borderRadius: '3px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '70px', height: '11px', borderRadius: '3px' }} />
                  <div className="skeleton" style={{ width: '36px', height: '11px', borderRadius: '3px' }} />
                </div>
              ))}
            </div>
          ) : (
            <CaseTable cases={displayCases} selectedId={selectedId} onSelectCase={setSelectedId} />
          )}
        </div>
      </main>

      <CaseDetailPanel
        caseId={selectedId}
        caseIds={displayCases.map((c) => c.id)}
        onClose={() => setSelectedId(null)}
        onSelectCase={setSelectedId}
        overrideData={isDemo ? (demoCases.find((c) => c.id === selectedId) ?? null) : null}
      />
    </div>
  )
}

function DashboardFallback() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>Loading…</span>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardInner />
    </Suspense>
  )
}
