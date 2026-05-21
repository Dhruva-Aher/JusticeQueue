// Dashboard — Navbar + UploadZone + CaseTable + CaseDetailPanel (protected route)
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

function DashboardInner() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'

  const { cases: dbCases, loading: casesLoading, refetch } = useCases()
  const { status, cases: uploadedCases, stats: uploadStats, error: uploadError, upload, reset } = useUpload()
  const [selectedId, setSelectedId] = useState(null)
  const [demoCases, setDemoCases] = useState([])
  const [demoLoading, setDemoLoading] = useState(false)

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {isDemo && (
        <div style={{ background: 'var(--ochre)', padding: '8px 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff' }}>
            Demo Mode — sample data, no login required
          </span>
          <a
            href="/login"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', textDecoration: 'underline' }}
          >
            Sign in to use your clinic&apos;s queue →
          </a>
        </div>
      )}

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {!isDemo && (
          <div style={{ marginBottom: '2rem' }}>
            <UploadZone status={status} onUpload={upload} error={uploadError} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--ink)' }}>
            {status === 'complete'
              ? `${displayCases.length} cases scored${uploadStats?.failed ? ` (${uploadStats.failed} failed)` : ''}`
              : isDemo
              ? 'Demo Priority Queue'
              : 'Priority Queue'}
          </h2>
          {uploadedCases.length > 0 && !isDemo && (
            <button
              onClick={reset}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 0 }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)' }}>
          {loading && displayCases.length === 0 ? (
            <p style={{ padding: '2rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)', textAlign: 'center' }}>
              LOADING QUEUE...
            </p>
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
