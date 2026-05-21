'use client'
import { useState, useEffect } from 'react'
import UrgencyBreakdown from './UrgencyBreakdown.jsx'
import SimilarCases from './SimilarCases.jsx'
import StatusBadge from './StatusBadge.jsx'
import axiosClient from '../lib/axiosClient.js'

function scoreColor(s) {
  if (s >= 80) return '#e84444'
  if (s >= 50) return '#f0a030'
  return '#22c97a'
}

function statusVariant(s) {
  if (s === 'overridden') return 'gold'
  if (s === 'reviewed')   return 'clear'
  if (s === 'closed')     return 'neutral'
  return 'neutral'
}

const TYPE_LABELS = {
  eviction: 'Eviction', immigration: 'Immigration',
  wage_theft: 'Wage Theft', custody: 'Custody',
  employment: 'Employment', other: 'Other',
}

const Divider = () => (
  <div style={{ height: '1px', background: 'var(--border)', margin: '1.25rem 0' }} />
)

const SectionLabel = ({ children, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>
      {children}
    </p>
    {action}
  </div>
)

const FactRow = ({ label, value, accent }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid var(--border)',
  }}>
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>{label}</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: accent || 'var(--text-2)', maxWidth: '55%', textAlign: 'right', fontWeight: 500 }}>
      {value}
    </span>
  </div>
)

function ScoreRing({ score }) {
  const r      = 30
  const circ   = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color  = scoreColor(score)

  return (
    <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle
          cx="40" cy="40" r={r}
          fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', color, fontWeight: 700, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
          score
        </span>
      </div>
    </div>
  )
}

function SkeletonLine({ w = '100%', h = '13px', mb = '8px' }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, marginBottom: mb, borderRadius: '3px' }} />
  )
}

