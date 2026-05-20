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

function AgentTrace({ trace }) {
  const [open, setOpen] = useState(false)
  if (!trace || trace.length === 0) return null

  const totalMs = trace.reduce((sum, s) => sum + (s.durationMs || 0), 0)
  const failed = trace.filter((s) => s.error).length

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span>{open ? '▼' : '▶'}</span>
        Agent Trace
        <span style={{ color: failed > 0 ? 'var(--stamp)' : 'var(--forest)' }}>
          ({trace.length} steps · {totalMs}ms{failed > 0 ? ` · ${failed} errors` : ''})
        </span>
      </button>
      {open && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {trace.map((step, i) => (
            <div key={i} style={{ background: 'var(--bg-inset)', padding: '8px 10px', borderLeft: `2px solid ${step.error ? 'var(--stamp)' : 'var(--forest)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink)', letterSpacing: '0.04em' }}>{step.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-3)' }}>{step.durationMs}ms</span>
              </div>
              {step.error ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--stamp)' }}>{step.error}</p>
              ) : step.output ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-3)', wordBreak: 'break-word' }}>
                  {Object.entries(step.output).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SkeletonLine = ({ width = '100%', height = '12px', marginBottom = '8px' }) => (
  <div style={{ width, height, background: 'var(--bg-raised)', marginBottom, animation: 'pulse 1.5s ease-in-out infinite' }} />
)

export default function CaseDetailPanel({ caseId, caseIds = [], onClose, onSelectCase }) {
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideRank, setOverrideRank] = useState('')
  const [overrideStatus, setOverrideStatus] = useState('idle')

  const currentIndex = caseIds.indexOf(caseId)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < caseIds.length - 1

  useEffect(() => {
    if (!caseId) { setCaseData(null); return }
    setLoading(true)
    setCaseData(null)
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
      setTimeout(() => setOverrideStatus('idle'), 2000)
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
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            {loading ? (
              <>
                <SkeletonLine width="60%" height="22px" marginBottom="8px" />
                <SkeletonLine width="40%" height="11px" marginBottom="12px" />
                <SkeletonLine width="80px" height="60px" marginBottom="8px" />
                <SkeletonLine width="90%" height="13px" />
              </>
            ) : caseData ? (
              <>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--ink)', lineHeight: 1.2, marginBottom: '4px' }}>
                  {caseData.client_name}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: '0.75rem' }}>
                  {caseData.case_type?.replace(/_/g, ' ')}
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', paddingLeft: '1rem', flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: 'var(--ink-3)', lineHeight: 1, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>
            {caseIds.length > 1 && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => hasPrev && onSelectCase(caseIds[currentIndex - 1])}
                  disabled={!hasPrev}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasPrev ? 'var(--ink)' : 'var(--ink-3)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 0, padding: '2px 8px', cursor: hasPrev ? 'pointer' : 'default' }}
                >
                  ↑
                </button>
                <button
                  onClick={() => hasNext && onSelectCase(caseIds[currentIndex + 1])}
                  disabled={!hasNext}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasNext ? 'var(--ink)' : 'var(--ink-3)', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 0, padding: '2px 8px', cursor: hasNext ? 'pointer' : 'default' }}
                >
                  ↓
                </button>
              </div>
            )}
          </div>
        </div>

        {caseData && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <UrgencyBreakdown breakdown={caseData.score_breakdown} />
            </div>

            <Section title="Extracted Facts">
              <FactRow label="Deadline" value={caseData.deadline_days != null ? `${caseData.deadline_days} days` : '—'} />
              <FactRow label="Case Type" value={caseData.case_type?.replace(/_/g, ' ')} />
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

            {caseData.agent_trace && (
              <div style={{ marginBottom: '1.5rem' }}>
                <AgentTrace trace={caseData.agent_trace} />
              </div>
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
                  boxSizing: 'border-box',
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
                  boxSizing: 'border-box',
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
                  background: overrideStatus === 'done' ? 'var(--forest)' : 'var(--stamp)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 0,
                  padding: '10px',
                  cursor: 'pointer',
                  opacity: (!overrideReason.trim() || !overrideRank) ? 0.5 : 1,
                  transition: 'background 200ms ease',
                }}
              >
                {overrideStatus === 'saving' ? 'SAVING...' : overrideStatus === 'done' ? 'OVERRIDE RECORDED ✓' : 'OVERRIDE RANKING'}
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
