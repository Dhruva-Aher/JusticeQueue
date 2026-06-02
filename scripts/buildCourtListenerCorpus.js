#!/usr/bin/env node
// scripts/buildCourtListenerCorpus.js
//
// Builds a real historical case corpus from CourtListener public legal opinions.
// Outputs:
//   seed/data/past_cases_real.json        — 60 cases with validated records
//   seed/data/past_cases_real_report.json — quality validation report
//
// Rules:
//   - If Gemini cannot determine outcome from a snippet: outcome = "unknown"
//   - Never fabricate outcomes
//   - Every record includes source, source_url, year, normalized_outcome
//   - Validation runs after generation: duplicates, malformed, missing URLs, distribution
//
// Requirements:
//   GEMINI_MODEL_FLASH + GOOGLE_CLOUD_PROJECT_ID + OAuth credentials
//   No additional API keys — CourtListener is public (no auth required)
//
// Usage:
//   node scripts/buildCourtListenerCorpus.js
//
// Attribution: All cases sourced from CourtListener (courtlistener.com),
//   a project of the Free Law Project (nonprofit). Public domain data.

import { writeFileSync, readFileSync } from 'fs'
import { dirname, join }               from 'path'
import { fileURLToPath }               from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── CourtListener queries per practice area ───────────────────────────────────
const QUERIES = {
  eviction:          'tenant eviction unlawful detainer housing emergency relief',
  immigration:       'immigration asylum removal deportation emergency stay',
  custody:           'child custody emergency protective order modification',
  wage_theft:        'wage theft unpaid wages labor overtime restitution',
  domestic_violence: 'domestic violence protective restraining order emergency',
  employment:        'wrongful termination employment discrimination retaliation reinstatement',
}

const COURTLISTENER_BASE = 'https://www.courtlistener.com/api/rest/v4/search'
const CASES_PER_AREA     = 10
const RATE_LIMIT_MS      = 350  // ms between Gemini calls

// ── OAuth (same flow as main application) ────────────────────────────────────
let _cachedToken = null
let _tokenExpiry = 0

async function getAccessToken() {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiry - 60_000) return _cachedToken
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth failed: ${data.error}`)
  _cachedToken = data.access_token
  _tokenExpiry = now + (data.expires_in ?? 3600) * 1000
  return _cachedToken
}

// ── Gemini Flash: classify outcome and extract normalized description ─────────
// Returns outcome: "won" | "settled" | "declined" | "unknown"
// "unknown" is used when the snippet does not contain enough information to
// confidently classify the outcome. Never fabricate.
async function classifyOpinionOutcome(caseName, snippet, court) {
  const modelId   = process.env.GEMINI_MODEL_FLASH
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID

  if (!modelId || !projectId) {
    return {
      outcome:          'unknown',
      outcome_notes:    snippet?.slice(0, 200) || caseName,
      description:      `Legal matter: ${snippet?.slice(0, 200) || caseName}`,
      classification_method: 'no-model',
    }
  }

  try {
    const token = await getAccessToken()
    const prompt = `Case: ${caseName} | Court: ${court}
Snippet: ${(snippet || '').slice(0, 500)}

Task 1 — OUTCOME CLASSIFICATION:
Based ONLY on the snippet above, classify the outcome for the party seeking legal relief.
Rules:
  - "won":      party seeking relief obtained the requested order/judgment/relief
  - "settled":  case resolved by agreement, consent decree, or negotiated outcome
  - "declined": court denied the relief requested, dismissed the case, or ruled against petitioner
  - "unknown":  snippet does not contain sufficient information to determine the outcome with confidence

IMPORTANT: If you are not confident, choose "unknown". Do not fabricate.

Task 2 — DESCRIPTION EXTRACTION:
Write a 2-3 sentence neutral description of the legal matter suitable for similarity matching.
Format: intake case summary style (no case name, no court name, no dates, describe the fact pattern).

