// Intake agent pipeline — per-step traced workflow with four stages:
//   1. extract_facts       — Gemini (Vertex AI) extracts structured case data from raw intake text
//   2. vector_search       — Voyage AI embedding + Atlas $vectorSearch on past_cases collection
//   3. score_urgency       — deterministic urgency scoring (deadline, vulnerability, case type, precedent)
//   4. write_recommendation — Gemini (Vertex AI), only executed when score >= 80
//
// AGENT_BUILDER_ENGINE_ID is stored as trace metadata if set; it does not drive runtime behaviour.
import { extractCaseFacts } from '../gemini.js'
import { findSimilarCases } from '../vectorSearch.js'
import { computeScore } from '../urgencyScore.js'
import { writeRecommendation } from '../gemini.js'

const AGENT_BUILDER_ENGINE_ID = process.env.AGENT_BUILDER_ENGINE_ID || null

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

  // Step 2 — Vector search for similar cases (via MongoDB MCP Server or Mongoose fallback)
  const searchStep = makeStep('vector_search', { query: extracted.summary?.slice(0, 80) })
  let similarCases = []
  let mongodbVia   = 'mongoose_fallback'
  try {
    const { results, via } = await findSimilarCases(extracted.summary)
    similarCases = results
    mongodbVia   = via
    completeStep(searchStep, {
      results_found: similarCases.length,
      top_similarity: similarCases[0]?.similarity_score ?? null,
      top_outcome: similarCases[0]?.outcome ?? null,
      mongodb_via: via,
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
  let score, breakdown, reason_string, scoreWithoutRetrieval
  try {
    ;({ score, breakdown, reason_string } = computeScore(extracted, similarCases))
    // Compute baseline score without vector retrieval to show the marginal value of Atlas $vectorSearch
    ;({ score: scoreWithoutRetrieval } = computeScore(extracted, []))
    completeStep(scoreStep, {
      score,
      score_without_retrieval: scoreWithoutRetrieval,
      retrieval_impact:        score - scoreWithoutRetrieval,
      breakdown,
    })
  } catch (err) {
    failStep(scoreStep, err)
    score = 0
    scoreWithoutRetrieval = 0
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
    scoreWithoutRetrieval,
    breakdown,
    reason_string,
    recommendation,
    rawText,
    agent_trace: trace,
    mongodb_via: mongodbVia,
    mcp_config:  { server: '@mongodb-js/mongodb-mcp-server', config_file: '.mcp.json' },
    agent_builder_engine_id: AGENT_BUILDER_ENGINE_ID,
  }
}
