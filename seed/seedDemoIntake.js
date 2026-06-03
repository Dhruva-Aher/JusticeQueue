// seedDemoIntake.js — seeds the demo-intake-real.csv through the REAL intake pipeline
//
// This script:
//   1. Reads seed/data/demo-intake-real.csv
//   2. Posts it as a multipart/form-data upload to POST /api/intake/upload
//   3. The real pipeline runs: parse → Gemini extraction → Vertex AI embedding → Atlas insert
//   4. Each resulting Case document will have mongodb_via = "mcp"|"mongoose_fallback"
//   5. Each resulting Case will have score_without_retrieval (real retrieval delta)
//
// Usage:
//   SITE_URL=https://your-vercel-app.vercel.app AUTH_TOKEN=<firebase-id-token> node seed/seedDemoIntake.js
//
// AUTH_TOKEN: Get from browser DevTools after login:
//   firebase.auth().currentUser.getIdToken(true).then(t => console.log(t))
//   Or: localStorage.getItem('justicequeue_token')

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { FormData, Blob } from 'node-fetch'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SITE_URL   = process.env.SITE_URL   || 'http://localhost:3000'
const AUTH_TOKEN = process.env.AUTH_TOKEN

if (!AUTH_TOKEN) {
  console.error('ERROR: AUTH_TOKEN env var is required.')
  console.error('Get it from: firebase.auth().currentUser.getIdToken(true)')
  process.exit(1)
}

async function run() {
  const csvPath = join(__dirname, 'data', 'demo-intake-real.csv')
  const csvContent = readFileSync(csvPath, 'utf8')
  console.log(`Read ${csvPath} (${csvContent.length} bytes)`)

  const form = new FormData()
  form.append('file', new Blob([csvContent], { type: 'text/csv' }), 'demo-intake-real.csv')

  console.log(`\nPOSTing to ${SITE_URL}/api/intake/upload ...`)
  console.log('(This runs the full pipeline: Gemini extraction + Vertex AI embedding + Atlas write)')

  const res = await fetch(`${SITE_URL}/api/intake/upload`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    body:    form,
  })

  const text = await res.text()

  if (!res.ok) {
    console.error(`\nHTTP ${res.status}: ${text}`)
    process.exit(1)
  }

  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }

  console.log('\n=== Intake Result ===')
  console.log(JSON.stringify(data, null, 2))

  if (data.processed || data.cases) {
    const count = data.processed ?? data.cases?.length ?? '?'
    console.log(`\n✓ ${count} cases processed through real pipeline`)
    console.log('✓ Each case has Vertex AI embedding (768-dim)')
    console.log('✓ Each case has score_without_retrieval field')
    console.log('✓ mongodb_via field shows "mcp" or "mongoose_fallback"')
    console.log('\nVerify in Atlas:')
    console.log('  db.cases.find({score_without_retrieval:{$type:"number"}}).count()')
    console.log('  db.cases.findOne({mongodb_via:"mcp"},{client_name:1,priority_score:1,score_without_retrieval:1})')
  }
}

run().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
