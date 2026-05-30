'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { getFirebaseAuth } from '../../../lib/firebase.js'

// ── Formatting helpers ────────────────────────────────────────────────────────
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

// Enhancement 1: wall-clock timestamp helper
function fmtAbsTime(baseDate, offsetMs) {
  if (!baseDate || offsetMs == null) return '—'
  const t = new Date(new Date(baseDate).getTime() + offsetMs)
  return t.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
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

const MONGO_BADGE = { bg: 'rgba(22,163,74,0.07)', color: '#16A34A', border: 'rgba(22,163,74,0.18)' }

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
  { label: 'Connecting to MongoDB Atlas…',        sub: 'Establishing secure database connection' },
  { label: 'Retrieving all active cases…',         sub: 'Loading full caseload from Atlas' },
  { label: 'Identifying critical deadlines…',      sub: 'Flagging cases within 72-hour window' },
  { label: 'Detecting documentation gaps…',        sub: 'Finding incomplete files before hearings' },
  { label: 'Running vector similarity search…',    sub: 'Matching against historical outcomes' },
  { label: 'Querying CourtListener API…',          sub: 'Fetching relevant legal precedents' },
  { label: 'Gemini Pro generating analysis…',      sub: 'Building attorney action recommendations' },
  { label: 'Compiling executive docket report…',   sub: 'Drafting tomorrow\'s operational brief' },
  { label: 'Saving audit trail to MongoDB…',       sub: 'Persisting complete execution trace' },
]

