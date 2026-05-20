// Fixed right panel 480px — case details, scoring breakdown, similar cases, AI rec, override
'use client'
import { useState, useEffect } from 'react'
import UrgencyBreakdown from './UrgencyBreakdown.jsx'
import SimilarCases from './SimilarCases.jsx'
import axiosClient from '../lib/axiosClient.js'

function scoreColor(score) {
  if (score >= 80) return 'var(--stamp)'
  if (score >= 50) return 'var(--ochre)'
  return 'var(--forest)'
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
      {title}
    </p>
    {children}
  </div>
)

const FactRow = ({ label, value, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-3)' }}>{label}</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: highlight ? 'var(--ochre)' : 'var(--ink-2)', maxWidth: '60%', textAlign: 'right' }}>{value}</span>
  </div>
)

export default function CaseDetailPanel({ caseId, onClose }) {
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideRank, setOverrideRank] = useState('')
  const [overrideStatus, setOverrideStatus] = useState('idle')

  useEffect(() => {
    if (!caseId) { setCaseData(null); return }
    setLoading(true)
    axiosClient.get(`/api/cases/${caseId}`)
      .then((res) => setCaseData(res.data.case))
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false))
  }, [caseId])

  async function handleOverride() {
    if (!overrideReason.trim() || !overrideRank) return
    setOverrideStatus('saving')
    try {
      const res = await axiosClient.post(`/api/cases/${caseId}/override`, {
        reason: overrideReason.trim(),
        new_rank: parseInt(overrideRank, 10),
      })
      setCaseData(res.data.case)
      setOverrideReason('')
      setOverrideRank('')
      setOverrideStatus('done')
    } catch {
      setOverrideStatus('error')
    }
  }

  const isOpen = Boolean(caseId)

  return (
    <div
      style={{
        position: 'fixed',
        top: '52px',
        right: 0,
        width: '480px',
        height: 'calc(100vh - 52px)',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border-dark)',
        overflowY: 'auto',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        zIndex: 50,
      }}
    >
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            {loading ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-3)' }}>LOADING...</p>
            ) : caseData ? (
              <>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--ink)', lineHeight: 1.2, marginBottom: '4px' }}>
                  {caseData.client_name}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
                  {caseData.case_type?.replace('_', ' ')}
                </p>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '72px', color: scoreColor(caseData.priority_score), lineHeight: 1 }}>
                  {caseData.priority_score}
                </div>
                {caseData.priority_reason && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--ink-2)', marginTop: '4px', lineHeight: 1.5 }}>
                    {caseData.priority_reason}
                  </p>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={onClose}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--ink-3)', lineHeight: 1, padding: '0 0 0 1rem', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {caseData && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <UrgencyBreakdown breakdown={caseData.score_breakdown} />
            </div>

            <Section title="Extracted Facts">
              <FactRow label="Deadline" value={caseData.deadline_days != null ? `${caseData.deadline_days} days` : '—'} />
              <FactRow label="Case Type" value={caseData.case_type?.replace('_', ' ')} />
              <FactRow label="Minor Children" value={caseData.vulnerability_flags?.minor_children ? 'Yes' : 'No'} />
              <FactRow label="Language Barrier" value={caseData.vulnerability_flags?.language_barrier ? 'Yes' : 'No'} />
              <FactRow label="Medical Condition" value={caseData.vulnerability_flags?.medical_condition ? 'Yes' : 'No'} />
              {caseData.missing_info?.length > 0 && (
                <FactRow label="Missing Info" value={caseData.missing_info.join('; ')} highlight />
              )}
            </Section>

            <div style={{ marginBottom: '1.5rem' }}>
              <SimilarCases cases={caseData.similar_cases || []} />
            </div>

            {caseData.recommendation && (
              <Section title={<>AI Recommendation <span style={{ color: 'var(--ink-3)', fontSize: '10px' }}>(AI-generated)</span></>}>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.7 }}>
                  {caseData.recommendation}
                </p>
              </Section>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
                Override Ranking
              </p>
              <input
                type="number"
                min={1}
                placeholder="New rank (e.g. 1)"
                value={overrideRank}
                onChange={(e) => setOverrideRank(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  padding: '8px',
                  color: 'var(--ink)',
                  marginBottom: '0.5rem',
                  outline: 'none',
                }}
              />
              <textarea
                rows={3}
                placeholder="Reason for override..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  padding: '8px',
                  color: 'var(--ink)',
                  resize: 'none',
                  outline: 'none',
                  marginBottom: '0.5rem',
                }}
              />
              <button
                onClick={handleOverride}
                disabled={!overrideReason.trim() || !overrideRank || overrideStatus === 'saving'}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'var(--stamp)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 0,
                  padding: '10px',
                  cursor: 'pointer',
                  opacity: (!overrideReason.trim() || !overrideRank) ? 0.5 : 1,
                }}
              >
                {overrideStatus === 'saving' ? 'SAVING...' : overrideStatus === 'done' ? 'SAVED' : 'OVERRIDE RANKING'}
              </button>
              {overrideStatus === 'error' && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--stamp)', marginTop: '0.5rem' }}>Override failed. Try again.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
