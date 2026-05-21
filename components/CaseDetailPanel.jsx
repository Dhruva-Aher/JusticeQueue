'use client'
import { useState, useEffect } from 'react'
import UrgencyBreakdown from './UrgencyBreakdown.jsx'
import SimilarCases from './SimilarCases.jsx'
import axiosClient from '../lib/axiosClient.js'

function scoreColor(s) {
  if (s >= 80) return '#e84444'
  if (s >= 50) return '#f0a030'
  return '#22c97a'
}

const TYPE_LABELS = {
  eviction: 'Eviction', immigration: 'Immigration',
  wage_theft: 'Wage Theft', custody: 'Custody',
  employment: 'Employment', other: 'Other',
}

const Divider = () => <div style={{ height: '1px', background: 'var(--border)', margin: '1.25rem 0' }} />

const Label = ({ children }) => (
  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '0.6rem' }}>
    {children}
  </p>
)

const FactRow = ({ label, value, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>{label}</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: accent || 'var(--text-2)', maxWidth: '55%', textAlign: 'right', fontWeight: 500 }}>{value}</span>
  </div>
)

const SkeletonLine = ({ w = '100%', h = '12px', mb = '8px' }) => (
  <div style={{ width: w, height: h, background: 'var(--bg-raised)', marginBottom: mb, borderRadius: '2px', animation: 'pulse 1.4s ease-in-out infinite' }} />
)