function AgentTrace({ trace }) {
  const [open, setOpen] = useState(false)
  if (!trace || trace.length === 0) return null
  const totalMs  = trace.reduce((s, t) => s + (t.durationMs || 0), 0)
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
        <span style={{ fontSize: '8px' }}>{open ? '▼' : '▶'}</span>
        Agent Trace
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: errCount > 0 ? 'var(--urgent)' : 'var(--text-3)',
          fontWeight: 400, textTransform: 'none', letterSpacing: 0,
        }}>
          · {trace.length} steps · {totalMs}ms{errCount > 0 ? ` · ${errCount} error` : ''}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {trace.map((step, i) => (
            <div key={i} style={{
              padding: '8px 10px',
              background: 'var(--bg)',
              borderLeft: `2px solid ${step.error ? 'var(--urgent)' : 'var(--clear)'}`,
              borderRadius: '0 3px 3px 0',
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
  const [caseData,       setCaseData]       = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideRank,   setOverrideRank]   = useState('')
  const [overrideStatus, setOverrideStatus] = useState('idle')
  const [actionStatus,   setActionStatus]   = useState(null) // { type, state }

  const currentIndex = caseIds.indexOf(caseId)
  const hasPrev      = currentIndex > 0
  const hasNext      = currentIndex >= 0 && currentIndex < caseIds.length - 1

  useEffect(() => {
    if (!caseId) { setCaseData(null); return }
    setLoading(true)
    setCaseData(null)
    setActionStatus(null)
    axiosClient.get(`/api/cases/${caseId}`)
      .then((r) => setCaseData(r.data.case))
      .catch(() => setCaseData(null))
      .finally(() => setLoading(false))
  }, [caseId])

  async function handleStatusChange(newStatus) {
    setActionStatus({ type: newStatus, state: 'saving' })
    // Optimistic update
    setCaseData((prev) => prev ? { ...prev, status: newStatus } : prev)
    try {
      const r = await axiosClient.patch(`/api/cases/${caseId}`, { status: newStatus })
      if (r.data?.case) setCaseData(r.data.case)
      setActionStatus({ type: newStatus, state: 'done' })
      setTimeout(() => setActionStatus(null), 2500)
    } catch {
      // Keep optimistic state — will revert on next load
      setActionStatus({ type: newStatus, state: 'done' })
      setTimeout(() => setActionStatus(null), 2500)
    }
  }

  async function handleOverride() {
    if (!overrideReason.trim() || !overrideRank) return
    setOverrideStatus('saving')
    try {
      const r = await axiosClient.post(`/api/cases/${caseId}/override`, {
        reason:   overrideReason.trim(),
        new_rank: parseInt(overrideRank, 10),
      })
      setCaseData(r.data.case)
      setOverrideReason('')
      setOverrideRank('')
      setOverrideStatus('done')
      setTimeout(() => setOverrideStatus('idle'), 2500)
    } catch {
      setOverrideStatus('error')
      setTimeout(() => setOverrideStatus('idle'), 2500)
    }
  }

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-sans)', fontSize: '13px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '9px 11px', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms',
  }

  const status = caseData?.status

  return (
    <div style={{
      position: 'fixed', top: '56px', right: 0,
      width: '460px', height: 'calc(100vh - 56px)',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-panel)',
      overflowY: 'auto', overflowX: 'hidden',
      transform: caseId ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 50,
    }}>
      {/* Header bar */}
      <div style={{
        padding: '0 1.25rem', height: '52px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-raised)', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {caseIds.length > 1 && (
            <>
              <button
                onClick={() => hasPrev && onSelectCase(caseIds[currentIndex - 1])}
                disabled={!hasPrev}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '14px',
                  color: hasPrev ? 'var(--text-2)' : 'var(--text-3)',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  padding: '2px 10px', cursor: hasPrev ? 'pointer' : 'default',
                  borderRadius: 'var(--radius-sm)', lineHeight: 1,
                  transition: 'color 150ms',
                }}
              >↑</button>
              <button
                onClick={() => hasNext && onSelectCase(caseIds[currentIndex + 1])}
                disabled={!hasNext}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '14px',
                  color: hasNext ? 'var(--text-2)' : 'var(--text-3)',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  padding: '2px 10px', cursor: hasNext ? 'pointer' : 'default',
                  borderRadius: 'var(--radius-sm)', lineHeight: 1,
                  transition: 'color 150ms',
                }}
              >↓</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                {currentIndex + 1} of {caseIds.length}
              </span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: '18px', color: 'var(--text-3)', lineHeight: 1,
            padding: '4px 6px', borderRadius: 'var(--radius-sm)',
            transition: 'color 150ms, background 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = 'none' }}
        >×</button>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {loading ? (
          <div style={{ animation: 'fadeIn 200ms ease' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
              <div>
                <SkeletonLine w="160px" h="20px" mb="8px" />
                <SkeletonLine w="80px" h="11px" mb="0" />
              </div>
              <div className="skeleton" style={{ width: '80px', height: '80px', borderRadius: '50%', marginLeft: 'auto', flexShrink: 0 }} />
            </div>
            <SkeletonLine w="100%" h="60px" mb="16px" />
            <SkeletonLine w="90%" h="13px" mb="6px" />
            <SkeletonLine w="70%" h="13px" mb="24px" />
          </div>
        ) : caseData ? (
          <div style={{ animation: 'fadeIn 200ms ease' }}>

            {/* Hero: name + score ring */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', color: 'var(--text)', fontWeight: 600, marginBottom: '5px', lineHeight: 1.2 }}>
                  {caseData.client_name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>
                    {TYPE_LABELS[caseData.case_type] || caseData.case_type}
                  </span>
                  {status && status !== 'pending' && (
                    <StatusBadge
                      label={status.charAt(0).toUpperCase() + status.slice(1)}
                      variant={statusVariant(status)}
                      dot
                    />
                  )}
                </div>
              </div>
              <ScoreRing score={caseData.priority_score} />
            </div>

            {/* Priority reason */}
            {caseData.priority_reason && (
              <div style={{
                padding: '10px 14px', background: 'var(--bg-raised)',
                borderLeft: '3px solid var(--gold)',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                marginBottom: '1rem',
              }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.65 }}>
                  {caseData.priority_reason}
                </p>
              </div>
            )}

            {/* Action buttons */}
            {status !== 'closed' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                {status !== 'reviewed' ? (
                  <button
                    onClick={() => handleStatusChange('reviewed')}
                    disabled={actionStatus?.state === 'saving'}
                    style={{
                      flex: 1, fontFamily: 'var(--font-mono)', fontSize: '10px',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '8px 12px', border: '1px solid rgba(34,201,122,0.3)',
                      background: 'rgba(34,201,122,0.08)', color: 'var(--clear)',
                      borderRadius: 'var(--radius-sm)', transition: 'all 150ms',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,201,122,0.14)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34,201,122,0.08)'}
                  >
                    {actionStatus?.type === 'reviewed' && actionStatus?.state === 'done' ? '✓ Marked Reviewed' : '✓ Mark Reviewed'}
                  </button>
                ) : (
                  <div style={{
                    flex: 1, padding: '8px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--clear)', background: 'rgba(34,201,122,0.08)',
                    border: '1px solid rgba(34,201,122,0.25)', borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                  }}>
                    ✓ Reviewed
                  </div>
                )}
                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={actionStatus?.state === 'saving'}
                  style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '10px',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '8px 12px', border: '1px solid var(--border)',
                    background: 'var(--bg-hover)', color: 'var(--text-3)',
                    borderRadius: 'var(--radius-sm)', transition: 'all 150ms',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)' }}
                >
                  Close Case
                </button>
              </div>
            )}

            {status === 'closed' && (
              <div style={{
                padding: '10px 14px', background: 'var(--bg-raised)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>
                  This case is closed.
                </span>
                <button
                  onClick={() => handleStatusChange('pending')}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--gold)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  Reopen →
                </button>
              </div>
            )}

            <Divider />

            {/* Score breakdown */}
            <UrgencyBreakdown breakdown={caseData.score_breakdown} />

            <Divider />

            {/* Extracted facts */}
            <SectionLabel>Extracted Facts</SectionLabel>
            <FactRow label="Legal Deadline" value={caseData.deadline_days != null ? `${caseData.deadline_days} days` : 'Not specified'} accent={caseData.deadline_days <= 3 ? 'var(--urgent)' : caseData.deadline_days <= 7 ? 'var(--medium)' : null} />
            <FactRow label="Case Type" value={TYPE_LABELS[caseData.case_type] || caseData.case_type} />
            <FactRow label="Minor Children" value={caseData.vulnerability_flags?.minor_children ? 'Yes — elevated priority' : 'No'} accent={caseData.vulnerability_flags?.minor_children ? 'var(--medium)' : null} />
            <FactRow label="Language Barrier" value={caseData.vulnerability_flags?.language_barrier ? 'Yes' : 'No'} />
            <FactRow label="Medical Condition" value={caseData.vulnerability_flags?.medical_condition ? 'Yes — elevated priority' : 'No'} accent={caseData.vulnerability_flags?.medical_condition ? 'var(--urgent)' : null} />
            {caseData.missing_info?.length > 0 && (
              <FactRow label="Missing Information" value={caseData.missing_info.join('; ')} accent="var(--medium)" />
            )}

            <Divider />

            {/* Similar cases */}
            <SimilarCases cases={caseData.similar_cases || []} />

            {/* AI recommendation */}
            {caseData.recommendation && (
              <>
                <Divider />
                <SectionLabel>AI Recommendation</SectionLabel>
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-raised)',
                  borderLeft: '3px solid var(--border-mid)',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  marginBottom: '8px',
                }}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.75 }}>
                    {caseData.recommendation}
                  </p>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                  AI-generated · Always verify before taking action
                </p>
              </>
            )}

            {/* Agent trace */}
            {caseData.agent_trace?.length > 0 && (
              <>
                <Divider />
                <AgentTrace trace={caseData.agent_trace} />
              </>
            )}

            <Divider />

            {/* Override ranking */}
            <SectionLabel>Override Ranking</SectionLabel>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px', lineHeight: 1.5 }}>
              Manually reposition this case in the queue. All overrides are logged with your reason for audit purposes.
            </p>
            <input
              type="number" min={1} placeholder="New rank position (e.g. 1)"
              value={overrideRank}
              onChange={(e) => setOverrideRank(e.target.value)}
              style={{ ...inputStyle, marginBottom: '8px' }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <textarea
              rows={3}
              placeholder="Reason for override (required for audit trail)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px', lineHeight: 1.55 }}
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
                color: '#000', border: 'none',
                borderRadius: 'var(--radius-sm)', padding: '11px',
                cursor: 'pointer', fontWeight: 700,
                opacity: (!overrideReason.trim() || !overrideRank) ? 0.4 : 1,
                transition: 'background 200ms, opacity 150ms',
              }}
            >
              {overrideStatus === 'saving' ? 'Saving…'
                : overrideStatus === 'done' ? '✓ Override Recorded'
                : 'Save Override'}
            </button>
            {overrideStatus === 'error' && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--urgent)', marginTop: '8px', textAlign: 'center' }}>
                Failed to save — please try again
              </p>
            )}

            {/* Bottom padding */}
            <div style={{ height: '2rem' }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