// ── Run detail view ───────────────────────────────────────────────────────────
function RunDetail({ run }) {
  // Enhancement 2: expandable evidence rows — must be declared before any early return
  const [expandedStep, setExpandedStep] = useState(null)

  if (!run) return null
  const { result } = run

  const PRIORITY_STYLE = {
    critical: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' },
    high:     { color: '#C2710C', bg: 'rgba(194,113,12,0.08)', border: 'rgba(194,113,12,0.18)' },
    medium:   { color: '#57534E', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.10)' },
  }

  // Enhancement 4: operational impact computations
  const manualHours = result && result.cases_reviewed > 0
    ? Math.max(1, Math.round(result.cases_reviewed * 2 / 60 * 10) / 10)
    : null

  // Real vector search values — from actual Atlas $vectorSearch results
  const vectorSearchStep = run.steps
    ? run.steps.find((s) => s.tool === 'MongoDB Vector Search')
    : null
  const vectorCount = vectorSearchStep?.result?.similar_cases_found ?? 0
  const vectorVia   = vectorSearchStep?.result?.via ?? null
  const vectorIndex = vectorSearchStep?.result?.index ?? 'description_embedding_index'

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

        {/* Enhancement 6: View Brief link */}
        {run.status === 'complete' && (
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => window.open(`/agent/brief?run=${run.run_id}`, '_blank')}
              style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              View Executive Brief ↗
            </button>
          </div>
        )}

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
            {/* Header — Enhancement 1: renamed "Elapsed" → "Time", updated column widths */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 160px 80px 110px',
              padding: '0 16px',
              height: '32px',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-raised)',
            }}>
              {['Time', 'Step', 'Tool', 'Duration', 'Result'].map((h) => (
                <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500, color: 'var(--text-3)' }}>{h}</span>
              ))}
            </div>
            {/* Rows — Enhancement 2: clickable, expandable */}
            {run.steps.map((step, i) => {
              const summary = stepResultSummary(step.result)
              const stepId = step.id || i
              const isExpanded = expandedStep === stepId
              return (
                <div key={stepId}>
                  <div
                    onClick={() => setExpandedStep(isExpanded ? null : stepId)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 160px 80px 110px',
                      padding: '0 16px',
                      height: '44px',
                      alignItems: 'center',
                      borderBottom: (!isExpanded && i < run.steps.length - 1) ? '1px solid var(--border)' : 'none',
                      background: isExpanded ? 'rgba(67,56,202,0.03)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-raised)' }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-surface)' }}
                  >
                    {/* Enhancement 1: wall-clock time in first column */}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                      {fmtAbsTime(run.started_at, step.started_ms)}
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
                    {/* Enhancement 2: result + chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {summary || '✓'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: 'var(--text-3)', flexShrink: 0 }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* Enhancement 2: expanded evidence sub-row */}
                  {isExpanded && step.result && (
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--bg-raised)',
                      borderBottom: i < run.steps.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600,
                        color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
                        marginBottom: '8px',
                      }}>
                        Evidence
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {Object.entries(step.result).map(([key, val]) => {
                          if (val == null) return null
                          let display
                          if (typeof val === 'boolean') {
                            display = val ? 'Yes' : 'No'
                          } else if (key.endsWith('_ms') || key === 'duration_ms') {
                            display = `${val}ms`
                          } else if (key === 'gap_rate') {
                            display = `${val}%`
                          } else {
                            display = String(val)
                          }
                          return (
                            <span
                              key={key}
                              style={{
                                fontFamily: 'var(--font-mono)', fontSize: '10px',
                                color: 'var(--text-3)',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '3px',
                                padding: '2px 7px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {key}: {display}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
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

      {/* Enhancement 4: Operational impact callout */}
      {result && (
        <div style={{
          background: 'rgba(67,56,202,0.04)',
          border: '1px solid rgba(67,56,202,0.12)',
          borderRadius: 'var(--radius)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '2rem',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.03em' }}>
              {fmtDuration(run.duration_ms)}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
              Agent execution time
            </div>
          </div>
          {manualHours && (
            <>
              <div style={{ width: '1px', height: '40px', background: 'rgba(67,56,202,0.15)', flexShrink: 0 }} />
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                →
              </div>
              <div style={{ width: '1px', height: '40px', background: 'rgba(67,56,202,0.15)', flexShrink: 0 }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '-0.03em' }}>
                  ~{manualHours}h
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                  Estimated manual review time
                </div>
              </div>
            </>
          )}
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

      {/* Real Atlas $vectorSearch results — one card per case searched */}
      {result?.vector_search_results && result.vector_search_results.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>
              Historical Case Matches
            </p>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
              color: '#16A34A', padding: '1px 7px',
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.18)',
              borderRadius: '3px',
            }}>
              Atlas $vectorSearch · description_embedding_index
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {result.vector_search_results.map((match, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflow: 'hidden',
              }}>
                {/* Match header */}
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                      {match.client_name || 'Unknown'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                      {match.case_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {match.top_similarity != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                        top: {(match.top_similarity * 100).toFixed(1)}%
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>
                      {match.matched_cases} match{match.matched_cases !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
                {/* Individual matches */}
                {(match.results || []).slice(0, 2).map((r, j) => {
                  const outcomeColor = r.outcome === 'won' ? '#16A34A' : r.outcome === 'settled' ? '#C2710C' : '#57534E'
                  return (
                    <div key={j} style={{
                      padding: '8px 14px',
                      borderBottom: j === 0 && match.results?.length > 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                        color: outcomeColor, flexShrink: 0, lineHeight: '18px', minWidth: '50px',
                      }}>
                        {r.outcome?.toUpperCase() ?? '—'}
                      </span>
                      {r.similarity_score != null && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', flexShrink: 0, lineHeight: '18px' }}>
                          {(r.similarity_score * 100).toFixed(1)}%
                        </span>
                      )}
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)',
                        lineHeight: 1.5, flex: 1,
                      }}>
                        {r.outcome_notes || r.description?.slice(0, 120)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhancement 3: MongoDB Visibility section */}
      {result && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '12px' }}>
            MongoDB Operations
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px',
          }}>
            {[
              {
                title: 'Agent Memory',
                value: result.cases_reviewed ?? '—',
                label: 'Cases in Atlas',
                sub: 'Retrieved via MongoDB Atlas',
              },
              {
                title: 'Vector Retrieval',
                value: vectorCount,
                label: 'Historical matches ($vectorSearch)',
                sub: vectorVia ? `index: ${vectorIndex} · via: ${vectorVia}` : `index: ${vectorIndex}`,
              },
              {
                title: 'Precedents Retrieved',
                value: result.court_opinions_count ?? '—',
                label: 'Court opinions',
                sub: 'CourtListener · Free Law Project',
              },
              {
                title: 'Audit Log',
                value: '✓',
                label: 'Execution stored',
                sub: `Run ${run.run_id}`,
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-surface)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
                    padding: '2px 7px',
                    background: MONGO_BADGE.bg, color: MONGO_BADGE.color,
                    border: `1px solid ${MONGO_BADGE.border}`,
                    borderRadius: '4px', whiteSpace: 'nowrap',
                  }}>
                    MongoDB Atlas
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '24px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
                  {card.value}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '2px' }}>
                  {card.label}
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-3)' }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Log — every branching decision made during the run */}
      {run.decisions && run.decisions.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
            color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            DECISION LOG
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {run.decisions.map((d, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)',
                    fontWeight: 700, flexShrink: 0, lineHeight: '18px',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                    {d.decision}
                  </span>
                </div>
                <div style={{ paddingLeft: '26px' }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.55, marginBottom: '6px' }}>
                    {d.reason}
                  </p>
                  {d.evidence && Object.keys(d.evidence).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                      {Object.entries(d.evidence).filter(([, v]) => v != null).map(([k, v]) => (
                        <span key={k} style={{
                          fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)',
                          background: 'var(--bg-raised)', border: '1px solid var(--border)',
                          borderRadius: '3px', padding: '1px 6px',
                        }}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#16A34A', fontWeight: 500 }}>
                    → {d.outcome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Reasoning Summary — Priority 1 */}
      {result?.reasoning_summary && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
            color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            AGENT REASONING
          </p>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>

            {/* Prioritization rationale */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
            }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
                color: 'var(--text)', lineHeight: 1.65, margin: 0,
              }}>
                {result.reasoning_summary.prioritization_rationale}
              </p>
            </div>

            {/* Key patterns */}
            {result.reasoning_summary.key_patterns?.length > 0 && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600,
                  color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: '10px',
                }}>
                  KEY PATTERNS
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {result.reasoning_summary.key_patterns.map((pattern, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11px',
                        color: 'var(--accent)', fontWeight: 700,
                        flexShrink: 0, lineHeight: '18px',
                      }}>
                        →
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: '12px',
                        color: 'var(--text-2)', lineHeight: 1.55,
                      }}>
                        {pattern}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical retrieval findings */}
            {result.reasoning_summary.historical_findings && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600,
                  color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: '8px',
                }}>
                  HISTORICAL RETRIEVAL
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)', fontSize: '12px',
                  color: 'var(--text-2)', lineHeight: 1.6, margin: 0,
                }}>
                  {result.reasoning_summary.historical_findings}
                </p>
              </div>
            )}

            {/* Confidence assessment */}
            {result.reasoning_summary.confidence_assessment && (
              <div style={{ padding: '12px 20px', background: 'var(--bg-raised)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    color: '#C2710C', fontWeight: 700, flexShrink: 0, lineHeight: '18px',
                  }}>
                    !
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: '11px',
                    color: 'var(--text-3)', lineHeight: 1.6,
                  }}>
                    {result.reasoning_summary.confidence_assessment}
                  </span>
                </div>
              </div>
            )}
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

      {/* Human Oversight panel */}
      {result?.action_items && result.action_items.filter((i) => i.priority === 'critical').length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>
              Requires Human Review
            </p>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
              color: '#C2710C', padding: '2px 8px',
              background: 'rgba(194,113,12,0.07)', border: '1px solid rgba(194,113,12,0.18)',
              borderRadius: '3px',
            }}>
              {result.action_items.filter((i) => i.priority === 'critical').length} pending authorization
            </span>
          </div>
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid rgba(194,113,12,0.18)',
            borderRadius: 'var(--radius)',
            marginBottom: '10px',
          }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>
              The agent has flagged these matters as requiring attorney authorization before any action is taken.
              No high-risk legal filing is executed autonomously.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {result.action_items.filter((i) => i.priority === 'critical').map((item, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)',
                border: '1px solid rgba(194,113,12,0.15)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                display: 'flex', gap: '12px', alignItems: 'flex-start',
              }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--border-strong)', lineHeight: '20px', flexShrink: 0 }}>□</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                      {item.client_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                      {item.case_type}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 500,
                      color: '#C2710C', padding: '1px 7px',
                      background: 'rgba(194,113,12,0.07)', border: '1px solid rgba(194,113,12,0.18)',
                      borderRadius: '3px',
                    }}>
                      Awaiting authorization
                    </span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {item.action}
                  </p>
                  {item.deadline_warning && (
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#DC2626', marginTop: '3px', fontWeight: 500 }}>
                      ⚑ {item.deadline_warning}
                    </p>
                  )}
                </div>
              </div>
            ))}
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

      {/* Verification Complete */}
      {run.status === 'complete' && result && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
            color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: '12px',
          }}>
            AGENT VERIFICATION
          </p>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            {[
              `${result.cases_reviewed ?? 0} cases analyzed and ranked by urgency, vulnerability, and deadline`,
              `${result.recommendations_count ?? 0} attorney recommendations generated with supporting evidence`,
              `Executive brief compiled with full operational action plan`,
              `Execution trace persisted to MongoDB Atlas (Run #${run.run_id})`,
              `${result.action_items?.filter((i) => i.priority === 'critical').length ?? 0} high-risk decisions flagged for human review before action`,
            ].map((text, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '11px 16px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: '#16A34A', lineHeight: '20px', flexShrink: 0 }}>✓</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>{text}</span>
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
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.025em', marginBottom: '6px' }}>
              Preparing Tomorrow&apos;s Docket
            </h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>
              {DOCKET_STEPS[stepIdx]?.label}
            </p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
              {DOCKET_STEPS[stepIdx]?.sub}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '10px' }}>
              {DOCKET_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === stepIdx ? '20px' : '5px', height: '4px',
                  borderRadius: '3px',
                  background: i < stepIdx ? 'rgba(67,56,202,0.4)' : i === stepIdx ? 'var(--accent)' : 'var(--border-mid)',
                  transition: 'all 350ms ease',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', marginBottom: '1rem' }}>
              Step {stepIdx + 1} of {DOCKET_STEPS.length}
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
        {/* Enhancement 5: header button row with Export Brief */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedRun && selectedRun.status === 'complete' && (
            <button
              onClick={() => window.open(`/agent/brief?run=${selectedRun.run_id}`, '_blank')}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-sm)',
                padding: '6px 14px', cursor: 'pointer', transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
            >
              Export Brief ↗
            </button>
          )}
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
            {isRunning ? 'Agent running…' : "Prepare Tomorrow's Docket"}
          </button>
        </div>
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
