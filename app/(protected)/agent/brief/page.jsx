'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../../context/AuthContext.jsx'
import { getFirebaseAuth } from '../../../../lib/firebase.js'

// ── Priority sort order ───────────────────────────────────────────────────────
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2 }

function sortByPriority(items) {
  if (!items) return []
  return [...items].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    return pa - pb
  })
}

// ── Duration formatter ────────────────────────────────────────────────────────
function fmtDuration(ms) {
  if (ms == null) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// ── Fallback while Suspense resolves ─────────────────────────────────────────
function BriefFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)' }}>
        Preparing executive brief…
      </span>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, valueColor }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      padding: '16px',
    }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '28px',
        fontWeight: 700,
        color: valueColor || 'var(--text)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        marginBottom: '4px',
      }}>
        {value ?? '—'}
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: '2px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '11px',
        color: 'var(--text-3)',
      }}>
        {sub}
      </div>
    </div>
  )
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const styles = {
    critical: { bg: 'rgba(220,38,38,0.08)',  color: '#DC2626', border: 'rgba(220,38,38,0.18)' },
    high:     { bg: 'rgba(194,113,12,0.08)', color: '#C2710C', border: 'rgba(194,113,12,0.18)' },
    medium:   { bg: 'rgba(0,0,0,0.04)',      color: '#57534E', border: 'rgba(0,0,0,0.10)' },
  }
  const s = styles[priority] || styles.medium
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-sans)',
      fontSize: '10px',
      fontWeight: 600,
      padding: '2px 8px',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: '999px',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {priority}
    </span>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontFamily: 'var(--font-sans)',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      marginBottom: '12px',
    }}>
      {children}
    </p>
  )
}