Return JSON only:
{
  "outcome": "won" | "settled" | "declined" | "unknown",
  "outcome_confidence": "high" | "medium" | "low",
  "outcome_notes": "1 sentence from seeking-relief party perspective, or null if unknown",
  "description": "2-3 sentence fact pattern description"
}`

    const res = await fetch(
      `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelId}:generateContent`,
      {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Classify legal outcomes. Return JSON only. Use "unknown" when unsure. Never fabricate.' }] },
          contents:          [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(12000),
      }
    )

    const data   = await res.json()
    const text   = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')

    const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    const validOutcomes = ['won', 'settled', 'declined', 'unknown']

    return {
      outcome:               validOutcomes.includes(parsed.outcome) ? parsed.outcome : 'unknown',
      outcome_confidence:    parsed.outcome_confidence || 'low',
      outcome_notes:         parsed.outcome_notes || null,
      description:           parsed.description   || `Legal matter: ${snippet?.slice(0, 200) || caseName}`,
      classification_method: 'gemini-flash',
    }
  } catch (err) {
    // Gemini call failed — mark as unknown, never fabricate
    return {
      outcome:               'unknown',
      outcome_notes:         null,
      description:           `Legal matter: ${snippet?.slice(0, 200) || caseName}`,
      classification_method: 'error',
      classification_error:  err.message,
    }
  }
}

// ── Fetch opinions from CourtListener ────────────────────────────────────────
async function fetchOpinions(area, query, limit) {
  const url = `${COURTLISTENER_BASE}/?q=${encodeURIComponent(query)}&type=o&order_by=score+desc&page_size=${limit}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'JusticeQueue/1.0 corpus-builder (legal-aid-triage; contact via GitHub)' },
  })
  if (!res.ok) {
    console.error(`  ✗ CourtListener error for ${area}: HTTP ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.results || []).map((op) => ({
    case_name: op.caseName || op.case_name || 'Unknown',
    court:     op.court    || op.court_id  || 'Unknown court',
    date:      op.dateFiled || op.date_filed || null,
    snippet:   typeof op.snippet === 'string' ? op.snippet.replace(/<[^>]+>/g, '').slice(0, 600) : null,
    url:       op.absolute_url ? `https://www.courtlistener.com${op.absolute_url}` : null,
  }))
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateCorpus(cases) {
  const issues   = []
  const warnings = []

  // 1. Duplicate detection (exact description match)
  const descriptionsSeen = new Map()
  cases.forEach((c, i) => {
    const key = c.description?.slice(0, 100)?.toLowerCase()
    if (key && descriptionsSeen.has(key)) {
      issues.push({ type: 'duplicate', index: i, detail: `Description matches index ${descriptionsSeen.get(key)}` })
    } else if (key) {
      descriptionsSeen.set(key, i)
    }
  })

  // 2. Missing required fields
  cases.forEach((c, i) => {
    if (!c.description || c.description.length < 30) {
      issues.push({ type: 'malformed_description', index: i, detail: `Description too short (${c.description?.length ?? 0} chars)` })
    }
    if (!c.source_url) {
      warnings.push({ type: 'missing_url', index: i, detail: `No CourtListener URL for ${c.case_type}` })
    }
    if (!c.year || c.year < 1990 || c.year > new Date().getFullYear() + 1) {
      warnings.push({ type: 'suspicious_year', index: i, detail: `Year ${c.year} is unusual` })
    }
    if (!['won', 'settled', 'declined', 'unknown'].includes(c.outcome)) {
      issues.push({ type: 'invalid_outcome', index: i, detail: `Outcome "${c.outcome}" is not a valid enum value` })
    }
  })

  // 3. Category distribution
  const catCounts = {}
  cases.forEach((c) => { catCounts[c.case_type] = (catCounts[c.case_type] || 0) + 1 })
  Object.keys(QUERIES).forEach((area) => {
    if (!catCounts[area] || catCounts[area] < 5) {
      warnings.push({ type: 'sparse_category', area, detail: `Only ${catCounts[area] || 0} cases for ${area} (target: ${CASES_PER_AREA})` })
    }
  })

  // 4. Outcome distribution
  const outcomeCounts = {}
  cases.forEach((c) => { outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] || 0) + 1 })
  const unknownPct = (outcomeCounts.unknown || 0) / cases.length
  if (unknownPct > 0.30) {
    warnings.push({ type: 'high_unknown_rate', detail: `${(unknownPct * 100).toFixed(1)}% of cases have unknown outcome — consider re-running or manual review` })
  }

  return {
    total:             cases.length,
    passed:            issues.length === 0,
    issue_count:       issues.length,
    warning_count:     warnings.length,
    issues,
    warnings,
    category_distribution: catCounts,
    outcome_distribution:  outcomeCounts,
    unknown_rate_pct:      +(unknownPct * 100).toFixed(1),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== JusticeQueue CourtListener Corpus Builder ===')
  console.log('Source: CourtListener public API (no auth required)')
  console.log('Attribution: Free Law Project (courtlistener.com)')
  console.log('')

  const allCases = []
  const fetchErrors = []

  for (const [area, query] of Object.entries(QUERIES)) {
    process.stdout.write(`  [${area}] Fetching ${CASES_PER_AREA} opinions... `)
    const opinions = await fetchOpinions(area, query, CASES_PER_AREA)
    console.log(`${opinions.length} retrieved`)

    let areaCount = 0
    for (const op of opinions) {
      if (areaCount >= CASES_PER_AREA) break

      process.stdout.write(`    → ${op.case_name.slice(0, 55).padEnd(55)} `)
      const classified = await classifyOpinionOutcome(op.case_name, op.snippet, op.court)

      allCases.push({
        case_type:             area,
        description:           classified.description,
        outcome:               classified.outcome,         // "won"|"settled"|"declined"|"unknown"
        outcome_notes:         classified.outcome_notes,
        outcome_confidence:    classified.outcome_confidence,
        year:                  op.date ? new Date(op.date).getFullYear() : null,
        source:                'courtlistener',
        source_url:            op.url,
        source_case_name:      op.case_name,
        source_court:          op.court,
        attribution:           'CourtListener / Free Law Project (courtlistener.com)',
        classification_method: classified.classification_method,
      })

      const indicator = classified.outcome === 'unknown' ? '?' : classified.outcome === 'won' ? '✓' : '~'
      console.log(`${indicator} ${classified.outcome} [${classified.outcome_confidence || '?'}]`)

      areaCount++
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
    }

    if (opinions.length < CASES_PER_AREA) {
      fetchErrors.push({ area, fetched: opinions.length, target: CASES_PER_AREA })
    }
  }

  // ── Write corpus ──────────────────────────────────────────────────────────
  const corpusPath = join(__dirname, '..', 'seed', 'data', 'past_cases_real.json')
  writeFileSync(corpusPath, JSON.stringify(allCases, null, 2), 'utf8')
  console.log(`\n✓ Wrote ${allCases.length} cases to seed/data/past_cases_real.json`)

  // ── Run validation ────────────────────────────────────────────────────────
  console.log('\n=== VALIDATION REPORT ===')
  const report = validateCorpus(allCases)
  report.fetch_errors = fetchErrors
  report.generated_at = new Date().toISOString()

  const reportPath = join(__dirname, '..', 'seed', 'data', 'past_cases_real_report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(`Status:   ${report.passed ? '✓ PASSED' : '✗ FAILED'}`)
  console.log(`Total:    ${report.total} cases`)
  console.log(`Issues:   ${report.issue_count}`)
  console.log(`Warnings: ${report.warning_count}`)
  console.log('')
  console.log('Outcome distribution:')
  Object.entries(report.outcome_distribution).forEach(([k, v]) =>
    console.log(`  ${k}: ${v} (${(v / report.total * 100).toFixed(1)}%)`)
  )
  console.log('')
  console.log('Category distribution:')
  Object.entries(report.category_distribution).forEach(([k, v]) =>
    console.log(`  ${k}: ${v}`)
  )

  if (report.issue_count > 0) {
    console.log('\nIssues (must fix before use):')
    report.issues.forEach((i) => console.log(`  ✗ [${i.type}] index ${i.index}: ${i.detail}`))
  }

  if (report.warning_count > 0) {
    console.log('\nWarnings (review before use):')
    report.warnings.forEach((w) => console.log(`  ⚠ [${w.type}] ${w.detail}`))
  }

  console.log('\n=== NEXT STEPS ===')
  if (report.issue_count > 0) {
    console.log('1. Fix issues listed above before seeding')
    console.log('2. Manually review seed/data/past_cases_real.json')
  } else {
    console.log('1. Review seed/data/past_cases_real.json for quality')
    console.log('2. Copy to seed/data/past_cases.json to replace synthetic corpus')
    console.log('3. Run: POST /api/seed/past-cases (generates Vertex AI embeddings)')
    console.log('4. Verify: GET /api/health/vector-search → status: "healthy"')
  }
  console.log('')
  console.log('Attribution: All cases sourced from CourtListener (courtlistener.com),')
  console.log('a project of the Free Law Project. Public domain data.')
}

main().catch((err) => {
  console.error('\n✗ Corpus build failed:', err.message)
  process.exit(1)
})
