#!/usr/bin/env node
// scripts/buildCourtListenerCorpus.js
//
// Builds a real historical case corpus from CourtListener public legal opinions.
// Outputs seed/data/past_cases_real.json — 60 cases across 6 practice areas,
// each with a normalized description and classified outcome.
//
// Requirements:
//   GEMINI_MODEL_FLASH env var (for outcome classification)
//   GOOGLE_CLOUD_PROJECT_ID + OAuth creds (for Gemini Flash calls)
//   No additional API keys — CourtListener is public
//
// Usage:
//   GEMINI_MODEL_FLASH=... GOOGLE_CLOUD_PROJECT_ID=... \
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
//   GOOGLE_OAUTH_REFRESH_TOKEN=... \
//   node scripts/buildCourtListenerCorpus.js
//
// Output:
//   seed/data/past_cases_real.json (60 real cases with descriptions and outcomes)
//
// After running, update /api/seed/past-cases/route.js to import past_cases_real.json
// OR use this as a drop-in replacement by copying to past_cases.json.
//
// Attribution: All cases sourced from CourtListener (courtlistener.com),
// a project of the Free Law Project (nonprofit). Public domain data.

import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── CourtListener queries per practice area ───────────────────────────────────
const QUERIES = {
  eviction:          { q: 'tenant eviction unlawful detainer housing emergency relief', area: 'eviction' },
  immigration:       { q: 'immigration asylum removal deportation emergency stay', area: 'immigration' },
  custody:           { q: 'child custody emergency protective order modification', area: 'custody' },
  wage_theft:        { q: 'wage theft unpaid wages labor overtime restitution', area: 'wage_theft' },
  domestic_violence: { q: 'domestic violence protective restraining order emergency', area: 'domestic_violence' },
  employment:        { q: 'wrongful termination employment discrimination retaliation reinstatement', area: 'employment' },
}

const COURTLISTENER_BASE = 'https://www.courtlistener.com/api/rest/v4/search'

// ── Gemini Flash for outcome classification ───────────────────────────────────
// Uses the same OAuth flow as the main application
let _cachedToken = null
let _tokenExpiry = 0

async function getAccessToken() {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiry - 60000) return _cachedToken
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

async function classifyOpinionOutcome(caseName, snippet, court) {
  const modelId   = process.env.GEMINI_MODEL_FLASH
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  if (!modelId || !projectId) return { outcome: 'settled', outcome_notes: snippet?.slice(0, 200) || caseName }

  try {
    const token = await getAccessToken()
    const prompt = `Case: ${caseName} | Court: ${court}
Snippet: ${(snippet || '').slice(0, 400)}

Based on this court opinion excerpt, classify the legal outcome for the party seeking relief and extract a normalized description.

Return JSON only:
{
  "outcome": "won"|"settled"|"declined",
  "outcome_notes": "1 sentence describing what happened (from the seeking-relief party perspective)",
  "description": "2-3 sentence neutral description of the legal matter suitable for case matching (intake intake format, no case name, no court name)"
}`

    const res = await fetch(
      `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${modelId}:generateContent`,
      {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Classify legal case outcomes. Return JSON only, no markdown.' }] },
          contents:          [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    )
    const data   = await res.json()
    const text   = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
    return {
      outcome:       ['won', 'settled', 'declined'].includes(parsed.outcome) ? parsed.outcome : 'settled',
      outcome_notes: parsed.outcome_notes || snippet?.slice(0, 200) || '',
      description:   parsed.description  || `${caseName}: ${snippet?.slice(0, 200) || ''}`,
    }
  } catch {
    // Fallback: use raw snippet
    return {
      outcome:       'settled',
      outcome_notes: snippet?.slice(0, 200) || caseName,
      description:   `Legal matter in ${court}: ${snippet?.slice(0, 200) || ''}`,
    }
  }
}

// ── Fetch opinions from CourtListener ────────────────────────────────────────
async function fetchOpinions(query, area, limit = 10) {
  const url = `${COURTLISTENER_BASE}/?q=${encodeURIComponent(query)}&type=o&order_by=score+desc&page_size=${limit}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'JusticeQueue/1.0 (legal-aid-triage corpus builder; contact via GitHub)' },
  })
  if (!res.ok) {
    console.error(`CourtListener error for ${area}: HTTP ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.results || []).map((op) => ({
    case_name: op.caseName || op.case_name || 'Unknown',
    court:     op.court    || op.court_id  || 'Unknown court',
    date:      op.dateFiled || op.date_filed || null,
    snippet:   typeof op.snippet === 'string' ? op.snippet.replace(/<[^>]+>/g, '').slice(0, 500) : null,
    url:       op.absolute_url ? `https://www.courtlistener.com${op.absolute_url}` : null,
    area,
  }))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Building CourtListener corpus...')
  console.log('Querying CourtListener public API (no authentication required)')
  console.log('')

  const allCases = []

  for (const [area, { q }] of Object.entries(QUERIES)) {
    process.stdout.write(`  Fetching ${area}... `)
    const opinions = await fetchOpinions(q, area, 10)
    console.log(`${opinions.length} opinions retrieved`)

    for (const op of opinions.slice(0, 10)) {
      process.stdout.write(`    Classifying: ${op.case_name.slice(0, 60)}... `)
      const classified = await classifyOpinionOutcome(op.case_name, op.snippet, op.court)
      allCases.push({
        case_type:     area,
        description:   classified.description,
        outcome:       classified.outcome,
        outcome_notes: classified.outcome_notes,
        year:          op.date ? new Date(op.date).getFullYear() : new Date().getFullYear(),
        source:        'courtlistener',
        source_url:    op.url,
        attribution:   'CourtListener / Free Law Project (courtlistener.com)',
      })
      process.stdout.write(`${classified.outcome}\n`)
      // Rate-limit: avoid hammering Gemini
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  const outPath = join(__dirname, '..', 'seed', 'data', 'past_cases_real.json')
  writeFileSync(outPath, JSON.stringify(allCases, null, 2), 'utf8')

  console.log('')
  console.log(`✓ Wrote ${allCases.length} real cases to seed/data/past_cases_real.json`)
  console.log('')
  console.log('Outcome distribution:')
  const dist = { won: 0, settled: 0, declined: 0 }
  allCases.forEach((c) => { dist[c.outcome] = (dist[c.outcome] || 0) + 1 })
  Object.entries(dist).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  console.log('')
  console.log('Next steps:')
  console.log('  1. Review seed/data/past_cases_real.json')
  console.log('  2. Copy to seed/data/past_cases.json (replaces synthetic data)')
  console.log('  3. Run: POST /api/seed/past-cases to regenerate embeddings')
  console.log('')
  console.log('Attribution: All cases sourced from CourtListener (courtlistener.com),')
  console.log('a project of the Free Law Project. Public domain legal data.')
}

main().catch((err) => {
  console.error('Corpus build failed:', err.message)
  process.exit(1)
})
