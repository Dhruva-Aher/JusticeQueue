// POST /api/agent/docket  — "Prepare Tomorrow's Docket"
// Autonomous agent workflow: retrieve → analyze → detect gaps → Atlas $vectorSearch →
// (branch) CourtListener precedents → Gemini recommendations → executive report → persist
export const dynamic    = 'force-dynamic'
export const maxDuration = 120  // seconds — Vercel Pro; raised from 60 to give real headroom
                                 // for concurrent Vertex AI embedding calls + multiple Gemini calls + CourtListener

import { verifyToken }                    from '../../../../lib/verifyToken.js'
import { apiError }                       from '../../../../lib/apiError.js'
import { connectDB }                      from '../../../../lib/mongodb.js'
import Case                               from '../../../../lib/models/Case.js'
import AgentRun                           from '../../../../lib/models/AgentRun.js'
import { callGeminiPro, callGeminiFlash } from '../../../../lib/gemini.js'
import { findSimilarCases }               from '../../../../lib/vectorSearch.js'
import { logToCloud }           from '../../../../lib/cloudLogging.js'
import { recordDocketMetrics }  from '../../../../lib/cloudMonitoring.js'

// ── CourtListener public API ────────────────────────────────────────────────
// Fallback queries used when Gemini Flash query generation fails
const FALLBACK_QUERIES = {
  eviction:          'tenant eviction unlawful detainer emergency housing relief',
  immigration:       'immigration deportation removal stay emergency proceedings',
  custody:           'child custody emergency protective order best interest',
  wage_theft:        'wage theft unpaid wages labor violation restitution',
  employment:        'wrongful termination employment discrimination reinstatement',
  domestic_violence: 'domestic violence restraining protective order emergency',
  other:             'legal aid emergency relief due process',
}

