// Dashboard — protected route with stats summary + upload + ranked case table
'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
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

function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      padding: '1rem 1.25rem',
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
            fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700,
            color: accent || 'var(--text)', lineHeight: 1, marginBottom: '5px',
            letterSpacing: '-0.03em', transition: 'color 300ms',
          }}>
            {value ?? '—'}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)',
            fontWeight: 500, marginBottom: sub ? '2px' : 0,
          }}>
            {label}
          </div>
          {sub && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatsBar({ cases, loading }) {
  const total      = cases.length
  const critical   = cases.filter((c) => (c.priority_score ?? 0) >= 80).length
  const avg        = total > 0 ? Math.round(cases.reduce((s, c) => s + (c.priority_score ?? 0), 0) / total) : null
  const overridden = cases.filter((c) => c.status === 'overridden').length

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
      <StatCard label="Total Cases"    value={total}     sub="in current queue" loading={loading} />
      <StatCard label="Critical"       value={critical}  sub="score ≥ 80"       loading={loading}
        accent={critical > 0 ? 'var(--urgent)' : undefined} />
      <StatCard label="Average Score"  value={avg}       sub="urgency index"    loading={loading}
        accent={avg != null && avg >= 70 ? 'var(--medium)' : avg != null && avg >= 50 ? 'var(--accent)' : undefined} />
      <StatCard label="Overridden"     value={overridden} sub="manual adjustments" loading={loading}
        accent={overridden > 0 ? 'var(--accent)' : undefined} />
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
  const [selectedId,  setSelectedId]  = useState(null)
  const [demoCases,   setDemoCases]   = useState([])
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError,   setDemoError]   = useState(false)
  const [clearing,    setClearing]    = useState(false)
  const [showStrip,   setShowStrip]   = useState(false)

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
    if (status === 'complete') { refetch(); setShowStrip(true) }
  }, [status, refetch])

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
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
        Loading…
      </span>
    </div>
  )

  const displayCases = isDemo
    ? demoCases
    : uploadedCases.length > 0
    ? uploadedCases
    : dbCases

  const loading = isDemo ? demoLoading : casesLoading

  // Queue heading
  let queueHeading = isDemo ? 'Demo Priority Queue' : 'Priority Queue'
  if (status === 'complete') {
    queueHeading = `${displayCases.length} case${displayCases.length !== 1 ? 's' : ''} scored`
    if (uploadStats?.failed) queueHeading += ` · ${uploadStats.failed} failed`
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Demo banner — subtle, no bright background */}
      {isDemo && !demoError && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '9px 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)' }}>
              Demo mode — sample data only, no account required
            </span>
          </div>
          <a
            href="/register"
            style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
              color: 'var(--accent)', whiteSpace: 'nowrap',
            }}
          >
            Create free account →
          </a>
        </div>
      )}

      {/* Demo error banner */}
      {isDemo && demoError && (
        <div style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid rgba(232,68,68,0.2)',
          padding: '9px 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--urgent)', flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)' }}>
              Demo unavailable — please try signing in
            </span>
          </div>
          <a
            href="/login"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap' }}
          >
            Sign in →
          </a>
        </div>
      )}

      <main style={{ padding: '1.5rem 2rem 4rem' }}>

        {/* Agent summary strip — real upload */}
        {!isDemo && showStrip && agentStats && (
          <AgentSummaryStrip
            stats={agentStats}
            onDismiss={() => setShowStrip(false)}
            isDemo={false}
          />
        )}

        {/* Agent summary strip — demo mode (always visible, hardcoded) */}
        {isDemo && !demoLoading && !demoError && (
          <AgentSummaryStrip
            stats={{ cases_scored: 5, emails_drafted: 5, calendar_blocks_created: 3, briefs_generated: 2, duration_ms: 8300 }}
            onDismiss={() => {}}
            isDemo={true}
          />
        )}

        {/* Upload zone — only for authenticated users */}
        {!isDemo && (
          <div style={{ marginBottom: '1.75rem' }}>
            <UploadZone status={status} onUpload={upload} error={uploadError} />
          </div>
        )}

        {/* Stats bar — only show when there are cases */}
        {(displayCases.length > 0 || loading) && (
          <StatsBar cases={displayCases} loading={loading && displayCases.length === 0} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
              color: 'var(--text)', letterSpacing: '-0.01em',
            }}>
              {queueHeading}
            </h2>
            {(status === 'processing' || status === 'uploading') && (
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--accent)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}>
                Analyzing…
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {uploadedCases.length > 0 && !isDemo && (
              <button
                onClick={reset}
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: '11px',
                  color: 'var(--text-3)', padding: '3px 10px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  transition: 'color 150ms, border-color 150ms', background: 'transparent', cursor: 'pointer',
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
                  fontFamily: 'var(--font-sans)', fontSize: '11px',
                  color: 'var(--urgent)', padding: '3px 10px',
                  border: '1px solid rgba(232,68,68,0.3)', borderRadius: 'var(--radius-sm)',
                  opacity: clearing ? 0.5 : 1, background: 'transparent', cursor: 'pointer',
                  transition: 'opacity 150ms',
                }}
              >
                {clearing ? 'Clearing…' : 'Clear Queue'}
              </button>
            )}
          </div>
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
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
        Loading…
      </span>
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
