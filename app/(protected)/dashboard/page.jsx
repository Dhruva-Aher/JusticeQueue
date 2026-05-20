// Dashboard — Navbar + UploadZone + CaseTable + CaseDetailPanel (protected route)
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useCases } from '../../../hooks/useCases.js'
import { useUpload } from '../../../hooks/useUpload.js'
import Navbar from '../../../components/Navbar.jsx'
import UploadZone from '../../../components/UploadZone.jsx'
import CaseTable from '../../../components/CaseTable.jsx'
import CaseDetailPanel from '../../../components/CaseDetailPanel.jsx'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { cases: dbCases, loading: casesLoading, refetch } = useCases()
  const { status, cases: uploadedCases, error: uploadError, upload, reset } = useUpload()
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (status === 'complete') refetch()
  }, [status, refetch])

  if (authLoading) return null

  const displayCases = uploadedCases.length > 0 ? uploadedCases : dbCases

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <UploadZone status={status} onUpload={upload} error={uploadError} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', color: 'var(--ink)' }}>
            {status === 'complete' ? `${displayCases.length} cases scored` : 'Priority Queue'}
          </h2>
          {uploadedCases.length > 0 && (
            <button
              onClick={reset}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-3)', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 0 }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)' }}>
          {casesLoading && displayCases.length === 0 ? (
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
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