// ── Main brief inner component ────────────────────────────────────────────────
function BriefInner() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const runId        = searchParams.get('run')

  const [run, setRun]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Redirect if no run param
  useEffect(() => {
    if (!runId) {
      router.replace('/agent')
    }
  }, [runId, router])

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [user, authLoading, router])

  // Fetch run data
  useEffect(() => {
    if (!runId || !user) return
    const load = async () => {
      try {
        const auth  = getFirebaseAuth()
        const token = await auth?.currentUser?.getIdToken()
        const res   = await fetch(`/api/agent/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setRun(data.run)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
  }, [runId, user])

  if (authLoading || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-3)' }}>
          Preparing executive brief…
        </span>
      </div>
    )
  }

  if (!run) return null

  const { result } = run

  // ── Date computations ───────────────────────────────────────────────────────
  const generated    = new Date(run.started_at)
  const tomorrowDate = new Date(run.started_at)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr  = tomorrowDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const generatedStr = generated.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  const sortedActions = sortByPriority(result?.action_items)
  const hasMissingDocs = result?.missing_documents > 0
  const hasOpinions    = result?.court_opinions?.length > 0
  const authorizationCount = sortedActions.filter((item) => item.authorization_required).length

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Print styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          aside { display: none !important; }
          .brief-no-print { display: none !important; }
          body { margin: 0; }
          .brief-section { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div
        className="brief-no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '44px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <a
          href="/agent"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--text-3)',
            textDecoration: 'none',
          }}
        >
          ← Back to Agent Activity
        </a>
        <button
          onClick={() => window.print()}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            background: 'var(--text)',
            color: '#F7F6F3',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 16px',
            cursor: 'pointer',
          }}
        >
          Print / Export PDF
        </button>
      </div>

      {/* ── Document root ────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: '860px',
        margin: '0 auto',
        padding: '2.5rem 3rem 4rem',
        paddingTop: 'calc(44px + 2.5rem)',
      }}>

        {/* ── Letterhead header ─────────────────────────────────────────────── */}
        <div className="brief-section" style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}>
            {/* Left: branding */}
            <div>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}>
                ⚖ JusticeQueue
              </span>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                marginTop: '2px',
              }}>
                Executive Docket Brief
              </div>
            </div>
            {/* Right: metadata */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-3)',
                lineHeight: 1.6,
              }}>
                Generated {generatedStr}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-3)',
              }}>
                Run #{run.run_id}
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '10px',
          }}>
            Tomorrow&apos;s Operational Docket
          </h1>

          {/* Subline */}
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--text-2)',
            marginBottom: '1.5rem',
          }}>
            Prepared for: {tomorrowStr} · Generated from Agent Run #{run.run_id} · Attorney review required before action
          </p>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />
        </div>

        {/* ── Operational summary strip ─────────────────────────────────────── */}
        <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--border)',
            gap: '1px',
            overflow: 'hidden',
          }}>
            <MetricCard
              label="Cases Reviewed"
              value={result?.cases_reviewed}
              sub="Active cases analyzed"
            />
            <MetricCard
              label="Critical Matters"
              value={result?.critical_cases}
              sub="≤ 3 days to deadline"
              valueColor={result?.critical_cases > 0 ? 'var(--urgent)' : undefined}
            />
            <MetricCard
              label="Recommendations"
              value={result?.recommendations_count}
              sub="Attorney actions prepared"
            />
            <MetricCard
              label="Agent Runtime"
              value={fmtDuration(run.duration_ms)}
              sub="Autonomous execution"
            />
          </div>
        </div>

        {authorizationCount > 0 && (
          <div className="brief-section" style={{
            marginBottom: '2.5rem',
            padding: '14px 16px',
            background: 'rgba(194,113,12,0.06)',
            border: '1px solid rgba(194,113,12,0.20)',
            borderLeft: '3px solid #C2710C',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 700,
              color: '#C2710C',
              marginBottom: '4px',
            }}>
              Attorney attention required
            </div>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--text-2)',
              lineHeight: 1.6,
            }}>
              {authorizationCount} action{authorizationCount !== 1 ? 's' : ''} in this brief require licensed attorney authorization before filing, client contact, scheduling changes, or other legal action.
            </p>
          </div>
        )}

        {/* ── Executive Summary ─────────────────────────────────────────────── */}
        {result?.executive_report && (
          <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>Executive Summary</SectionLabel>
            <div style={{
              borderLeft: '3px solid var(--accent)',
              paddingLeft: '20px',
            }}>
              {result.executive_report.split(/\n+/).filter(Boolean).map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: 'var(--text-2)',
                    lineHeight: 1.75,
                    marginBottom: i < result.executive_report.split(/\n+/).filter(Boolean).length - 1 ? '0.9rem' : 0,
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Required Actions ──────────────────────────────────────────────── */}
        {sortedActions.length > 0 && (
          <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>Required Actions</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedActions.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '16px',
                  }}
                >
                  {/* Top row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-3)',
                      minWidth: '20px',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}>
                      {item.client_name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                      color: 'var(--text-3)',
                    }}>
                      {item.case_type}
                    </span>
                    <PriorityBadge priority={item.priority} />
                  </div>

                  {/* Action */}
                  {item.action && (
                    <p style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      marginBottom: '4px',
                    }}>
                      {item.action}
                    </p>
                  )}

                  {/* Rationale */}
                  {item.rationale && (
                    <p style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                      color: 'var(--text-3)',
                      lineHeight: 1.5,
                    }}>
                      {item.rationale}
                    </p>
                  )}

                  {/* Deadline warning */}
                  {item.deadline_warning && (
                    <p style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      color: 'var(--urgent)',
                      fontWeight: 500,
                      marginTop: '6px',
                    }}>
                      ⚑ {item.deadline_warning}
                    </p>
                  )}

                  {/* Authorization requirement — model-generated compliance rationale */}
                  {item.authorization_required && item.authorization_reason && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: 'rgba(194,113,12,0.06)',
                      border: '1px solid rgba(194,113,12,0.20)',
                      borderRadius: '4px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{
                          fontFamily: 'var(--font-sans)', fontSize: '10px',
                          fontWeight: 700, color: '#C2710C', letterSpacing: '0.04em',
                        }}>
                          ATTORNEY AUTHORIZATION REQUIRED
                        </span>
                        {item.risk_assessment && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                            color: item.risk_assessment === 'high' ? '#DC2626' : '#C2710C',
                          }}>
                            [{item.risk_assessment.toUpperCase()} RISK]
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontFamily: 'var(--font-sans)', fontSize: '11px',
                        color: '#7a5c1e', lineHeight: 1.5,
                      }}>
                        {item.authorization_reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Missing Documents ─────────────────────────────────────────────── */}
        {hasMissingDocs && (
          <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>Documentation Gaps</SectionLabel>
            <div style={{
              background: 'rgba(194,113,12,0.06)',
              border: '1px solid rgba(194,113,12,0.18)',
              borderRadius: 'var(--radius)',
              padding: '14px 16px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--text-2)',
              lineHeight: 1.6,
            }}>
              ⚠ {result.missing_documents} cases have incomplete documentation. These must be resolved before proceedings can advance.
            </div>
          </div>
        )}

        {/* ── Historical Case Matches (Atlas $vectorSearch) ─────────────────── */}
        {result?.vector_search_results?.length > 0 && (
          <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
              <SectionLabel>Historical Case Matches</SectionLabel>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--text-3)' }}>
                Atlas $vectorSearch · index: description_embedding_index
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.vector_search_results.map((match, i) => (
                <div key={i} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginRight: '8px' }}>
                        {match.client_name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-3)' }}>
                        {match.case_type}
                      </span>
                    </div>
                    {match.top_similarity != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#16A34A' }}>
                        {(match.top_similarity * 100).toFixed(1)}% similarity
                      </span>
                    )}
                  </div>
                  {(match.results || []).slice(0, 2).map((r, j) => (
                    <div key={j} style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      paddingTop: '6px', borderTop: j === 0 ? '1px solid var(--border)' : 'none',
                      marginTop: j === 0 ? '6px' : 0,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                        color: r.outcome === 'won' ? '#16A34A' : r.outcome === 'settled' ? '#C2710C' : '#57534E',
                        flexShrink: 0, lineHeight: '18px',
                      }}>
                        {r.outcome?.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5, flex: 1 }}>
                        {r.outcome_notes}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Legal Precedents ──────────────────────────────────────────────── */}
        {hasOpinions && (
          <div className="brief-section" style={{ marginBottom: '2.5rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <SectionLabel>Retrieved Legal Precedents</SectionLabel>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                color: 'var(--text-3)',
              }}>
                Source: CourtListener · Free Law Project
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.court_opinions.map((op, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 16px',
                  }}
                >
                  {/* Case name + link */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '6px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      lineHeight: 1.35,
                    }}>
                      {op.case_name}
                    </span>
                    {op.url && (
                      <a
                        href={op.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          textDecoration: 'none',
                        }}
                      >
                        View on CourtListener →
                      </a>
                    )}
                  </div>

                  {/* Meta row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: op.snippet ? '8px' : 0,
                    flexWrap: 'wrap',
                  }}>
                    {op.court && (
                      <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        color: 'var(--text-3)',
                      }}>
                        {op.court}
                      </span>
                    )}
                    {op.date_filed && (
                      <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        color: 'var(--text-3)',
                      }}>
                        {op.date_filed}
                      </span>
                    )}
                    {op.case_type && (
                      <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '10px',
                        fontWeight: 500,
                        color: '#2563EB',
                        padding: '1px 6px',
                        background: 'rgba(37,99,235,0.07)',
                        border: '1px solid rgba(37,99,235,0.18)',
                        borderRadius: '3px',
                      }}>
                        {op.case_type}
                      </span>
                    )}
                  </div>

                  {/* Snippet */}
                  {op.snippet && (
                    <p style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                      color: 'var(--text-3)',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                    }}>
                      {op.snippet}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--text-3)',
            marginBottom: '6px',
          }}>
            Generated by JusticeQueue Autonomous Agent · Run #{run.run_id} · {generatedStr}
          </p>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--text-3)',
            lineHeight: 1.6,
          }}>
            This report was prepared by an AI agent. All recommendations should be reviewed by a licensed attorney before action is taken.
          </p>
        </div>

      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function BriefPage() {
  return (
    <Suspense fallback={<BriefFallback />}>
      <BriefInner />
    </Suspense>
  )
}
