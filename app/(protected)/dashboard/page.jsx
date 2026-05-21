// Dashboard — protected route with stats summary + upload + ranked case table
'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useCases } from '../../../hooks/useCases.js'
import { useUpload } from '../../../hooks/useUpload.js'
import Navbar from '../../../components/Navbar.jsx'
import UploadZone from '../../../components/UploadZone.jsx'
import CaseTable from '../../../components/CaseTable.jsx'
import CaseDetailPanel from '../../../components/CaseDetailPanel.jsx'

function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      padding: '1.25rem 1.5rem',
      borderRight: '1px solid var(--border)',
    }}>
      {loading ? (
        <>
          <div className="skeleton" style={{ width: '60px', height: '32px', marginBottom: '6px', borderRadius: '3px' }} />
          <div className="skeleton" style={{ width: '80px', height: '10px', borderRadius: '3px' }} />
        </>
      ) : (
        <>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: '30px',
            color: accent || 'var(--text)', lineHeight: 1, marginBottom: '4px',
            transition: 'color 300ms',
          }}>
            {value ?? '—'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
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
        accent={critical > 0 ? 'var(--urgent)' : null} />
      <StatCard label="Average Score"  value={avg}       sub="urgency index"    loading={loading}
        accent={avg != null && avg >= 70 ? 'var(--medium)' : avg != null && avg >= 50 ? 'var(--gold)' : null} />
      <StatCard label="Overridden"     value={overridden} sub="manual adjustments" loading={loading}
        accent={overridden > 0 ? 'var(--gold)' : null} />
    </div>
  )
}

function DashboardInner() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const isDemo       = searchParams.get('demo') === 'true'

  const { cases: dbCases, loading: casesLoading, refetch } = useCases()
  const { status, cases: uploadedCases, stats: uploadStats, error: uploadError, upload, reset } = useUpload()
  const [selectedId,   setSelectedId]   = useState(null)
  const [demoCases,    setDemoCases]    = useState([])
  const [demoLoading,  setDemoLoading]  = useState(false)

  useEffect(() => {
    if (!authLoading && !user && !isDemo) router.replace('/login')
  }, [user, authLoading, router, isDemo])

  useEffect(() => {
    if (status === 'complete') refetch()
  }, [status, refetch])

  useEffect(() => {
    if (!isDemo) return
    setDemoLoading(true)
    fetch('/api/demo/queue')
      .then((r) => r.json())
      .then((data) => setDemoCases(data.cases || []))
      .catch(() => {})
      .finally(() => setDemoLoading(false))
  }, [isDemo])

  if (authLoading && !isDemo) return null

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar caseCount={displayCases.length > 0 ? displayCases.length : undefined} />

      {/* Demo banner */}
      {isDemo && (
        <div style={{
          background: 'var(--medium)', padding: '8px 2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#000', opacity: 0.5, flexShrink: 0,
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#000', opacity: 0.8 }}>
              Demo Mode — sample data only, no account required
            </span>
          </div>
          <a
            href="/register"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#000', textDecoration: 'underline', whiteSpace: 'nowrap',
            }}
          >
            Create free account →
          </a>
        </div>
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 2rem 4rem' }}>

        {/* Upload zone — only for authenticated users */}
        {!isDemo && (
          <div style={{ marginBottom: '2rem' }}>
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
          padding: '12px 16px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderTop: displayCases.length > 0 || loading ? 'none' : '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
              color: 'var(--text)', letterSpacing: '-0.01em',
            }}>
              {queueHeading}
            </h2>
            {status === 'processing' || status === 'uploading' ? (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}>
                Analyzing…
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {uploadedCases.length > 0 && !isDemo && (
              <button
                onClick={reset}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'var(--text-3)', padding: '4px 10px',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  transition: 'color 150ms, border-color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                Clear upload
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
            <div style={{ padding: '3rem 2rem' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                  <div className="skeleton" style={{ width: '24px', height: '12px', borderRadius: '3px' }} />
                  <div className="skeleton" style={{ width: '46px', height: '24px', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '140px', height: '14px', borderRadius: '3px', marginBottom: '4px' }} />
                    <div className="skeleton" style={{ width: '200px', height: '11px', borderRadius: '3px' }} />
                  </div>
                  <div className="skeleton" style={{ width: '80px', height: '12px', borderRadius: '3px' }} />
                  <div className="skeleton" style={{ width: '40px', height: '12px', borderRadius: '3px' }} />
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
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  )
}
