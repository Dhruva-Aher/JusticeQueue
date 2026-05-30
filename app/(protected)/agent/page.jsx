'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { getFirebaseAuth } from '../../../lib/firebase.js'

// ── Formatting helpers ────────────────────────────────────────────────────────
function fmtT(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `+${ms}ms`
  return `+${(ms / 1000).toFixed(1)}s`
}
function fmtD(ms) {
  if (ms == null) return '—'
  if (ms < 100) return `${ms}ms`
  if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 1000).toFixed(1)}s`
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtDuration(ms) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ── Step result summary ───────────────────────────────────────────────────────
function stepResultSummary(result) {
  if (!result) return null
  const parts = []
  if (result.count != null)                  parts.push(`${result.count} cases`)
  if (result.critical != null && result.critical > 0) parts.push(`${result.critical} critical`)
  if (result.urgent != null && result.urgent > 0)     parts.push(`${result.urgent} urgent`)
  if (result.high_score != null)             parts.push(`${result.high_score} high-score`)
  if (result.cases_with_gaps != null)        parts.push(`${result.cases_with_gaps} incomplete`)
  if (result.similar_cases_found != null)    parts.push(`${result.similar_cases_found} matches`)
  if (result.opinions_retrieved != null)     parts.push(`${result.opinions_retrieved} opinions`)
  if (result.recommendations_generated != null) parts.push(`${result.recommendations_generated} generated`)
  if (result.report_length != null)          parts.push('Ready')
  if (result.documents_written != null)      parts.push('Saved')
  return parts.length > 0 ? parts.join(' · ') : null
}

const TOOL_COLORS = {
  'MongoDB Atlas':         { bg: 'rgba(22,163,74,0.07)',   color: '#16A34A', border: 'rgba(22,163,74,0.18)'  },
  'MongoDB Vector Search': { bg: 'rgba(22,163,74,0.07)',   color: '#16A34A', border: 'rgba(22,163,74,0.18)'  },
  'Gemini Pro':            { bg: 'rgba(67,56,202,0.07)',   color: '#4338CA', border: 'rgba(67,56,202,0.18)'  },
  'CourtListener API':     { bg: 'rgba(37,99,235,0.07)',   color: '#2563EB', border: 'rgba(37,99,235,0.18)'  },
  'Reasoning Engine':      { bg: 'rgba(0,0,0,0.04)',       color: '#57534E', border: 'rgba(0,0,0,0.10)'      },
}

function ToolBadge({ tool }) {
  const s = TOOL_COLORS[tool] || TOOL_COLORS['Reasoning Engine']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
      padding: '2px 7px',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: '4px', whiteSpace: 'nowrap',
    }}>
      {tool}
    </span>
  )
}

// ── DOCKET LOADING STEPS (displayed while agent runs) ───────────────────────
const DOCKET_STEPS = [
  'Connecting to MongoDB Atlas…',
  'Retrieving active cases…',
  'Analyzing deadline urgency…',
  'Detecting documentation gaps…',
  'Running vector similarity search…',
  'Querying CourtListener API…',
  'Generating AI recommendations…',
  'Compiling executive docket report…',
  'Persisting execution trace…',
]

// ── Run detail view ───────────────────────────────────────────────────────────
function RunDetail({ run }) {
  if (!run) return null
  const { result } = run

  const PRIORITY_STYLE = {
    critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' },
    high:     { color: '#C2710C', bg: 'rgba(194,113,12,0.08)', border: 'rgba(194,113,12,0.18)' },
    medium:   { color: '#57534E', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.10)' },
  }

  return (
    <div style={{ padding: '2rem', overflowY: 'auto', height: '100%' }}>

      {/* Run header */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '12px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '4px' }}>
              RUN #{run.run_id}
            </p>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.025em' }}>
              {run.goal || "Prepare Tomorrow's Docket"}
            </h2>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500,
              color: run.status === 'complete' ? '#16A34A' : run.status === 'error' ? '#DC2626' : '#C2710C',
              padding: '3px 10px',
              background: run.status === 'complete' ? 'rgba(22,163,74,0.08)' : run.status === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(194,113,12,0.08)',
              border: `1px solid ${run.status === 'complete' ? 'rgba(22,163,74,0.18)' : run.status === 'error' ? 'rgba(220,38,38,0.18)' : 'rgba(194,113,12,0.18)'}`,
              borderRadius: '4px', marginBottom: '6px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
              {run.status === 'complete' ? 'Complete' : run.status === 'error' ? 'Error' : 'Running'}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
              {fmtDate(run.started_at)} · {fmtDuration(run.duration_ms)}
            </div>
          </div>
        </div>

        {/* Plan */}
        {run.plan && run.plan.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '6px' }}>
              Execution Plan
            </p>
            {run.plan.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: 600, minWidth: '20px', marginTop: '1px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution timeline */}
      {run.steps && run.steps.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '12px' }}>
            Execution Timeline
          </p>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr 160px 90px 120px',
              padding: '0 16px',
              height: '32px',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-raised)',
            }}>
              {['Elapsed', 'Step', 'Tool', 'Duration', 'Result'].map((h) => (
                <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, color: 'var(--text-3)' }}>{h}</span>
              ))}
            </div>
            {/* Rows */}
            {run.steps.map((step, i) => {
              const summary = stepResultSummary(step.result)
              return (
                <div key={step.id || i} style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 160px 90px 120px',
                  padding: '0 16px',
                  height: '44px',
                  alignItems: 'center',
                  borderBottom: i < run.steps.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'var(--bg-surface)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                    {fmtT(step.started_ms)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '9px', color: '#16A34A' }}>●</span>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text)',
                      fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                  </div>
                  <div><ToolBadge tool={step.tool} /></div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                    {fmtD(step.duration_ms)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {summary || '✓'}
                  </span>
                </div>
              )
            })}
            {/* Footer totals */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px',
              padding: '8px 16px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-raised)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                {run.steps.length} steps
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                Total: {fmtDuration(run.duration_ms)}
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600,
                color: '#16A34A', padding: '2px 8px',
                background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.18)',
                borderRadius: '3px',
              }}>Complete</span>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {result && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '12px' }}>
            Results Summary
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            background: 'var(--border)', gap: '1px', overflow: 'hidden',
          }}>
            {[
              { label: 'Cases Reviewed',     value: result.cases_reviewed     },
              { label: 'Critical (≤3 days)', value: result.critical_cases,    accent: result.critical_cases > 0 ? '#DC2626' : undefined },
              { label: 'Urgent (≤7 days)',   value: result.urgent_cases,      accent: result.urgent_cases > 0 ? '#C2710C' : undefined },
              { label: 'Missing Docs',       value: result.missing_documents, accent: result.missing_documents > 0 ? '#C2710C' : undefined },
              { label: 'Recommendations',    value: result.recommendations_count },
              { label: 'Legal Precedents',   value: result.court_opinions_count, accent: '#4338CA' },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{ background: 'var(--bg-surface)', padding: '1rem 1.25rem' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700, color: accent || 'var(--text)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                  {value ?? '—'}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive report */}
      {result?.executive_report && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '12px' }}>
            Executive Docket Report
          </p>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.5rem',
            borderLeft: '3px solid var(--accent)',
          }}>
            {result.executive_report.split(/\n+/).filter(Boolean).map((para, i) => (
              <p key={i} style={{
                fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-2)',
                lineHeight: 1.75, marginBottom: i < 2 ? '1rem' : 0,
              }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {result?.action_items && result.action_items.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '12px' }}>
            Recommended Actions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.action_items.map((item, i) => {
              const ps = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium
              return (
                <div key={i} style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                  display: 'flex', gap: '12px',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
                    color: 'var(--text-3)', minWidth: '20px',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {item.client_name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                        {item.case_type}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600,
                        padding: '1px 7px',
                        background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`,
                        borderRadius: '3px',
                      }}>
                        {item.priority}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
                      {item.action}
                    </p>
                    {item.rationale && (
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                        {item.rationale}
                      </p>
                    )}
                    {item.deadline_warning && (
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 500 }}>
                        ⚑ {item.deadline_warning}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legal precedents */}
      {result?.court_opinions && result.court_opinions.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>
              Legal Precedents
            </p>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-3)' }}>
              via CourtListener · Free Law Project
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {result.court_opinions.map((op, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
                    {op.case_name}
                  </span>
                  <a
                    href={op.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    View →
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: op.snippet ? '6px' : 0 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                    {op.court}
                  </span>
                  {op.date_filed && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                      {op.date_filed}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, color: '#2563EB', padding: '1px 6px', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: '3px' }}>
                    {op.case_type}
                  </span>
                </div>
                {op.snippet && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                    {op.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Run list sidebar ──────────────────────────────────────────────────────────
function RunListItem({ run, selected, onClick }) {
  const statusColor = run.status === 'complete' ? '#16A34A' : run.status === 'error' ? '#DC2626' : '#C2710C'
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '12px 14px', textAlign: 'left',
        background: selected ? 'rgba(67,56,202,0.06)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background 120ms',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-raised)' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
          #{run.run_id}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>
        Tomorrow&apos;s Docket
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
        {fmtDate(run.started_at)}
      </div>
      {run.summary?.cases_reviewed != null && (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
          {run.summary.cases_reviewed} cases · {run.summary.recommendations ?? 0} actions
        </div>
      )}
    </button>
  )
}

// ── Main inner component ──────────────────────────────────────────────────────
function AgentPageInner() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const initRunId    = searchParams.get('run')

  const [runs,          setRuns]         = useState([])
  const [selectedRunId, setSelectedRunId] = useState(initRunId || null)
  const [selectedRun,   setSelectedRun]  = useState(null)
  const [loadingRuns,   setLoadingRuns]  = useState(true)
  const [loadingRun,    setLoadingRun]   = useState(false)
  const [isRunning,     setIsRunning]    = useState(false)
  const [stepIdx,       setStepIdx]      = useState(0)
  const stepIntervalRef = useRef(null)

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  // Fetch runs list
  const fetchRuns = useCallback(async () => {
    if (!user) return
    try {
      const auth  = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      const res   = await fetch('/api/agent/runs', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      setRuns(data.runs || [])
      // Auto-select first run if none selected and no URL param
      if (!selectedRunId && data.runs?.length > 0) {
        setSelectedRunId(data.runs[0].run_id)
      }
    } catch { /* ignore */ }
    finally { setLoadingRuns(false) }
  }, [user, selectedRunId])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  // Fetch full run detail when selection changes
  useEffect(() => {
    if (!selectedRunId || !user) return
    setLoadingRun(true)
    setSelectedRun(null)
    const load = async () => {
      try {
        const auth  = getFirebaseAuth()
        const token = await auth?.currentUser?.getIdToken()
        const res   = await fetch(`/api/agent/runs/${selectedRunId}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setSelectedRun(data.run)
      } catch { /* ignore */ }
      finally { setLoadingRun(false) }
    }
    load()
  }, [selectedRunId, user])

  // Animate step labels during run
  useEffect(() => {
    if (isRunning) {
      stepIntervalRef.current = setInterval(() => {
        setStepIdx((i) => (i + 1) % DOCKET_STEPS.length)
      }, 2800)
    } else {
      clearInterval(stepIntervalRef.current)
      setStepIdx(0)
    }
    return () => clearInterval(stepIntervalRef.current)
  }, [isRunning])

  // Prepare tomorrow's docket
  async function prepareDocket() {
    if (isRunning) return
    setIsRunning(true)
    try {
      const auth  = getFirebaseAuth()
      const token = await auth?.currentUser?.getIdToken()
      const res = await fetch('/api/agent/docket', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Docket preparation failed')
      const data = await res.json()
      // Reload runs list and select the new run
      await fetchRuns()
      setSelectedRunId(data.run_id)
    } catch { /* ignore errors gracefully */ }
    finally { setIsRunning(false) }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Loading overlay during docket preparation */}
      {isRunning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(247,246,243,0.95)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '420px', padding: '2rem' }}>
            <div style={{
              width: '48px', height: '48px',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.9s linear infinite',
              margin: '0 auto 1.5rem',
            }} />
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.025em', marginBottom: '8px' }}>
              Preparing Tomorrow&apos;s Docket
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)', marginBottom: '2rem' }}>
              The agent is executing your operational workflow
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', minWidth: '300px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', textAlign: 'left' }}>
                {DOCKET_STEPS[stepIdx]}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '1rem' }}>
              {DOCKET_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === stepIdx ? '16px' : '4px', height: '3px',
                  borderRadius: '2px',
                  background: i === stepIdx ? 'var(--accent)' : 'var(--border-mid)',
                  transition: 'all 300ms ease',
                }} />
              ))}
            </div>
          </div>
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
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.015em' }}>
          Agent Activity
        </h1>
        <button
          onClick={prepareDocket}
          disabled={isRunning}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
            background: 'var(--text)', color: '#F7F6F3',
            border: 'none', borderRadius: 'var(--radius-sm)',
            padding: '7px 16px', cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.6 : 1,
            transition: 'opacity 150ms',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={(e) => { if (!isRunning) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { if (!isRunning) e.currentTarget.style.opacity = '1' }}
        >
          {isRunning ? 'Agent running…' : 'Prepare Tomorrow\'s Docket'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Runs sidebar */}
        {(runs.length > 0 || loadingRuns) && (
          <div style={{
            width: '260px', flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            overflowY: 'auto',
          }}>
            <div style={{
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
            }}>
              Recent Runs
            </div>
            {loadingRuns ? (
              <div style={{ padding: '1rem' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton" style={{ height: '60px', marginBottom: '8px', borderRadius: '4px' }} />
                ))}
              </div>
            ) : (
              runs.map((run) => (
                <RunListItem
                  key={run.run_id}
                  run={run}
                  selected={run.run_id === selectedRunId}
                  onClick={() => setSelectedRunId(run.run_id)}
                />
              ))
            )}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {loadingRun ? (
            <div style={{ padding: '2rem' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: i === 0 ? '40px' : '20px', marginBottom: '12px', borderRadius: '4px', width: i === 0 ? '60%' : `${90 - i * 10}%` }} />
              ))}
            </div>
          ) : selectedRun ? (
            <RunDetail run={selectedRun} />
          ) : (
            /* Empty state */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '60vh', padding: '3rem', textAlign: 'center',
            }}>
              <div style={{
                width: '56px', height: '56px',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', marginBottom: '1.5rem',
              }}>
                ⚙
              </div>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.025em', marginBottom: '8px' }}>
                No agent runs yet
              </h2>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-3)', lineHeight: 1.65, maxWidth: '400px', marginBottom: '2rem' }}>
                Click below to trigger the autonomous docket preparation workflow. The agent will analyze all active cases, retrieve legal precedents, generate recommendations, and produce an executive report.
              </p>
              <button
                onClick={prepareDocket}
                disabled={isRunning}
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
                  background: 'var(--text)', color: '#F7F6F3',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  padding: '12px 28px', cursor: isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunning ? 0.6 : 1, letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => { if (!isRunning) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={(e) => { if (!isRunning) e.currentTarget.style.opacity = '1' }}
              >
                Prepare Tomorrow&apos;s Docket →
              </button>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['Gemini Pro', 'MongoDB Atlas', 'Vector Search', 'CourtListener API'].map((tool) => {
                  const s = TOOL_COLORS[tool] || TOOL_COLORS['Reasoning Engine']
                  return (
                    <span key={tool} style={{
                      fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500,
                      padding: '3px 10px', background: s.bg, color: s.color,
                      border: `1px solid ${s.border}`, borderRadius: '4px',
                    }}>
                      {tool}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)' }}>Loading…</span>
    </div>
  )
}

export default function AgentPage() {
  return (
    <Suspense fallback={<AgentFallback />}>
      <AgentPageInner />
    </Suspense>
  )
}
