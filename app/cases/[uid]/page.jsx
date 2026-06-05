'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import axiosClient from '../../../lib/axiosClient.js'
import DeltaVisualization from '../../../components/DeltaVisualization.jsx'
import HistoricalOutcomesPanel from '../../../components/HistoricalOutcomesPanel.jsx'
import ReviewActionPanel from '../../../components/ReviewActionPanel.jsx'
import UrgencyBreakdown from '../../../components/UrgencyBreakdown.jsx'

export default function CaseDetailPage() {
  const { uid } = useParams()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    axiosClient.get(`/api/cases/${uid}`)
      .then(res => setCaseData(res.data.case))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [uid])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading case details...</div>
  if (!caseData) return <div style={{ padding: '40px', textAlign: 'center' }}>Case not found.</div>

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Left Column: Case Information & Priority Assessment */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {caseData.id || uid} · {caseData.case_type?.replace('_', ' ')}
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)', marginTop: '4px', marginBottom: '8px' }}>
                {caseData.client_name || 'Client Name'}
              </h1>
            </div>
            <span style={{ background: 'var(--bg-raised)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
              {caseData.status?.toUpperCase() || 'PENDING'}
            </span>
          </div>

          <DeltaVisualization 
            baseline={caseData.score_without_retrieval} 
            final={caseData.priority_score} 
            reasoning={caseData.priority_reason} 
          />

          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Case Summary</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
              {caseData.summary}
            </p>

            <UrgencyBreakdown breakdown={caseData.score_breakdown} caseType={caseData.case_type} />
          </div>

        </div>

        {/* Right Column: Review Actions & Historical Outcomes */}
        <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          <HistoricalOutcomesPanel precedents={caseData.similar_cases || []} />

          {caseData.status !== 'closed' && (
            <ReviewActionPanel 
              uid={uid} 
              currentScore={caseData.priority_score}
              onComplete={(newStatus, newScore) => {
                setCaseData(prev => ({ 
                  ...prev, 
                  status: newStatus || prev.status,
                  priority_score: newScore ?? prev.priority_score
                }))
              }}
            />
          )}
        </div>

      </div>
    </div>
  )
}
