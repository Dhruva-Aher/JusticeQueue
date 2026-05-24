// Agent orchestrator — wraps intake pipeline with per-step tracing
import { extractCaseFacts } from '../gemini.js'
import { findSimilarCases } from '../vectorSearch.js'
import { computeScore } from '../urgencyScore.js'
import { writeRecommendation } from '../gemini.js'

function makeStep(name, input) {
  return { name, input, output: null, error: null, durationMs: null, startedAt: Date.now() }
}

function completeStep(step, output) {
  step.output = output
  step.durationMs = Date.now() - step.startedAt
  return step
}

function failStep(step, err) {
  step.error = err?.message || String(err)
  step.durationMs = Date.now() - step.startedAt
  return step
}

export async function runIntakeAgent(rawText) {
  const trace = []

  // Step 1 — Extract facts
  const extractStep = makeStep('extract_facts', { chars: rawText.length })
  let extracted
  try {
    extracted = await extractCaseFacts(rawText)
    completeStep(extractStep, {
      case_type: extracted.case_type,
      deadline_days: extracted.deadline_days,
      vulnerability_flags: extracted.vulnerability_flags,
      missing_info_count: extracted.missing_info.length,
    })
  } catch (err) {
    failStep(extractStep, err)
    extracted = {
      client_name: null,
      case_type: 'other',
      summary: 'Extraction failed.',
      deadline_days: null,
      vulnerability_flags: { minor_children: false, language_barrier: false, medical_condition: false },
      missing_info: [],
    }
  }
  trace.push(extractStep)

  // Step 2 — Vector search for similar cases
  const searchStep = makeStep('vector_search', { query: extracted.summary?.slice(0, 80) })
  let similarCases = []
  try {
    similarCases = await findSimilarCases(extracted.summary)
    completeStep(searchStep, {
      results_found: similarCases.length,
      top_similarity: similarCases[0]?.similarity_score ?? null,
      top_outcome: similarCases[0]?.outcome ?? null,
    })
  } catch (err) {
    failStep(searchStep, err)
  }
  trace.push(searchStep)

  // Step 3 — Score urgency
  const scoreStep = makeStep('score_urgency', {
    case_type: extracted.case_type,
    deadline_days: extracted.deadline_days,
  })
  let score, breakdown, reason_string
  try {
    ;({ score, breakdown, reason_string } = computeScore(extracted, similarCases))
    completeStep(scoreStep, { score, breakdown })
  } catch (err) {
    failStep(scoreStep, err)
    score = 0
    breakdown = {}
    reason_string = ''
  }
  trace.push(scoreStep)

  // Step 4 — Write recommendation (only for critical cases, score ≥ 80)
  // Threshold raised from 60→80 to keep batch processing within Vercel 60s limit
  let recommendation = ''
  if (score >= 80) {
    const recStep = makeStep('write_recommendation', { score, case_type: extracted.case_type })
    try {
      recommendation = await writeRecommendation(extracted, similarCases[0] ?? null)
      completeStep(recStep, { chars: recommendation.length })
    } catch (err) {
      failStep(recStep, err)
    }
    trace.push(recStep)
  }

  return {
    extracted,
    similarCases,
    score,
    breakdown,
    reason_string,
    recommendation,
    rawText,
    agent_trace: trace,
  }
}