// overrideQuery: Gemini-generated query string if available; falls back to FALLBACK_QUERIES
async function searchCourtListener(caseType, pageSize = 3, overrideQuery = null) {
  const query = overrideQuery || FALLBACK_QUERIES[caseType] || FALLBACK_QUERIES.other
  try {
    const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(query)}&type=o&order_by=score+desc&page_size=${pageSize}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JusticeQueue/1.0 (legal-aid-triage)' },
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).slice(0, pageSize).map((op) => ({
      case_name:  op.caseName   || op.case_name || 'Unknown',
      court:      op.court      || op.court_id  || 'Unknown court',
      date_filed: op.dateFiled  || op.date_filed || null,
      snippet:    typeof op.snippet === 'string' ? op.snippet.replace(/<[^>]+>/g, '').slice(0, 200) : null,
      url:        op.absolute_url ? `https://www.courtlistener.com${op.absolute_url}` : 'https://www.courtlistener.com/opinion/',
      case_type:  caseType,
    }))
  } catch {
    return []
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeStep(id, label, tool, startedMs, durationMs, result) {
  return { id, label, tool, status: 'complete', started_ms: startedMs, duration_ms: durationMs, result }
}

function challengeConfidenceLevel(confidenceAssessment = '') {
  const value = String(confidenceAssessment).toLowerCase()
  if (value.startsWith('low')) return 'low'
  if (value.startsWith('medium')) return 'medium'
  if (value.startsWith('high')) return 'high'
  return 'unknown'
}

function findRecommendationIndexByClient(recommendations, clientName) {
  const target = String(clientName || '').trim().toLowerCase()
  if (!target) return -1
  return recommendations.findIndex((r) => {
    const candidate = String(r.client_name || '').trim().toLowerCase()
    return candidate === target || candidate.includes(target) || target.includes(candidate)
  })
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request) {
  let decoded
  try {
    decoded = await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  const runId    = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const runStart = Date.now()
  const elapsed  = () => Date.now() - runStart

  try {
    await connectDB()

    // Static plan — describes the intended workflow before case data is known.
    // After Step 3, an adapted_plan is generated that reflects actual execution.
    const STATIC_PLAN = [
      'Connect to MongoDB Atlas and retrieve all active cases',
      'Analyze deadline urgency — identify critical (≤3 days) and urgent (≤7 days) matters',
      'Detect cases with incomplete or missing documentation',
      'Gemini Flash selects execution strategy (emergency/standard/doc-focus/monitoring)',
      'Gemini Flash selects tool combination (Atlas, CourtListener, or both)',
      'Gemini Flash selects which cases receive Atlas $vectorSearch resources',
      'Run Atlas $vectorSearch against model-selected cases',
      'Gemini Flash evaluates retrieval quality — triggers second pass if insufficient',
      'Execute CourtListener precedent research (depth determined by tool selection)',
      'Generate AI-powered triage recommendations with Gemini Flash',
      'Gemini Flash self-critiques recommendations — challenge review',
      'Compile executive docket report with Gemini Pro',
      'Persist complete execution trace, all model decisions, and vector results to MongoDB',
    ]

    // Create run record so the UI can find it immediately
    const runDoc = new AgentRun({
      uid:        decoded.uid,
      run_id:     runId,
      goal:       "Prepare Tomorrow's Docket",
      plan:       STATIC_PLAN,
      status:     'running',
      started_at: new Date(),
      steps:      [],
      decisions:  [],
    })
    await runDoc.save()

    const steps     = []
    const decisions = []

    function logDecision(decision, reason, evidence, outcome) {
      decisions.push({ decision, reason, evidence, outcome, timestamp_ms: elapsed() })
    }

    // ── STEP 0: Dynamic planner — model generates execution plan ────────────
    // The model receives the goal and available tools, then generates a concrete
    // execution plan before any data is fetched. This plan is stored in MongoDB
    // and displayed in Agent Activity before the execution timeline.
    let s = elapsed()
    let agentPlan = null
    let planFallback = false

    const PLANNER_SYSTEM = 'You are an AI legal operations planner. Return JSON only. No markdown.'
    const PLANNER_PROMPT = `Goal: Prepare tomorrow's legal docket for a legal aid clinic.

Available steps (choose which to include and in what order):
- retrieve_cases: always required
- analyze_deadlines: always required
- detect_gaps: recommended
- model_strategy: always required (select execution strategy)
- select_tools: always required (choose which tools to activate)
- select_cases: recommended (prioritize which cases get retrieval)
- atlas_vector_search: use when historical precedent improves triage
- evaluate_evidence: use when retrieval quality matters
- courtlistener_research: use when legal precedents are needed
- generate_recommendations: always required
- challenge_review: recommended (self-critique)
- executive_report: always required
- persist_trace: always required

Generate a concrete execution plan. Be specific about WHY each step is included.

Return JSON:
{
  "goal": "Prepare tomorrow's docket",
  "steps": ["step_id1", "step_id2", ...],
  "reasoning": "1-2 sentences on why this plan was chosen",
  "key_decision": "the most important choice in this plan"
}`

    try {
      const planRaw = await callGeminiFlash(PLANNER_SYSTEM, PLANNER_PROMPT)
      const parsed  = JSON.parse(planRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        agentPlan = {
          goal:         parsed.goal || "Prepare Tomorrow's Docket",
          steps:        parsed.steps,
          reasoning:    parsed.reasoning || '',
          key_decision: parsed.key_decision || '',
          generated_at: new Date(),
          model:        process.env.GEMINI_MODEL_FLASH,
          fallback:     false,
        }
      }
    } catch {
      planFallback = true
    }

    if (!agentPlan) {
      agentPlan = {
        goal:         "Prepare Tomorrow's Docket",
        steps:        ['retrieve_cases','analyze_deadlines','detect_gaps','model_strategy','select_tools','select_cases','atlas_vector_search','evaluate_evidence','courtlistener_research','generate_recommendations','challenge_review','executive_report','persist_trace'],
        reasoning:    'Default plan applied (model planner unavailable)',
        key_decision: 'Execute full retrieval and recommendation pipeline',
        generated_at: new Date(),
        model:        'deterministic-fallback',
        fallback:     true,
      }
      planFallback = true
    }

    steps.push(makeStep('agent_plan',
      `Agent generated ${agentPlan.steps.length}-step execution plan: ${agentPlan.key_decision}`,
      'Gemini Flash',
      s, elapsed() - s,
      {
        plan_steps:   agentPlan.steps.length,
        key_decision: agentPlan.key_decision,
        reasoning:    agentPlan.reasoning,
        fallback:     planFallback,
      }
    ))

    logDecision(
      'Agent generated execution plan',
      agentPlan.reasoning,
      { steps: agentPlan.steps, key_decision: agentPlan.key_decision, model: agentPlan.model },
      `Executing ${agentPlan.steps.length}-step plan`
    )

    // Persist plan immediately so UI can show it while agent runs
    await AgentRun.findOneAndUpdate(
      { run_id: runId },
      { $set: { agent_plan: agentPlan } }
    ).catch(() => {})

    // ── STEP 1: Retrieve cases ──────────────────────────────────────────────
    let s = elapsed()
    const cases = await Case.find({ uid: decoded.uid }).limit(300).lean()
    steps.push(makeStep('retrieve_cases', 'Retrieve all active cases from MongoDB Atlas', 'MongoDB Atlas',
      s, elapsed() - s, { count: cases.length }))

    // Short-circuit if no cases — nothing to analyze
    if (cases.length === 0) {
      logDecision(
        'Terminate workflow — no active cases',
        'The case queue is empty. Load cases via the Operations Center and run again.',
        { cases_found: 0 },
        'Workflow terminated after case retrieval. No analysis performed.'
      )
      await AgentRun.findOneAndUpdate({ run_id: runId }, {
        $set: {
          status: 'complete', completed_at: new Date(),
          duration_ms: elapsed(), steps, decisions,
          result: {
            cases_reviewed: 0, critical_cases: 0, urgent_cases: 0,
            missing_documents: 0, recommendations_count: 0, court_opinions_count: 0,
            recommendations: [], court_opinions: [], executive_report: 'No cases found.',
            action_items: [], vector_search_results: [],
            reasoning_summary: {
              prioritization_rationale: 'No active cases found in the queue.',
              key_patterns: [],
              historical_findings: 'Vector search not executed — no cases to search against.',
              confidence_assessment: 'N/A',
            },
          },
        },
      })
      return Response.json({ run_id: runId, status: 'complete', duration_ms: elapsed(), summary: { cases_reviewed: 0 } })
    }

    // ── STEP 2: Analyze urgency ─────────────────────────────────────────────
    s = elapsed()
    const criticalCases  = cases.filter((c) => c.deadline_days != null && c.deadline_days <= 3)
    const urgentCases    = cases.filter((c) => c.deadline_days != null && c.deadline_days <= 7)
    const highScoreCases = cases.filter((c) => (c.priority_score ?? 0) >= 75)
    steps.push(makeStep('analyze_urgency', 'Analyze deadline urgency across all cases', 'Reasoning Engine',
      s, elapsed() - s, {
        critical:   criticalCases.length,
        urgent:     urgentCases.length,
        high_score: highScoreCases.length,
        total:      cases.length,
      }))

    // ── STEP 3: Detect missing documents ────────────────────────────────────
    s = elapsed()
    const withMissingDocs = cases.filter((c) => Array.isArray(c.missing_info) && c.missing_info.length > 0)
    const docGapRatePct   = Math.round((withMissingDocs.length / cases.length) * 100)
    steps.push(makeStep('detect_gaps', 'Detect cases with missing or incomplete documentation', 'Reasoning Engine',
      s, elapsed() - s, {
        cases_with_gaps: withMissingDocs.length,
        gap_rate:        docGapRatePct,
      }))

    // ── MODEL DECISION: Gemini evaluates docket state → selects execution strategy ──
    // This is the model-driven decision point. Gemini Flash evaluates the case profile
    // (counts, types, gap rate) and selects a strategy that determines:
    //   (a) whether CourtListener runs and at what depth
    //   (b) the escalation level communicated in the executive report
    // The decision is persisted to MongoDB and displayed in the Agent Activity UI.
    s = elapsed()
    let modelDecision = null
    let modelDecisionFallback = false

    const STRATEGY_SYSTEM = `You are a legal operations AI. Evaluate a case docket and select the optimal execution strategy. Return ONLY valid JSON — no markdown, no explanation outside the object.`

    const caseTypesSummary = (() => {
      const counts = {}
      urgentCases.forEach((c) => { if (c.case_type) counts[c.case_type] = (counts[c.case_type] || 0) + 1 })
      return Object.entries(counts).map(([t, n]) => `${t}(${n})`).join(', ') || 'none'
    })()

    const STRATEGY_PROMPT = `DOCKET STATE:
- Total active cases: ${cases.length}
- Critical cases (deadline ≤3 days): ${criticalCases.length}
- Urgent cases (deadline ≤7 days): ${urgentCases.length}
- Documentation gap rate: ${docGapRatePct}%
- High-priority cases (score ≥75): ${highScoreCases.length}
- Urgent case types: ${caseTypesSummary}

AVAILABLE STRATEGIES:
- "emergency": Critical deadline volume requires comprehensive precedent research and immediate escalation
- "standard": Normal docket — targeted precedent research for urgent matters
- "documentation-focus": High gap rate blocks case advancement — prioritize remediation over precedents
- "monitoring": No deadline urgency — lightweight recommendations, skip precedent research

Return this JSON object (fill every field):
{
  "strategy": "emergency" | "standard" | "documentation-focus" | "monitoring",
  "escalation_level": "immediate" | "urgent" | "routine",
  "precedent_research": true | false,
  "courtlistener_depth": "comprehensive" | "targeted" | "none",
  "alternatives_considered": [
    { "option": "<strategy_name>", "rejected_reason": "<brief reason>" }
  ],
  "reasoning": "<1-2 sentences explaining this selection>"
}`

    try {
      const raw = await callGeminiFlash(STRATEGY_SYSTEM, STRATEGY_PROMPT)
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed.strategy && typeof parsed.precedent_research === 'boolean') {
        modelDecision = {
          strategy:               parsed.strategy,
          escalation_level:       parsed.escalation_level || 'routine',
          precedent_research:     parsed.precedent_research,
          courtlistener_depth:    parsed.courtlistener_depth || 'none',
          reasoning:              parsed.reasoning || '',
          alternatives_considered: Array.isArray(parsed.alternatives_considered) ? parsed.alternatives_considered : [],
          model:                  process.env.GEMINI_MODEL_FLASH || 'gemini-flash',
          timestamp_ms:           elapsed(),
          fallback_used:          false,
        }
      }
    } catch {
      modelDecisionFallback = true
    }

    // Fallback: deterministic strategy selection if Gemini call failed
    if (!modelDecision) {
      const fallbackStrategy = cases.length === 0
        ? 'monitoring'
        : criticalCases.length >= 3 || (criticalCases.length / Math.max(cases.length, 1)) >= 0.1
          ? 'emergency'
          : docGapRatePct >= 50 && urgentCases.length === 0
            ? 'documentation-focus'
            : urgentCases.length === 0
              ? 'monitoring'
              : 'standard'

      modelDecision = {
        strategy:            fallbackStrategy,
        escalation_level:    fallbackStrategy === 'emergency' ? 'immediate' : fallbackStrategy === 'monitoring' ? 'routine' : 'urgent',
        precedent_research:  fallbackStrategy !== 'monitoring' && urgentCases.length > 0,
        courtlistener_depth: fallbackStrategy === 'emergency' ? 'comprehensive' : fallbackStrategy === 'standard' ? 'targeted' : 'none',
        reasoning:           `Fallback selection (Gemini unavailable): determined by case counts — ${urgentCases.length} urgent, ${criticalCases.length} critical, ${docGapRatePct}% gap rate.`,
        alternatives_considered: [],
        model:               'deterministic-fallback',
        timestamp_ms:        elapsed(),
        fallback_used:       true,
      }
      modelDecisionFallback = true
    }

    steps.push(makeStep(
      'model_decision',
      `Gemini evaluates docket profile → selects "${modelDecision.strategy}" strategy`,
      'Gemini Flash',
      s, elapsed() - s,
      {
        strategy:            modelDecision.strategy,
        escalation_level:    modelDecision.escalation_level,
        precedent_research:  modelDecision.precedent_research,
        courtlistener_depth: modelDecision.courtlistener_depth,
        fallback_used:       modelDecisionFallback,
        alternatives_count:  modelDecision.alternatives_considered.length,
      }
    ))

    logDecision(
      `Model selected "${modelDecision.strategy}" strategy — ${modelDecision.escalation_level} escalation`,
      modelDecision.reasoning,
      {
        strategy:            modelDecision.strategy,
        precedent_research:  modelDecision.precedent_research,
        courtlistener_depth: modelDecision.courtlistener_depth,
        model:               modelDecision.model,
        fallback_used:       modelDecisionFallback,
        alternatives_evaluated: modelDecision.alternatives_considered.length,
      },
      modelDecision.precedent_research
        ? `CourtListener will execute at "${modelDecision.courtlistener_depth}" depth`
        : 'CourtListener skipped — model determined no precedent research required'
    )

    // ── Generate adapted plan — reflects actual execution based on model decision ──
    const adaptedPlan = [
      `Retrieved ${cases.length} active cases from MongoDB Atlas`,
      `Identified ${criticalCases.length} critical (≤3d) and ${urgentCases.length} urgent (≤7d) matters`,
      `Detected ${withMissingDocs.length} documentation gaps (${docGapRatePct}% of caseload)${highDocGapRate ? ' → remediation branch activated' : ''}`,
      `Gemini Flash selected "${modelDecision.strategy}" strategy (escalation: ${modelDecision.escalation_level})${modelDecisionFallback ? ' [fallback]' : ''}`,
      `Run Atlas $vectorSearch for up to 5 priority cases (index: description_embedding_index)`,
      modelDecision.precedent_research
        ? `Query CourtListener at "${modelDecision.courtlistener_depth}" depth — model determined precedent research warranted`
        : `Skip CourtListener — model strategy "${modelDecision.strategy}" does not require precedent research`,
      `Generate ${priorityQueue?.length || 0} attorney recommendations with Gemini Flash`,
      `Compile executive docket report (escalation level: ${modelDecision.escalation_level})`,
      `Persist execution trace, model decision, adapted plan, and vector results to MongoDB Atlas`,
    ]

    // ── DECISION B: Documentation remediation branch ────────────────────────
    const highDocGapRate = docGapRatePct >= 40
    if (highDocGapRate) {
      logDecision(
        'Activate documentation remediation workflow',
        `${docGapRatePct}% of active cases have incomplete files — exceeds the 40% threshold. Remediation actions will be included in the docket report.`,
        { cases_with_gaps: withMissingDocs.length, total_cases: cases.length, gap_rate_pct: docGapRatePct, threshold_pct: 40 },
        'Documentation remediation checklist added to recommended actions'
      )
    }

    // ────────────────────────────────────────────────────────────────────────────
    // PRIORITY 1: MODEL-DIRECTED TOOL SELECTION
    // Flash explicitly selects which tools to run — replacing the implicit boolean
    // logic that previously hard-coded CourtListener execution. The model receives
    // case characteristics and chooses from four tool combinations, rejecting tools
    // that don't serve the current docket profile.
    // ────────────────────────────────────────────────────────────────────────────
    s = elapsed()
    let toolSelection = null
    let toolSelectionFallback = false

    const caseTypeSummary = (() => {
      const counts = {}
      cases.forEach((c) => { if (c.case_type) counts[c.case_type] = (counts[c.case_type] || 0) + 1 })
      return Object.entries(counts).map(([t, n]) => `${t}(${n})`).join(', ') || 'none'
    })()

    const TOOL_SELECTION_PROMPT = `SELECT TOOLS FOR THIS LEGAL AID DOCKET.

DOCKET PROFILE:
- Total cases: ${cases.length}
- Critical (≤3 days): ${criticalCases.length}
- Urgent (≤7 days): ${urgentCases.length}
- Case types: ${caseTypeSummary}
- Documentation gap rate: ${docGapRatePct}%
- Strategy: ${modelDecision.strategy}

AVAILABLE TOOLS:
- Atlas $vectorSearch: similarity matching against ${cases.length} historical case outcomes
- CourtListener API: live judicial opinions from public legal database
- Escalation: flag docket for senior attorney review before recommendations proceed

TOOL COMBINATIONS:
- "atlas_only": historical similarity sufficient; no live opinions needed (monitoring/routine dockets)
- "atlas_courtlistener": both tools needed for comprehensive coverage (standard urgent dockets)
- "courtlistener_only": novel fact patterns with no historical match; live precedent more valuable
- "atlas_courtlistener_escalate": high complexity or extreme urgency; senior attorney review required

Select the optimal tool combination. Reject tools explicitly.

Return JSON only:
{
  "tools": "atlas_only"|"atlas_courtlistener"|"courtlistener_only"|"atlas_courtlistener_escalate",
  "selected_tools": ["tool names selected"],
  "rejected_tools": ["tool names rejected with reason"],
  "reasoning": "1-2 sentences explaining what drove this selection",
  "confidence": 0.0
}`

    try {
      const tsRaw    = await callGeminiFlash('Legal operations tool selector. Return JSON only. No markdown.', TOOL_SELECTION_PROMPT)
      const tsParsed = JSON.parse(tsRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
      const validTools = ['atlas_only', 'atlas_courtlistener', 'courtlistener_only', 'atlas_courtlistener_escalate']
      if (validTools.includes(tsParsed.tools)) {
        toolSelection = {
          tools:          tsParsed.tools,
          selected_tools: Array.isArray(tsParsed.selected_tools) ? tsParsed.selected_tools : [],
          rejected_tools: Array.isArray(tsParsed.rejected_tools) ? tsParsed.rejected_tools : [],
          reasoning:      tsParsed.reasoning || '',
          confidence:     typeof tsParsed.confidence === 'number' ? tsParsed.confidence : null,
          fallback_used:  false,
        }
      }
    } catch {
      toolSelectionFallback = true
    }

    // Fallback: derive tool selection from existing model_decision
    if (!toolSelection) {
      const fallbackTools = modelDecision.precedent_research
        ? modelDecision.strategy === 'emergency' ? 'atlas_courtlistener_escalate' : 'atlas_courtlistener'
        : 'atlas_only'
      toolSelection = {
        tools:          fallbackTools,
        selected_tools: fallbackTools.includes('courtlistener') ? ['Atlas $vectorSearch', 'CourtListener API'] : ['Atlas $vectorSearch'],
        rejected_tools: fallbackTools === 'atlas_only' ? ['CourtListener API (no urgent cases)'] : [],
        reasoning:      'Fallback selection based on strategy and urgency threshold',
        confidence:     null,
        fallback_used:  true,
      }
      toolSelectionFallback = true
    }

    steps.push(makeStep('tool_selection',
      `Model selects tools: ${toolSelection.selected_tools.join(' + ')} — rejects: ${toolSelection.rejected_tools.length > 0 ? toolSelection.rejected_tools.join(', ') : 'none'}`,
      'Gemini Flash',
      s, elapsed() - s,
      {
        tools:          toolSelection.tools,
        selected_tools: toolSelection.selected_tools,
        rejected_tools: toolSelection.rejected_tools,
        confidence:     toolSelection.confidence,
        fallback_used:  toolSelectionFallback,
      }
    ))

    logDecision(
      `Tool selection: ${toolSelection.tools} — ${toolSelection.selected_tools.join(', ')} selected`,
      toolSelection.reasoning,
      {
        tools:           toolSelection.tools,
        selected:        toolSelection.selected_tools,
        rejected:        toolSelection.rejected_tools,
        confidence:      toolSelection.confidence,
        model:           process.env.GEMINI_MODEL_FLASH,
        fallback_used:   toolSelectionFallback,
        escalation:      toolSelection.tools.includes('escalate'),
      },
      toolSelection.tools.includes('escalate')
        ? 'Senior attorney escalation added to workflow'
        : `Execution continues with ${toolSelection.selected_tools.join(' + ')}`
    )

    // Derive whether each tool runs from the model's selection
    const runAtlas         = !toolSelection.tools.includes('courtlistener_only')
    const runCourtListener = toolSelection.tools.includes('courtlistener') || toolSelection.tools.includes('atlas_courtlistener')
    // runEscalation: flag the entire docket for senior attorney review
    // Recorded in tool_selection and surfaced in the human oversight panel
    if (toolSelection.tools.includes('escalate')) {
      logDecision(
        'Tool selection: docket-level escalation flagged by model',
        'Model assessed case complexity and urgency as requiring senior attorney review before recommendations are acted upon',
        { tool_selection: toolSelection.tools, escalation: true },
        'Docket flagged for senior attorney review — all action items require escalated authorization'
      )
    }

    // ────────────────────────────────────────────────────────────────────────────
    // PRIORITY 2: MODEL-DIRECTED CASE SELECTION
    // Flash selects which cases receive retrieval resources — replacing the
    // algorithmic top-N slice. The model evaluates the top 10 candidates and
    // decides which 5 will benefit most from historical similarity search.
    // ────────────────────────────────────────────────────────────────────────────
    s = elapsed()
    const candidatePool = [
      ...criticalCases,
      ...urgentCases.filter((c) => !criticalCases.some((x) => String(x._id) === String(c._id))),
      ...highScoreCases.filter((c) => !urgentCases.some((x) => String(x._id) === String(c._id))),
    ].slice(0, 10)  // give the model up to 10 candidates to choose from

    let caseSelection = null
    let caseSelectionFallback = false

    if (candidatePool.length > 5 && runAtlas) {
      const caseList = candidatePool.map((c, i) =>
        `${i}: ${c.client_name || 'Unknown'} | ${c.case_type} | deadline=${c.deadline_days ?? '?'}d | score=${c.priority_score ?? '?'} | missing=${c.missing_info?.length ?? 0} docs`
      ).join('\n')

      const CASE_SELECTION_PROMPT = `SELECT WHICH CASES DESERVE RETRIEVAL RESOURCES.

You have ${candidatePool.length} candidate cases. Select the 5 that will benefit most from Atlas $vectorSearch.
Prioritize cases where historical precedent would most influence the attorney recommendation.
Consider: cases with novel fact patterns, complex legal issues, or insufficient context.

CANDIDATES:
${caseList}

Return the indices (0-based) of exactly 5 cases. Explain your selection criteria.

Return JSON only:
{
  "selected_indices": [0, 1, 2, 3, 4],
  "reasoning": "1-2 sentences on what drove case selection",
  "selection_criteria": "the factors that determined which cases were chosen vs skipped"
}`

      try {
        const csRaw    = await callGeminiFlash('Legal case resource allocator. Select exactly 5 cases. Return JSON only.', CASE_SELECTION_PROMPT)
        const csParsed = JSON.parse(csRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
        if (Array.isArray(csParsed.selected_indices) && csParsed.selected_indices.length >= 3) {
          const validIdx    = csParsed.selected_indices.filter((i) => typeof i === 'number' && i >= 0 && i < candidatePool.length).slice(0, 5)
          const rejectedIdx = candidatePool.map((_, i) => i).filter((i) => !validIdx.includes(i))
          caseSelection = {
            selected_case_ids:  validIdx.map((i) => String(candidatePool[i]._id)),
            rejected_case_ids:  rejectedIdx.map((i) => String(candidatePool[i]._id)),
            selected_count:     validIdx.length,
            rejected_count:     rejectedIdx.length,
            reasoning:          csParsed.reasoning || '',
            selection_criteria: csParsed.selection_criteria || '',
            fallback_used:      false,
          }
        }
      } catch {
        caseSelectionFallback = true
      }
    }

    // Fallback: use algorithmic top-5
    if (!caseSelection) {
      const top5    = candidatePool.slice(0, 5)
      const skipped = candidatePool.slice(5)
      caseSelection = {
        selected_case_ids:  top5.map((c) => String(c._id)),
        rejected_case_ids:  skipped.map((c) => String(c._id)),
        selected_count:     top5.length,
        rejected_count:     skipped.length,
        reasoning:          'Fallback: top 5 by urgency score (model selection unavailable)',
        selection_criteria: 'deadline proximity, vulnerability score, case type severity',
        fallback_used:      true,
      }
      caseSelectionFallback = true
    }

    if (candidatePool.length > 5) {
      steps.push(makeStep('case_selection',
        `Model selects ${caseSelection.selected_count} of ${candidatePool.length} candidates for retrieval — ${caseSelection.rejected_count} skipped`,
        'Gemini Flash',
        s, elapsed() - s,
        {
          candidates_evaluated: candidatePool.length,
          cases_selected:       caseSelection.selected_count,
          cases_skipped:        caseSelection.rejected_count,
          selection_criteria:   caseSelection.selection_criteria,
          fallback_used:        caseSelectionFallback,
        }
      ))

      logDecision(
        `Case selection: ${caseSelection.selected_count} of ${candidatePool.length} cases allocated retrieval resources`,
        caseSelection.reasoning,
        {
          total_candidates: candidatePool.length,
          selected:         caseSelection.selected_count,
          skipped:          caseSelection.rejected_count,
          criteria:         caseSelection.selection_criteria,
          fallback_used:    caseSelectionFallback,
        },
        `Atlas $vectorSearch will run for ${caseSelection.selected_count} model-selected cases; ${caseSelection.rejected_count} will use deadline/vulnerability scoring only`
      )
    }

    // Resolve the final search targets from model selection
    const searchTargets = runAtlas
      ? candidatePool.filter((c) => caseSelection.selected_case_ids.includes(String(c._id))).slice(0, 5)
      : []

    const vectorSearchResults = []

    if (searchTargets.length > 0) {
      // Run all searches concurrently
      const searchPromises = searchTargets.map(async (c) => {
        const text = c.summary || c.description
          || `${c.case_type} legal matter for ${c.client_name || 'client'} with deadline in ${c.deadline_days ?? 'unknown'} days`
        try {
          const { results, via } = await findSimilarCases(text, 3)
          return {
            case_id:     String(c._id),
            client_name: c.client_name,
            case_type:   c.case_type,
            matched_cases: results.length,
            via,
            top_similarity:    results[0]?.similarity_score ?? null,
            top_outcome:       results[0]?.outcome ?? null,
            top_outcome_notes: results[0]?.outcome_notes ?? null,
            top_year:          results[0]?.year ?? null,
            results:           results.slice(0, 3),
          }
        } catch {
          return {
            case_id:     String(c._id),
            client_name: c.client_name,
            case_type:   c.case_type,
            matched_cases: 0,
            via:           'error',
            results:       [],
          }
        }
      })

      const settled = await Promise.allSettled(searchPromises)
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value.matched_cases > 0) {
          vectorSearchResults.push(r.value)
        }
      }
    }

    const realVectorMatches    = vectorSearchResults.reduce((sum, r) => sum + r.matched_cases, 0)
    const realCasesWithMatches = vectorSearchResults.length
    const topSimilarity        = vectorSearchResults[0]?.top_similarity ?? null
    const searchVia            = vectorSearchResults[0]?.via ?? (searchTargets.length === 0 ? 'no_targets' : 'not_configured')

    steps.push(makeStep('vector_search',
      'Run Atlas $vectorSearch against historical case database', 'MongoDB Vector Search',
      s, elapsed() - s, {
        searches_attempted:   searchTargets.length,
        similar_cases_found:  realVectorMatches,
        cases_with_matches:   realCasesWithMatches,
        top_similarity_score: topSimilarity !== null ? Math.round(topSimilarity * 1000) / 1000 : null,
        index:                'description_embedding_index',
        via:                  searchVia,
      }))

    // ── DECISION C: Vector search quality assessment ─────────────────────────
    logDecision(
      realCasesWithMatches > 0
        ? `Historical precedents found for ${realCasesWithMatches} case${realCasesWithMatches !== 1 ? 's' : ''} via Atlas $vectorSearch`
        : searchTargets.length === 0
          ? 'No cases to search against — vector search skipped'
          : 'Atlas $vectorSearch returned no historical matches',
      realCasesWithMatches > 0
        ? `Top cosine similarity score: ${topSimilarity !== null ? (topSimilarity * 100).toFixed(1) + '%' : 'n/a'}. Historical outcome data (${[...new Set(vectorSearchResults.map(r => r.top_outcome).filter(Boolean))].join(', ')}) will be incorporated into attorney recommendations.`
        : searchTargets.length === 0
          ? 'No urgent cases to search against historical database'
          : 'The past_cases collection may be empty or the Atlas vector search index (description_embedding_index) may not be configured. Run POST /api/seed/past-cases to populate.',
      {
        searches_attempted:      searchTargets.length,
        cases_with_matches:      realCasesWithMatches,
        total_matches:           realVectorMatches,
        top_similarity_score:    topSimilarity,
        index:                   'description_embedding_index',
        collection:              'past_cases',
        via:                     searchVia,
      },
      realCasesWithMatches > 0
        ? 'Historical outcome data incorporated into Gemini recommendation prompt'
        : 'Recommendations will rely on deadline analysis, vulnerability scoring, and documentation review only'
    )

    // ── ADAPTIVE SEARCH: model evaluates retrieval quality → can expand scope ─
    // This is a genuine feedback loop: the model receives actual Atlas $vectorSearch
    // results (similarity scores, match counts) and decides whether the corpus
    // produced sufficient context, or whether a broader search is warranted.
    // If it chooses to expand, it triggers additional Atlas queries and the
    // results are merged into the context passed to Gemini Flash.
    let adaptiveSearchTriggered = false

    // Compute outcome diversity for the evaluation prompt
    const outcomeCounts = vectorSearchResults.reduce((acc, r) => {
      r.results?.forEach((res) => { if (res.outcome) acc[res.outcome] = (acc[res.outcome] || 0) + 1 })
      return acc
    }, {})
    const uniqueOutcomes  = Object.keys(outcomeCounts).length
    const outcomesSummary = Object.entries(outcomeCounts).map(([k, v]) => `${k}:${v}`).join(', ') || 'none'

    if (searchTargets.length > 0 && realCasesWithMatches < Math.ceil(searchTargets.length / 2)) {
      // Fewer than half the searched cases found matches — ask model to evaluate
      // Now includes outcome diversity so the model can assess both quantity AND quality
      const adaptPrompt = `Atlas $vectorSearch returned results for this docket. Evaluate retrieval quality:

QUANTITY:  searches_attempted=${searchTargets.length} | cases_with_matches=${realCasesWithMatches} | total_matches=${realVectorMatches}
QUALITY:   top_similarity=${topSimilarity !== null ? (topSimilarity * 100).toFixed(1) + '%' : 'none'} | via=${searchVia}
DIVERSITY: unique_outcomes=${uniqueOutcomes} | outcome_mix=${outcomesSummary}

Evaluate: are these results sufficient for grounding attorney recommendations in historical precedent?
Consider ALL three dimensions:
  1. Quantity — are enough cases matched?
  2. Quality  — are similarity scores high enough to be meaningful?
  3. Diversity — do results cover multiple outcome types (won/settled/declined)?

If any dimension is insufficient, a broader search may improve recommendation quality.

Return JSON only: {"action":"proceed"|"expand","reasoning":"one sentence covering all three dimensions","quality_score":"high|medium|low"}`

      try {
        const adaptRaw    = await callGeminiFlash('Evaluate Atlas $vectorSearch result quality. Return JSON only, no markdown.', adaptPrompt)
        const adaptResult = JSON.parse(adaptRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())

        const adaptQuality = adaptResult.quality_score || 'unknown'

        if (adaptResult.action === 'expand') {
          adaptiveSearchTriggered = true

          logDecision(
            'Model triggered adaptive $vectorSearch — expanding to case-type-level queries',
            adaptResult.reasoning,
            {
              initial_matches:      realVectorMatches,
              cases_with_matches:   realCasesWithMatches,
              top_similarity:       topSimilarity,
              outcome_diversity:    uniqueOutcomes,
              outcome_mix:          outcomesSummary,
              quality_score:        adaptQuality,
              threshold_triggered:  Math.ceil(searchTargets.length / 2),
              adaptive_action:      'expand',
              model:                process.env.GEMINI_MODEL_FLASH,
            },
            'Running broader Atlas $vectorSearch with case-type keyword queries; results merged into recommendation context'
          )

          // Broader queries: general legal keywords per case type instead of specific summaries
          const BROAD_TEMPLATES = {
            eviction:          'tenant eviction housing emergency family deadline relief',
            immigration:       'immigration removal deportation appeal emergency stay relief',
            custody:           'child custody emergency modification safety protective order',
            wage_theft:        'wage theft unpaid overtime labor rights employee claim',
            employment:        'wrongful termination discrimination retaliation employee rights',
            domestic_violence: 'domestic violence protective order safety emergency victim',
            other:             'legal aid emergency relief due process civil rights',
          }

          const broadTypes = [...new Set(searchTargets.map((c) => c.case_type))]
          const adaptSearchPromises = broadTypes.map(async (caseType) => {
            try {
              const { results } = await findSimilarCases(BROAD_TEMPLATES[caseType] || BROAD_TEMPLATES.other, 3)
              return { caseType, results }
            } catch {
              return { caseType, results: [] }
            }
          })

          const adaptSettled = await Promise.allSettled(adaptSearchPromises)
          const existingIds  = new Set(vectorSearchResults.flatMap((v) => v.results.map((r) => r.id).filter(Boolean)))
          let   adaptAdded   = 0

          for (const r of adaptSettled) {
            if (r.status !== 'fulfilled' || !r.value.results.length) continue
            const newResults = r.value.results.filter((res) => !existingIds.has(res.id))
            if (newResults.length === 0) continue
            adaptAdded += newResults.length
            vectorSearchResults.push({
              case_id:           `adaptive_${r.value.caseType}`,
              client_name:       `Adaptive (${r.value.caseType})`,
              case_type:         r.value.caseType,
              matched_cases:     newResults.length,
              via:               'adaptive-broad',
              top_similarity:    newResults[0]?.similarity_score ?? null,
              top_outcome:       newResults[0]?.outcome ?? null,
              top_outcome_notes: newResults[0]?.outcome_notes ?? null,
              results:           newResults.slice(0, 3),
            })
          }

          if (adaptAdded > 0) {
            logDecision(
              `Adaptive search found ${adaptAdded} additional historical case${adaptAdded !== 1 ? 's' : ''}`,
              `Broader case-type queries against description_embedding_index returned ${adaptAdded} previously-unmatched results`,
              { additional_matches: adaptAdded, total_matches_now: vectorSearchResults.reduce((s, r) => s + r.matched_cases, 0) },
              'Additional historical context merged into Gemini Flash recommendation prompt'
            )
          }
        } else {
          logDecision(
            'Model assessed $vectorSearch quality — proceeding with current results',
            adaptResult.reasoning,
            {
              matches:           realVectorMatches,
              top_similarity:    topSimilarity,
              outcome_diversity: uniqueOutcomes,
              outcome_mix:       outcomesSummary,
              quality_score:     adaptQuality,
              action:            'proceed',
            },
            'Retrieval quality accepted; recommendations will incorporate existing historical context'
          )
        }
      } catch {
        // Non-fatal — proceed with original results unchanged
      }
    }

    // Final totals after any adaptive search
    const finalVectorMatches     = vectorSearchResults.reduce((sum, r) => sum + r.matched_cases, 0)
    const finalCasesWithMatches  = vectorSearchResults.length

    // ────────────────────────────────────────────────────────────────────────────
    // PRIORITY 3: MODEL-DIRECTED EVIDENCE SUFFICIENCY EVALUATION
    // Flash evaluates whether the retrieved historical evidence is sufficient
    // to generate reliable attorney recommendations — or whether more retrieval
    // is needed, or whether the complexity warrants escalation.
    // Three outcomes: sufficient | retrieve_more | escalate
    // ────────────────────────────────────────────────────────────────────────────
    s = elapsed()
    let evidenceSufficiency = null
    let evidenceFallback    = false

    if (searchTargets.length > 0) {
      const outcomeDist = vectorSearchResults.reduce((acc, r) => {
        r.results?.forEach((res) => { if (res.outcome) acc[res.outcome] = (acc[res.outcome] || 0) + 1 })
        return acc
      }, {})
      const outcomeSummary = Object.entries(outcomeDist).map(([k, v]) => `${k}:${v}`).join(', ') || 'none'
      const uniqueOut = Object.keys(outcomeDist).length
      const caseTypesWithoutMatches = searchTargets
        .filter((c) => !vectorSearchResults.find((r) => r.case_id === String(c._id)))
        .map((c) => c.case_type)

      const EVIDENCE_PROMPT = `EVALUATE RETRIEVAL SUFFICIENCY FOR RECOMMENDATION GENERATION.

RETRIEVAL RESULTS:
- Cases searched: ${searchTargets.length}
- Cases with historical matches: ${finalCasesWithMatches}
- Total historical matches: ${finalVectorMatches}
- Top similarity score: ${topSimilarity !== null ? (topSimilarity * 100).toFixed(1) + '%' : 'none'}
- Outcome distribution: ${outcomeSummary}
- Outcome type diversity: ${uniqueOut} distinct outcomes
- Case types without matches: ${caseTypesWithoutMatches.join(', ') || 'none'}
- Critical cases (≤3d deadline): ${criticalCases.length}

Is this evidence sufficient to generate reliable attorney recommendations?

"sufficient": historical context covers the priority cases adequately
"retrieve_more": one or more high-priority case types lack historical context; another retrieval pass would improve recommendations
"escalate": evidence is inadequate AND complexity warrants senior attorney review before recommendations proceed

Return JSON only:
{
  "verdict": "sufficient"|"retrieve_more"|"escalate",
  "match_quality": "high"|"medium"|"low",
  "missing_context": "which case types or fact patterns lack historical context, or null",
  "reasoning": "1 sentence"
}`

      try {
        const evRaw    = await callGeminiFlash('Legal evidence quality reviewer. Return JSON only.', EVIDENCE_PROMPT)
        const evParsed = JSON.parse(evRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
        const validVerdicts = ['sufficient', 'retrieve_more', 'escalate']
        if (validVerdicts.includes(evParsed.verdict)) {
          evidenceSufficiency = {
            verdict:               evParsed.verdict,
            match_quality:         evParsed.match_quality || 'medium',
            missing_context:       evParsed.missing_context || null,
            reasoning:             evParsed.reasoning || '',
            second_pass_triggered: false,
            fallback_used:         false,
          }
        }
      } catch {
        evidenceFallback = true
      }

      if (!evidenceSufficiency) {
        evidenceSufficiency = {
          verdict:               finalVectorMatches > 0 ? 'sufficient' : 'retrieve_more',
          match_quality:         topSimilarity != null && topSimilarity >= 0.8 ? 'high' : 'medium',
          missing_context:       null,
          reasoning:             'Fallback verdict based on match count',
          second_pass_triggered: false,
          fallback_used:         true,
        }
        evidenceFallback = true
      }

      // If model says retrieve_more: run one additional broad retrieval pass.
      // Skip if adaptive search already expanded scope (avoids double-retrieval
      // and the resulting 13 Vertex AI embedding calls in a single run).
      if (evidenceSufficiency.verdict === 'retrieve_more' && adaptiveSearchTriggered) {
        // Adaptive search already covered this — log the suppression, update verdict label
        evidenceSufficiency.second_pass_triggered = false
        evidenceSufficiency.second_pass_suppressed_by_adaptive = true
        logDecision(
          'Evidence retrieve_more suppressed — adaptive search already expanded retrieval scope',
          'Adaptive search ran earlier in this execution and added broader queries; a second evidence pass would duplicate that work.',
          { verdict: 'retrieve_more', suppressed: true, reason: 'adaptive_search_already_triggered' },
          'Proceeding with adaptive search results as the extended retrieval context'
        )
      } else if (evidenceSufficiency.verdict === 'retrieve_more') {
        evidenceSufficiency.second_pass_triggered = true
        const BROAD_FALLBACK = {
          eviction: 'tenant housing emergency relief', immigration: 'immigration removal appeal',
          custody: 'child custody emergency order', wage_theft: 'wage labor rights claim',
          employment: 'wrongful termination rights', domestic_violence: 'protective order safety',
          other: 'legal aid due process',
        }
        const missingTypes = caseTypesWithoutMatches.length > 0
          ? caseTypesWithoutMatches
          : [...new Set(searchTargets.map((c) => c.case_type))]
        const secondPassPromises = missingTypes.slice(0, 3).map(async (ct) => {
          try {
            const { results } = await findSimilarCases(BROAD_FALLBACK[ct] || BROAD_FALLBACK.other, 3)
            return results.map((r) => ({ ...r, second_pass: true }))
          } catch { return [] }
        })
        const spSettled = await Promise.allSettled(secondPassPromises)
        const existingIds = new Set(vectorSearchResults.flatMap((v) => v.results.map((r) => r.id).filter(Boolean)))
        let spAdded = 0
        for (const r of spSettled) {
          if (r.status !== 'fulfilled' || !r.value.length) continue
          const fresh = r.value.filter((res) => !existingIds.has(res.id))
          if (!fresh.length) continue
          spAdded += fresh.length
          vectorSearchResults.push({
            case_id: 'evidence_pass_2', client_name: 'Second Pass', case_type: 'multi',
            matched_cases: fresh.length, via: 'evidence-sufficiency-pass2',
            top_similarity: fresh[0]?.similarity_score ?? null, top_outcome: fresh[0]?.outcome ?? null,
            top_outcome_notes: fresh[0]?.outcome_notes ?? null, results: fresh.slice(0, 3),
          })
        }

        logDecision(
          `Evidence insufficiency triggered second retrieval pass — ${spAdded} additional matches`,
          evidenceSufficiency.reasoning,
          {
            verdict:       'retrieve_more',
            second_pass:   true,
            added_matches: spAdded,
            missing_types: missingTypes,
          },
          `Second Atlas $vectorSearch pass retrieved ${spAdded} additional historical cases`
        )
      } else if (evidenceSufficiency.verdict === 'escalate') {
        // Escalate verdict changes execution: injects a docket-level escalation action
        // and marks all existing action items as requiring mandatory attorney authorization.
        // This is not informational — it modifies the recommendation set.
        logDecision(
          'Evidence evaluation: retrieval insufficient — docket-level escalation activated',
          evidenceSufficiency.reasoning,
          {
            verdict:       'escalate',
            match_quality: evidenceSufficiency.match_quality,
            execution:     'all recommendations will require escalated attorney authorization',
          },
          'Escalation action injected; all recommendations flagged for mandatory senior attorney review'
        )
        // Flag persisted on evidenceSufficiency so downstream can read it
        evidenceSufficiency.escalation_activated = true
      } else {
        logDecision(
          `Evidence evaluation: ${evidenceSufficiency.match_quality} quality — sufficient for recommendations`,
          evidenceSufficiency.reasoning,
          { verdict: 'sufficient', match_quality: evidenceSufficiency.match_quality, total_matches: finalVectorMatches },
          'Proceeding to recommendation generation with current historical context'
        )
      }

      steps.push(makeStep('evidence_sufficiency',
        `Model evaluates retrieval quality → verdict: "${evidenceSufficiency.verdict}"${evidenceSufficiency.second_pass_triggered ? ' → second pass triggered' : ''}`,
        'Gemini Flash',
        s, elapsed() - s,
        {
          verdict:                           evidenceSufficiency.verdict,
          match_quality:                     evidenceSufficiency.match_quality,
          missing_context:                   evidenceSufficiency.missing_context,
          second_pass_triggered:             evidenceSufficiency.second_pass_triggered,
          second_pass_suppressed_by_adaptive: evidenceSufficiency.second_pass_suppressed_by_adaptive ?? false,
          escalation_activated:              evidenceSufficiency.escalation_activated ?? false,
          fallback_used:                     evidenceFallback,
        }
      ))
    }

    // Update final totals after evidence sufficiency may have added a second pass
    const finalVectorMatchesPost     = vectorSearchResults.reduce((sum, r) => sum + r.matched_cases, 0)
    const finalCasesWithMatchesPost  = vectorSearchResults.length

    // ── STEP 5: CourtListener — now driven by tool_selection ──────────────────
    s = elapsed()
    let courtOpinions = []

    if (runCourtListener) {
      const caseTypesToSearch = [...new Set(
        urgentCases.map((c) => c.case_type).filter(Boolean)
      )].slice(0, 3)

      // ── Model-generated CourtListener queries (Gemini Flash) ───────────────
      // Instead of hardcoded query strings, ask the model to generate case-specific
      // search terms based on the actual facts of the urgent cases.
      // This is genuine tool parameterization: the model decides WHAT to search for.
      let modelQueries = {}
      let queriesVia   = 'hardcoded-fallback'

      const queryContext = urgentCases.slice(0, 4).map((c) =>
        `${c.case_type}: ${(c.priority_reason || c.summary || '').slice(0, 150)}`
      ).join('\n')

      if (queryContext.length > 0) {
        try {
          const qRaw = await callGeminiFlash(
            'Return only valid JSON. No markdown. No explanation.',
            `Generate targeted CourtListener search queries (7-12 words each) to find relevant emergency relief court opinions for these legal aid cases.

URGENT CASES:
${queryContext}

Return a JSON object mapping case type to search query string. Include only the case types present above.
Example format: { "eviction": "emergency tenant stay unlawful detainer housing children", "immigration": "..." }`
          )
          const parsed = JSON.parse(qRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
          if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            modelQueries = parsed
            queriesVia   = 'gemini-flash'
          }
        } catch {
          queriesVia = 'hardcoded-fallback'
        }
      }

      logDecision(
        queriesVia === 'gemini-flash'
          ? 'Gemini Flash generated case-specific CourtListener search queries'
          : 'Using fallback CourtListener queries — Gemini Flash query generation unavailable',
        queriesVia === 'gemini-flash'
          ? `Model generated ${Object.keys(modelQueries).length} targeted search queries from case summaries rather than generic case-type templates`
          : 'Gemini call failed or context unavailable; proceeding with predefined query templates',
        { queries_via: queriesVia, case_types: caseTypesToSearch, model_queries: Object.keys(modelQueries) },
        `CourtListener will execute with ${queriesVia === 'gemini-flash' ? 'model-generated' : 'fallback'} queries`
      )

      for (const ct of caseTypesToSearch) {
        const opinions = await searchCourtListener(ct, 3, modelQueries[ct] ?? null)
        courtOpinions.push(...opinions)
      }
      if (courtOpinions.length === 0 && cases.length > 0) {
        const typeCounts = {}
        cases.forEach((c) => { if (c.case_type) typeCounts[c.case_type] = (typeCounts[c.case_type] || 0) + 1 })
        const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (topType) courtOpinions.push(...await searchCourtListener(topType, 3, modelQueries[topType] ?? null))
      }
      steps.push(makeStep('courtlistener', 'Query CourtListener API for relevant legal precedents', 'CourtListener API',
        s, elapsed() - s, {
          case_types_searched: Math.max((urgentCases.map((c) => c.case_type).filter(Boolean).length), 1),
          opinions_retrieved:  courtOpinions.length,
          queries_via:         queriesVia,
          branched:            true,
        }))
    } else {
      // Branch taken — log a zero-duration skipped step so the trace is complete
      steps.push(makeStep('courtlistener', 'CourtListener query — skipped (no urgent cases in docket)', 'CourtListener API',
        s, 0, { skipped: true, reason: 'No urgent cases — branch decision logged in decisions array' }))
    }

    // ── STEP 6: Generate recommendations ────────────────────────────────────
    s = elapsed()
    // priorityQueue must include the model-selected cases (searchTargets) so their
    // vector search results are actually consumed. Model-selected cases are promoted
    // to the front, then filled with additional urgent/high-score cases up to 8.
    const modelSelectedIds = new Set((caseSelection?.selected_case_ids ?? []))
    const modelSelectedCases = searchTargets.filter((c) => modelSelectedIds.has(String(c._id)))
    const remainingCases = [
      ...criticalCases,
      ...urgentCases.filter((c) => !criticalCases.some((x) => String(x._id) === String(c._id))),
      ...highScoreCases.filter((c) => !urgentCases.some((x) => String(x._id) === String(c._id))),
    ].filter((c) => !modelSelectedIds.has(String(c._id)))
    const priorityQueue = [
      ...modelSelectedCases,   // model-selected cases with vector search results first
      ...remainingCases,        // then urgent/high-score cases without vector results
    ].slice(0, 8)

    let recommendations = []
    if (priorityQueue.length > 0) {
      const caseList = priorityQueue.map((c, i) => {
        // Find any historical matches for this case from vector search
        const match = vectorSearchResults.find((r) => r.case_id === String(c._id))
        const historicalContext = match?.results?.[0]
          ? `Historical match (${(match.results[0].similarity_score * 100).toFixed(0)}% similarity): ${match.results[0].outcome} — ${match.results[0].outcome_notes}`
          : 'No historical match found'
        return `${i + 1}. ${c.client_name || 'Unknown'} | ${c.case_type} | Deadline: ${c.deadline_days != null ? c.deadline_days + 'd' : 'unknown'} | Score: ${c.priority_score ?? '?'} | Missing: ${c.missing_info?.join(', ') || 'none'}\n   Summary: ${(c.priority_reason || c.summary || '').slice(0, 120)}\n   ${historicalContext}`
      }).join('\n\n')

      const precedentContext = courtOpinions.slice(0, 4).map((op) =>
        `- ${op.case_name} (${op.court}): ${op.snippet || 'No excerpt available'}`
      ).join('\n')

      // Recommendations use Flash — structured JSON output, tight format spec, no quality loss vs Pro
      const recPrompt = `CASES (${priorityQueue.length}):
${caseList}

${courtOpinions.length > 0 ? `COURTLISTENER PRECEDENTS:\n${precedentContext}` : ''}
${vectorSearchResults.length > 0 ? `HISTORICAL MATCHES:\n${vectorSearchResults.map(r => `- ${r.client_name} (${r.case_type}): ${r.top_outcome?.toUpperCase() || 'n/a'} at ${r.top_similarity ? (r.top_similarity * 100).toFixed(0) + '%' : 'n/a'} — ${r.top_outcome_notes || ''}`).join('\n')}` : ''}

Return ONLY a valid JSON array:
[{"client_name":"exact","case_type":"type","priority":"critical|high|medium","action":"Specific attorney action TODAY/TOMORROW","rationale":"1 sentence with urgency/outcome/precedent","deadline_warning":"deadline context"}]`

      try {
        const raw = await callGeminiFlash(
          'You are a senior legal operations analyst. Generate specific, actionable attorney recommendations. Be direct. No hedging. Return only the JSON array.',
          recPrompt
        )
        const match = raw.match(/\[[\s\S]*?\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed)) recommendations = parsed
        }
      } catch {
        recommendations = priorityQueue.map((c) => ({
          client_name:      c.client_name || 'Unknown',
          case_type:        c.case_type,
          priority:         c.deadline_days != null && c.deadline_days <= 3 ? 'critical'
                          : c.deadline_days != null && c.deadline_days <= 7 ? 'high' : 'medium',
          action:           `Schedule emergency consultation for ${c.case_type} case and review all documentation`,
          rationale:        c.priority_reason || 'High priority score and upcoming deadline require immediate attorney review',
          deadline_warning: c.deadline_days != null ? `${c.deadline_days} days until deadline` : 'Deadline unknown — verify immediately',
        }))
      }
    }

    // Inject documentation remediation action if gap rate is high
    if (highDocGapRate && withMissingDocs.length > 0) {
      recommendations.push({
        client_name:      'All Clients',
        case_type:        'Documentation',
        priority:         'high',
        action:           `Contact ${withMissingDocs.length} clients to collect outstanding documents before hearing dates`,
        rationale:        `${docGapRatePct}% documentation gap rate — incomplete files are the primary bottleneck to case advancement (remediation branch activated)`,
        deadline_warning: 'Documentation gaps must be resolved before any hearing can proceed',
      })
    }

    // ── Evidence escalation: if retrieval was flagged insufficient, modify execution ──
    // This makes evidence_sufficiency 'escalate' genuinely execution-changing:
    // all recommendations are marked as requiring attorney authorization and an
    // explicit docket-level escalation item is injected into the action list.
    if (evidenceSufficiency?.escalation_activated) {
      recommendations.forEach((r) => {
        r.authorization_required   = true
        r.authorization_reason     = 'Evidence retrieval was insufficient — docket requires senior attorney review before any action is taken'
        r.risk_assessment          = 'high'
        r.escalated_by_evidence    = true
      })
      recommendations.unshift({
        client_name:      'Docket (All Cases)',
        case_type:        'Escalation',
        priority:         'critical',
        action:           'SENIOR ATTORNEY REVIEW REQUIRED before any case action — evidence retrieval was insufficient for reliable triage',
        rationale:        evidenceSufficiency.reasoning || 'Model assessed that historical context is inadequate to support confident recommendations',
        deadline_warning: 'No action should be taken on any case until a senior attorney reviews this docket',
        authorization_required: true,
        authorization_reason:   'Evidence insufficiency escalation — docket-level risk',
        risk_assessment:        'high',
        escalated_by_evidence:  true,
      })
    }

    // ── MODEL OVERSIGHT REVIEW: Flash evaluates recommendations for human authorization ──
    // The model reads its own generated recommendations and determines which specific
    // actions require mandatory attorney authorization before any step is taken.
    // This is the model reacting to content it just produced — a genuine output-to-input loop.
    const criticalRecs = recommendations.filter((r) => r.priority === 'critical' || r.priority === 'high')

    if (criticalRecs.length > 0) {
      const oversightPrompt = `GENERATED ATTORNEY RECOMMENDATIONS (critical/high priority):
${criticalRecs.map((r, i) => `${i + 1}. ${r.client_name} (${r.case_type}): ${r.action}`).join('\n')}

For each item evaluate:
  1. requires_authorization: does this action require mandatory attorney sign-off before ANY step?
     (Consider: court filings, emergency motions, federal proceedings, rights waivers, client contact on imminent deadlines)
  2. authorization_reason: if yes, the specific legal compliance reason (cite bar rules or legal risk if applicable)
  3. risk_assessment: "high" | "medium" | "low" — potential harm if action is taken without attorney review
  4. confidence: 0.0–1.0 — how confident are you in this oversight assessment?

Return JSON array (one entry per recommendation):
[{"client_name":"exact","requires_authorization":true|false,"authorization_reason":"specific reason or null","risk_assessment":"high|medium|low","confidence":0.0}]`

      try {
        const oversightRaw    = await callGeminiFlash(
          'You are a legal ethics compliance reviewer. Identify which attorney actions require mandatory human authorization before execution. Return JSON only.',
          oversightPrompt
        )
        const oversightResult = JSON.parse(oversightRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())

        if (Array.isArray(oversightResult)) {
          let flaggedCount = 0
          for (const item of oversightResult) {
            if (!item.requires_authorization) continue
            const rec = recommendations.find((r) => r.client_name === item.client_name)
            if (rec) {
              rec.authorization_required = true
              rec.authorization_reason   = item.authorization_reason
              rec.risk_assessment        = item.risk_assessment || 'high'
              rec.oversight_confidence   = typeof item.confidence === 'number' ? item.confidence : null
              flaggedCount++
            }
          }

          if (flaggedCount > 0) {
            logDecision(
              `Human authorization required for ${flaggedCount} recommendation${flaggedCount !== 1 ? 's' : ''} — model reviewed generated actions for legal compliance`,
              'Gemini Flash reviewed its own recommendations and identified specific actions requiring attorney sign-off before execution. No automated action will be taken on these items.',
              {
                total_reviewed:    criticalRecs.length,
                flagged_for_auth:  flaggedCount,
                model:             process.env.GEMINI_MODEL_FLASH,
                loop:              'output-to-input',
              },
              `${flaggedCount} item${flaggedCount !== 1 ? 's' : ''} in human oversight panel with specific authorization reasoning`
            )
          }
        }
      } catch {
        // Non-fatal — oversight review failure does not affect recommendations
      }
    }

    steps.push(makeStep('recommendations', 'Generate AI-powered triage recommendations with Gemini Flash', 'Gemini Flash',
      s, elapsed() - s, {
        recommendations_generated: recommendations.length,
        critical:    recommendations.filter((r) => r.priority === 'critical').length,
        high:        recommendations.filter((r) => r.priority === 'high').length,
        vector_data_used: vectorSearchResults.length > 0,
        oversight_reviewed: criticalRecs.length,
        flagged_for_authorization: recommendations.filter((r) => r.authorization_required).length,
      }))

    // ────────────────────────────────────────────────────────────────────────────
    // PRIORITY 4: RECOMMENDATION CHALLENGE LOOP
    // Flash reads its own generated recommendations and identifies the most
    // uncertain case, missing evidence, and gaps in reasoning. This is a genuine
    // self-critique loop: the model challenges content it just produced.
    // ────────────────────────────────────────────────────────────────────────────
    let challengeReview = null
    let challengeFallback = false

    if (recommendations.length > 0) {
      s = elapsed()
      const recSummary = recommendations.slice(0, 6).map((r, i) =>
        `${i + 1}. ${r.client_name} (${r.case_type}) — ${r.priority} — "${r.action}"\n   Rationale: ${r.rationale || 'none'}`
      ).join('\n\n')

      const CHALLENGE_PROMPT = `YOU GENERATED THESE ATTORNEY RECOMMENDATIONS. NOW CHALLENGE THEM.

${recSummary}

As a rigorous legal operations quality reviewer, identify weaknesses in these recommendations.
Be critical. The goal is to surface uncertainty before attorneys act.

Answer:
1. Which recommendation is MOST LIKELY to be wrong or insufficient, and why?
2. What specific evidence is MISSING that would make these recommendations more reliable?
3. What is your OVERALL CONFIDENCE in this recommendation set?
4. What single follow-up action would most improve confidence?

Return JSON only:
{
  "most_uncertain_case": "client name",
  "uncertainty_reason": "specific reason this recommendation may be wrong or insufficient",
  "missing_evidence": ["piece of missing evidence 1", "piece 2"],
  "confidence_assessment": "high|medium|low — with brief explanation",
  "recommended_follow_up": "single most valuable action to take before proceeding"
}`

      try {
        const crRaw    = await callGeminiFlash('Legal recommendation quality auditor. Be critical. Return JSON only.', CHALLENGE_PROMPT)
        const crParsed = JSON.parse(crRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
        if (crParsed.most_uncertain_case && crParsed.uncertainty_reason) {
          challengeReview = {
            most_uncertain_case:   crParsed.most_uncertain_case,
            uncertainty_reason:    crParsed.uncertainty_reason,
            missing_evidence:      Array.isArray(crParsed.missing_evidence) ? crParsed.missing_evidence : [],
            confidence_assessment: crParsed.confidence_assessment || '',
            recommended_follow_up: crParsed.recommended_follow_up || '',
            fallback_used:         false,
          }
        }
      } catch {
        challengeFallback = true
      }

      if (!challengeReview) {
        challengeReview = {
          most_uncertain_case:   recommendations[0]?.client_name ?? 'Unknown',
          uncertainty_reason:    'Challenge review unavailable — model call failed',
          missing_evidence:      [],
          confidence_assessment: 'medium — fallback',
          recommended_follow_up: 'Manual attorney review recommended',
          fallback_used:         true,
        }
        challengeFallback = true
      }

      const challengedRecommendationIndex = findRecommendationIndexByClient(recommendations, challengeReview.most_uncertain_case)
      const challengedRecommendation = challengedRecommendationIndex >= 0 ? recommendations[challengedRecommendationIndex] : null
      const confidenceLevel = challengeConfidenceLevel(challengeReview.confidence_assessment)
      const shouldRequireAuthorization =
        !challengeReview.fallback_used &&
        challengedRecommendation &&
        (confidenceLevel !== 'high' || challengeReview.missing_evidence.length > 0)

      challengeReview.execution_effect = {
        applied:                false,
        authorization_required: false,
        priority_adjusted:      false,
        affected_client:        challengedRecommendation?.client_name || challengeReview.most_uncertain_case,
        reason:                 challengedRecommendation
          ? 'Challenge review did not require execution changes'
          : 'No matching recommendation found for challenge review target',
      }

      if (shouldRequireAuthorization) {
        const previousPriority = challengedRecommendation.priority
        challengedRecommendation.authorization_required = true
        challengedRecommendation.authorization_reason =
          `Challenge review flagged this recommendation as uncertain: ${challengeReview.uncertainty_reason}. Follow-up before action: ${challengeReview.recommended_follow_up || 'manual attorney review'}.`
        challengedRecommendation.risk_assessment = confidenceLevel === 'low' ? 'high' : 'medium'
        challengedRecommendation.challenged_by_review = true
        challengedRecommendation.challenge_follow_up = challengeReview.recommended_follow_up || ''
        challengedRecommendation.challenge_missing_evidence = challengeReview.missing_evidence

        if (confidenceLevel === 'low' && challengedRecommendation.priority !== 'critical') {
          challengedRecommendation.priority = 'high'
        }

        const priorityAdjusted = previousPriority !== challengedRecommendation.priority
        challengeReview.execution_effect = {
          applied:                true,
          authorization_required: true,
          priority_adjusted:      priorityAdjusted,
          affected_client:        challengedRecommendation.client_name,
          previous_priority:      previousPriority,
          new_priority:           challengedRecommendation.priority,
          reason:                 'Most uncertain recommendation requires attorney authorization before action',
        }

        if (confidenceLevel === 'low' && challengedRecommendationIndex > 0) {
          recommendations.splice(challengedRecommendationIndex, 1)
          recommendations.unshift(challengedRecommendation)
          challengeReview.execution_effect.reordered = true
        }

        logDecision(
          `Challenge review changed execution for "${challengedRecommendation.client_name}"`,
          challengeReview.uncertainty_reason,
          {
            confidence_assessment: challengeReview.confidence_assessment,
            missing_evidence:      challengeReview.missing_evidence,
            recommended_follow_up: challengeReview.recommended_follow_up,
            authorization_required: true,
            priority_adjusted:      priorityAdjusted,
          },
          priorityAdjusted
            ? 'Recommendation priority raised and attorney authorization required before action'
            : 'Recommendation added to attorney authorization queue before action'
        )
      }

      steps.push(makeStep('challenge_review',
        `Model self-critique: most uncertain — ${challengeReview.most_uncertain_case} · confidence: ${challengeReview.confidence_assessment?.split(' ')[0] || 'assessed'}`,
        'Gemini Flash',
        s, elapsed() - s,
        {
          most_uncertain_case:   challengeReview.most_uncertain_case,
          uncertainty_reason:    challengeReview.uncertainty_reason,
          missing_evidence_count: challengeReview.missing_evidence.length,
          confidence:            challengeReview.confidence_assessment?.split(' ')[0] || 'unknown',
          fallback_used:         challengeFallback,
          execution_changed:      challengeReview.execution_effect.applied,
          authorization_required: challengeReview.execution_effect.authorization_required,
          priority_adjusted:      challengeReview.execution_effect.priority_adjusted,
        }
      ))

      logDecision(
        `Challenge review: most uncertain recommendation is "${challengeReview.most_uncertain_case}"`,
        challengeReview.uncertainty_reason,
        {
          missing_evidence:      challengeReview.missing_evidence,
          confidence_assessment: challengeReview.confidence_assessment,
          recommended_follow_up: challengeReview.recommended_follow_up,
          loop:                  'self-critique',
          model:                 process.env.GEMINI_MODEL_FLASH,
        },
        `Self-critique complete. Follow-up: ${challengeReview.recommended_follow_up}`
      )
    }

    // ── STEP 7: Executive report ─────────────────────────────────────────────
    s = elapsed()
    const opinionCitations = courtOpinions.slice(0, 4).map((op) =>
      `${op.case_name} (${op.court}${op.date_filed ? ', ' + op.date_filed : ''})`
    ).join('; ') || 'None retrieved'

    const vectorSummary = vectorSearchResults.length > 0
      ? `Atlas $vectorSearch retrieved ${finalVectorMatchesPost} historical matches across ${finalCasesWithMatchesPost} cases (index: description_embedding_index). Top outcomes: ${[...new Set(vectorSearchResults.map(r => r.top_outcome).filter(Boolean))].join(', ')}.`
      : 'Historical case database returned no matches for current caseload.'

    // Challenge review feeds into the executive report — making it execution-changing,
    // not merely informational. The self-critique's uncertainty and missing evidence
    // inform the risk assessment paragraph in the final report.
    const challengeContext = challengeReview && !challengeReview.fallback_used
      ? `QUALITY REVIEW (model self-critique): most uncertain recommendation is "${challengeReview.most_uncertain_case}" — ${challengeReview.uncertainty_reason}. Missing evidence: ${challengeReview.missing_evidence?.join('; ') || 'none identified'}. Overall confidence: ${challengeReview.confidence_assessment}. Follow-up needed: ${challengeReview.recommended_follow_up}.`
      : ''

    const reportPrompt = `DOCKET: ${cases.length} cases · ${criticalCases.length} critical (≤3d) · ${urgentCases.length} urgent (≤7d) · ${withMissingDocs.length} docs missing (${docGapRatePct}%) · ${recommendations.length} recommendations · ${courtOpinions.length} precedents · ${finalVectorMatchesPost} historical matches${adaptiveSearchTriggered ? ' (includes adaptive search results)' : ''}
STRATEGY: ${modelDecision?.strategy || 'standard'} · escalation: ${modelDecision?.escalation_level || 'routine'}
TOP CASES: ${priorityQueue.slice(0, 5).map((c, i) => `${i + 1}. ${c.client_name || 'Unknown'} (${c.case_type}, ${c.deadline_days != null ? c.deadline_days + 'd' : '?'}, score ${c.priority_score ?? '?'})`).join(' | ')}
${courtOpinions.length > 0 ? `PRECEDENTS: ${opinionCitations}` : ''}
${finalVectorMatchesPost > 0 ? `HISTORICAL: ${vectorSummary}` : ''}
${challengeContext}

Write a concise 3-paragraph executive docket report:
P1: Current docket status and risk assessment${challengeReview && !challengeReview.fallback_used ? ` — address the identified uncertainty around "${challengeReview.most_uncertain_case}"` : ''}
P2: Critical matters requiring immediate attorney action
P3: Operational recommendations for tomorrow
Authoritative, formal, specific, actionable. No boilerplate.`

    let executiveReport = ''
    try {
      executiveReport = await callGeminiPro(reportPrompt)
    } catch {
      executiveReport = `Docket analysis complete. ${cases.length} cases active. ${criticalCases.length > 0 ? `${criticalCases.length} cases have deadlines within 72 hours and require immediate attorney assignment.` : 'No cases have critical 72-hour deadlines.'} ${urgentCases.length} cases fall within the 7-day urgency threshold. ${withMissingDocs.length} cases have documentation gaps. ${finalVectorMatchesPost > 0 ? `Atlas $vectorSearch retrieved ${finalVectorMatchesPost} historical matches to inform recommendations${adaptiveSearchTriggered ? ' (adaptive search triggered)' : ''}.` : ''} ${recommendations.length} specific recommended actions have been prepared.`
    }
    steps.push(makeStep('executive_report', "Compile executive docket report for tomorrow's operations", 'Gemini Pro',
      s, elapsed() - s, { report_length: executiveReport.length, word_count: executiveReport.split(/\s+/).length }))

    // ── Derive reasoning summary from real data ──────────────────────────────
    const fileCompleteRate  = Math.round(((cases.length - withMissingDocs.length) / cases.length) * 100)
    const totalHighPriority = criticalCases.length + urgentCases.length

    const priorityFactors = [
      criticalCases.length > 0
        ? `${criticalCases.length} case${criticalCases.length > 1 ? 's' : ''} with court deadlines within 72 hours`
        : null,
      urgentCases.length > criticalCases.length
        ? `${urgentCases.length - criticalCases.length} additional case${(urgentCases.length - criticalCases.length) > 1 ? 's' : ''} inside 7-day urgency window`
        : null,
      highScoreCases.length > urgentCases.length
        ? `${highScoreCases.length - urgentCases.length} high-vulnerability matter${(highScoreCases.length - urgentCases.length) > 1 ? 's' : ''} with composite score ≥75`
        : null,
      withMissingDocs.length > 0
        ? `${withMissingDocs.length} file${withMissingDocs.length > 1 ? 's' : ''} blocked by incomplete documentation`
        : null,
    ].filter(Boolean)

    const reasoning_summary = {
      prioritization_rationale: totalHighPriority > 0
        ? `${totalHighPriority} of ${cases.length} case${cases.length !== 1 ? 's' : ''} identified as high priority for tomorrow's docket. Primary factors: ${priorityFactors.join('; ')}.`
        : `${cases.length} cases reviewed — no critical deadline conflicts detected. Docket is in stable condition.`,

      key_patterns: [
        cases.length > 0
          ? `${Math.round((criticalCases.length / cases.length) * 100)}% of active caseload meets the critical threshold requiring same-day attorney attention`
          : null,
        finalCasesWithMatches > 0
          ? `Atlas $vectorSearch returned ${finalVectorMatchesPost} historical match${finalVectorMatchesPost !== 1 ? 'es' : ''} across ${finalCasesWithMatchesPost} case${finalCasesWithMatchesPost !== 1 ? 's' : ''} (index: description_embedding_index${adaptiveSearchTriggered ? ', adaptive scope triggered' : ''})`
          : 'No historical matches returned from Atlas $vectorSearch — past_cases collection may need seeding',
        withMissingDocs.length > 0
          ? `Documentation gaps in ${docGapRatePct}% of caseload${highDocGapRate ? ' — remediation branch activated' : ''}`
          : null,
        courtOpinions.length > 0
          ? `${courtOpinions.length} legal precedents retrieved from CourtListener (${runCourtListener ? 'tool selection included CourtListener' : 'skipped by tool selection'})`
          : !runCourtListener
            ? 'CourtListener skipped by tool selection — no urgent cases (branching decision logged)'
            : null,
        recommendations.filter((r) => r.priority === 'critical').length > 0
          ? `${recommendations.filter((r) => r.priority === 'critical').length} recommendation${recommendations.filter((r) => r.priority === 'critical').length !== 1 ? 's' : ''} escalated for mandatory attorney review before action`
          : null,
      ].filter(Boolean),

      historical_findings: finalCasesWithMatches > 0
        ? `Atlas $vectorSearch (index: description_embedding_index, collection: past_cases) retrieved ${finalVectorMatchesPost} historical case match${finalVectorMatchesPost !== 1 ? 'es' : ''} across ${finalCasesWithMatchesPost} case${finalCasesWithMatchesPost !== 1 ? 's' : ''}. Top cosine similarity: ${topSimilarity !== null ? (topSimilarity * 100).toFixed(1) + '%' : 'n/a'}. Observed outcomes: ${[...new Set(vectorSearchResults.map(r => r.top_outcome).filter(Boolean))].join(', ')}.${adaptiveSearchTriggered ? ' Adaptive broad search was triggered after model evaluated initial results as insufficient.' : ''}`
        : `Atlas $vectorSearch executed against description_embedding_index but returned no matches (via: ${searchVia}). Recommendations rely on deadline analysis, vulnerability scoring, and documentation review. To enable historical retrieval: (1) set GOOGLE_CLOUD_PROJECT_ID and Vertex AI credentials, (2) create description_embedding_index on past_cases collection (768-dim), (3) run POST /api/seed/past-cases.`,

      confidence_assessment: `High confidence in deadline-based prioritization (objective court date records). Moderate confidence in vulnerability scoring (${fileCompleteRate}% of files are complete). ${finalCasesWithMatchesPost > 0 ? `Historical context from Atlas $vectorSearch (${finalVectorMatchesPost} matches at up to ${topSimilarity !== null ? (topSimilarity * 100).toFixed(0) + '%' : 'n/a'} similarity) incorporated into recommendations.${adaptiveSearchTriggered ? ' Adaptive search expanded scope.' : ''}` : 'No historical context available.'} All recommendations must be reviewed by a supervising attorney before action is taken.`,
    }

    // ── STEP 8: Persist trace ─────────────────────────────────────────────────
    s = elapsed()
    const actionItems = recommendations.map((r, i) => ({
      rank:             i + 1,
      client_name:      r.client_name,
      case_type:        r.case_type,
      priority:         r.priority,
      action:           r.action,
      rationale:        r.rationale,
      deadline_warning: r.deadline_warning,
      authorization_required: r.authorization_required ?? false,
      authorization_reason:   r.authorization_reason ?? null,
      risk_assessment:        r.risk_assessment ?? null,
      oversight_confidence:   r.oversight_confidence ?? null,
      challenged_by_review:   r.challenged_by_review ?? false,
      challenge_follow_up:    r.challenge_follow_up ?? null,
      challenge_missing_evidence: r.challenge_missing_evidence ?? [],
    }))

    const totalMs = elapsed()
    await AgentRun.findOneAndUpdate(
      { run_id: runId },
      {
        $set: {
          status:        'complete',
          completed_at:  new Date(),
          duration_ms:   totalMs,
          steps,
          decisions,
          model_decision: modelDecision,
          agent_plan:     agentPlan,
          adapted_plan:   adaptedPlan,
          result: {
            cases_reviewed:        cases.length,
            critical_cases:        criticalCases.length,
            urgent_cases:          urgentCases.length,
            missing_documents:     withMissingDocs.length,
            recommendations_count: recommendations.length,
            court_opinions_count:  courtOpinions.length,
            recommendations,
            court_opinions:        courtOpinions,
            executive_report:      executiveReport,
            action_items:          actionItems,
            vector_search_results: vectorSearchResults,
            // Model-directed execution decisions
            tool_selection:       toolSelection,
            case_selection:       caseSelection,
            evidence_sufficiency: evidenceSufficiency,
            challenge_review:     challengeReview,
            reasoning_summary,
          },
        },
      }
    )

    steps.push(makeStep('persist', 'Persist trace, model decision, adapted plan, and vector results to MongoDB Atlas', 'MongoDB Atlas',
      s, elapsed() - s, {
        documents_written:     1,
        steps_recorded:        steps.length,
        decisions_logged:      decisions.length,
        vector_results_stored:    vectorSearchResults.length,
        adaptive_search_triggered: adaptiveSearchTriggered,
        action_items:             actionItems.length,
        model_decision_stored:    true,
        adapted_plan_steps:       adaptedPlan.length,
      }))

    // ── Cloud Logging + Cloud Monitoring: fire-and-forget telemetry ─────────────
    // Cloud Logging: structured run log (GCP Console → Log Explorer → justicequeue.agent)
    // Cloud Monitoring: time series metrics (GCP Console → Monitoring → Metrics Explorer)
    recordDocketMetrics({
      duration_ms:               totalMs,
      cases_reviewed:            cases.length,
      critical_cases:            criticalCases.length,
      vector_matches:            finalVectorMatchesPost,
      recommendations:           recommendations.length,
      decisions_logged:          decisions.length,
      adaptive_search_triggered: adaptiveSearchTriggered,
      model_strategy:            modelDecision?.strategy,
    })

    logToCloud({
      event:               'docket_run_complete',
      run_id:              runId,
      uid_hash:            decoded.uid.slice(0, 8),  // partial UID for privacy
      duration_ms:         totalMs,
      cases_reviewed:      cases.length,
      critical_cases:      criticalCases.length,
      urgent_cases:        urgentCases.length,
      model_strategy:      modelDecision?.strategy ?? 'unknown',
      model_fallback:      modelDecisionFallback,
      precedent_research:  modelDecision?.precedent_research ?? false,
      vector_matches:            finalVectorMatchesPost,
      vector_via:                searchVia,
      adaptive_search_triggered: adaptiveSearchTriggered,
      court_opinions:      courtOpinions.length,
      recommendations:     recommendations.length,
      decisions_logged:    decisions.length,
    })

    return Response.json({
      run_id:      runId,
      status:      'complete',
      duration_ms: totalMs,
      summary: {
        cases_reviewed:     cases.length,
        critical_cases:     criticalCases.length,
        urgent_cases:       urgentCases.length,
        recommendations:    recommendations.length,
        court_opinions:     courtOpinions.length,
        missing_documents:  withMissingDocs.length,
        vector_matches:     realVectorMatches,
        decisions_made:     decisions.length,
        model_strategy:     modelDecision?.strategy,
      },
    })

  } catch (err) {
    console.error('[agent/docket POST]', err.message)
    const totalMs = elapsed()
    await AgentRun.findOneAndUpdate(
      { run_id: runId },
      { $set: { status: 'error', error: err.message, completed_at: new Date(), duration_ms: totalMs } }
    ).catch(() => {})
    return apiError('Agent run failed', 500)
  }
}