function AgentTrace({ trace }) {
  const [open, setOpen] = useState(false)
  if (!trace || trace.length === 0) return null
  const totalMs = trace.reduce((s, t) => s + (t.durationMs || 0), 0)
  const errCount = trace.filter((t) => t.error).length

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--text-3)', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--text-3)', fontSize: '8px' }}>{open ? '▼' : '▶'}</span>
        Agent Trace
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: errCount > 0 ? 'var(--urgent)' : 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          · {trace.length} steps · {totalMs}ms
        </span>
      </button>
      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {trace.map((step, i) => (
            <div key={i} style={{
              padding: '8px 10px',
              background: 'var(--bg-surface)',
              borderLeft: `2px solid ${step.error ? 'var(--urgent)' : 'var(--clear)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', letterSpacing: '0.02em' }}>{step.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>{step.durationMs}ms</span>
              </div>
              {step.error ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--urgent)' }}>{step.error}</p>
              ) : step.output ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', wordBreak: 'break-word', lineHeight: 1.5 }}>
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
      .then((r) => setCaseData(r.data.case))
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false))
  }, [caseId])

  async function handleOverride() {
    if (!overrideReason.trim() || !overrideRank) return
    setOverrideStatus('saving')
    try {
      const r = await axiosClient.post(`/api/cases/${caseId}/override`, {
        reason: overrideReason.trim(),
        new_rank: parseInt(overrideRank, 10),
      })
      setCaseData(r.data.case)
      setOverrideReason('')
      setOverrideRank('')
      setOverrideStatus('done')
      setTimeout(() => setOverrideStatus('idle'), 2200)
    } catch {
      setOverrideStatus('error')
    }
  }

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: '2px', padding: '9px 11px', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms',
  }

  return (
    <div style={{
      position: 'fixed', top: '56px', right: 0,
      width: '440px', height: 'calc(100vh - 56px)',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      overflowY: 'auto', overflowX: 'hidden',
      transform: caseId ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 50,
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-raised)' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {caseIds.length > 1 && (
            <>
              <button
                onClick={() => hasPrev && onSelectCase(caseIds[currentIndex - 1])}
                disabled={!hasPrev}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasPrev ? 'var(--text-2)' : 'var(--text-3)', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '3px 10px', cursor: hasPrev ? 'pointer' : 'default', borderRadius: '2px' }}
              >↑</button>
              <button
                onClick={() => hasNext && onSelectCase(caseIds[currentIndex + 1])}
                disabled={!hasNext}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: hasNext ? 'var(--text-2)' : 'var(--text-3)', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '3px 10px', cursor: hasNext ? 'pointer' : 'default', borderRadius: '2px' }}
              >↓</button>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', color: 'var(--text-3)', lineHeight: 1, padding: '0 2px', transition: 'color 150ms' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
        >×</button>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {loading ? (
          <>
            <SkeletonLine w="55%" h="24px" mb="8px" />
            <SkeletonLine w="35%" h="11px" mb="16px" />
            <SkeletonLine w="70px" h="56px" mb="10px" />
            <SkeletonLine w="85%" h="13px" mb="4px" />
            <SkeletonLine w="70%" h="13px" mb="24px" />
          </>
        ) : caseData ? (
          <div style={{ animation: 'fadeIn 200ms ease' }}>
            {/* Score hero */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', color: 'var(--text)', fontWeight: 600, marginBottom: '3px' }}>
                  {caseData.client_name}
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>
                  {TYPE_LABELS[caseData.case_type] || caseData.case_type}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '56px', color: scoreColor(caseData.priority_score), lineHeight: 1 }}>
                  {caseData.priority_score}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginTop: '2px' }}>priority</div>
              </div>
            </div>

            {caseData.priority_reason && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '1.25rem', padding: '10px 12px', background: 'var(--bg-raised)', borderLeft: '2px solid var(--gold)' }}>
                {caseData.priority_reason}
              </p>
            )}

            <Divider />

            {/* Score breakdown */}
            <UrgencyBreakdown breakdown={caseData.score_breakdown} />

            <Divider />

            {/* Facts */}
            <Label>Extracted Facts</Label>
            <FactRow label="Deadline" value={caseData.deadline_days != null ? `${caseData.deadline_days} days` : '—'} />
            <FactRow label="Case Type" value={TYPE_LABELS[caseData.case_type] || caseData.case_type} />
            <FactRow label="Minor Children" value={caseData.vulnerability_flags?.minor_children ? 'Yes' : 'No'} accent={caseData.vulnerability_flags?.minor_children ? 'var(--medium)' : null} />
            <FactRow label="Language Barrier" value={caseData.vulnerability_flags?.language_barrier ? 'Yes' : 'No'} />
            <FactRow label="Medical Condition" value={caseData.vulnerability_flags?.medical_condition ? 'Yes' : 'No'} accent={caseData.vulnerability_flags?.medical_condition ? 'var(--urgent)' : null} />
            {caseData.missing_info?.length > 0 && (
              <FactRow label="Missing Info" value={caseData.missing_info.join('; ')} accent="var(--medium)" />
            )}

            <Divider />

            {/* Similar cases */}
            <SimilarCases cases={caseData.similar_cases || []} />

            {caseData.recommendation && (
              <>
                <Divider />
                <Label>AI Recommendation</Label>
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.75, padding: '10px 12px', background: 'var(--bg-raised)', borderLeft: '2px solid var(--border-mid)' }}>
                  {caseData.recommendation}
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', marginTop: '6px', letterSpacing: '0.04em' }}>
                  AI-generated — verify before acting
                </p>
              </>
            )}

            {caseData.agent_trace && (
              <>
                <Divider />
                <AgentTrace trace={caseData.agent_trace} />
              </>
            )}

            <Divider />

            {/* Override */}
            <Label>Override Ranking</Label>
            <input
              type="number" min={1} placeholder="New rank position"
              value={overrideRank}
              onChange={(e) => setOverrideRank(e.target.value)}
              style={{ ...inputStyle, marginBottom: '8px' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <textarea
              rows={3} placeholder="Reason for override (required)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              style={{ ...inputStyle, resize: 'none', marginBottom: '10px', lineHeight: 1.5 }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <button
              onClick={handleOverride}
              disabled={!overrideReason.trim() || !overrideRank || overrideStatus === 'saving'}
              style={{
                width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                background: overrideStatus === 'done' ? 'var(--clear)' : 'var(--gold)',
                color: overrideStatus === 'done' ? '#000' : '#000',
                border: 'none', borderRadius: '2px', padding: '10px',
                cursor: 'pointer', fontWeight: 600,
                opacity: (!overrideReason.trim() || !overrideRank) ? 0.4 : 1,
                transition: 'background 200ms, opacity 150ms',
              }}
            >
              {overrideStatus === 'saving' ? 'Saving…' : overrideStatus === 'done' ? 'Override Recorded ✓' : 'Save Override'}
            </button>
            {overrideStatus === 'error' && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--urgent)', marginTop: '8px', textAlign: 'center' }}>Failed — try again</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
