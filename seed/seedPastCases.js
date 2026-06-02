// Standalone seed script — inserts 30 past_cases with Vertex AI text-embedding-004 embeddings
// Replaces the previous Voyage AI implementation.
// Requires the same GCP OAuth credentials used by the main application:
//   MONGODB_URI, GOOGLE_CLOUD_PROJECT_ID, GOOGLE_OAUTH_CLIENT_ID,
//   GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
//
// The Atlas vector search index must use numDimensions: 768 (text-embedding-004 output).
// If you previously ran this script with Voyage AI (1024-dim), delete the old index and
// recreate it with numDimensions: 768 before running.
import 'dotenv/config'
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const EMBEDDING_MODEL      = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768

// ── OAuth token (same as main application) ───────────────────────────────────
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
  if (!data.access_token) throw new Error(`OAuth token refresh failed: ${data.error} — ${data.error_description ?? ''}`)
  _cachedToken = data.access_token
  _tokenExpiry = now + (data.expires_in ?? 3600) * 1000
  return _cachedToken
}

async function getEmbedding(text) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID is not set')

  const token = await getAccessToken()

  const response = await fetch(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${EMBEDDING_MODEL}:predict`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        instances:  [{ content: text.slice(0, 2048) }],
        parameters: { outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vertex AI embedding error ${response.status}: ${body}`)
  }

  const data   = await response.json()
  const values = data?.predictions?.[0]?.embeddings?.values
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dim vector, got ${values?.length ?? 'null'}`)
  }
  return values
}

async function seed() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set in environment')

  console.log('Connecting to MongoDB...')
  await mongoose.connect(uri)
  const db = mongoose.connection.db

  const collection = db.collection('past_cases')
  const existing = await collection.countDocuments()

  if (existing >= 30) {
    console.log(`Skipping seed — past_cases already has ${existing} documents.`)
    console.log('To reseed: drop the collection manually, then re-run this script.')
    await mongoose.disconnect()
    return
  }

  const rawData = readFileSync(join(__dirname, 'data', 'past_cases.json'), 'utf8')
  const cases = JSON.parse(rawData)

  console.log(`Generating Vertex AI text-embedding-004 embeddings for ${cases.length} cases...`)
  const casesWithEmbeddings = []

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    // Use description only — matches the query strategy in lib/vectorSearch.js
    const textToEmbed = (c.description || '').trim()
    try {
      const embedding = await getEmbedding(textToEmbed)
      casesWithEmbeddings.push({ ...c, description_embedding: embedding })
      process.stdout.write(`\r  ${i + 1}/${cases.length} embeddings generated`)
    } catch (err) {
      console.warn(`\nSkipping case ${i + 1} — embedding failed: ${err.message}`)
      casesWithEmbeddings.push(c)  // insert without embedding, $vectorSearch will skip it
    }
  }
  console.log('\nEmbeddings complete.')

  console.log(`Inserting ${casesWithEmbeddings.length} past cases...`)
  await collection.deleteMany({})
  await collection.insertMany(casesWithEmbeddings)
  console.log('Documents inserted.')

  console.log('Checking vector search index...')
  try {
    const indexes = await collection.listSearchIndexes().toArray()
    const indexExists = indexes.some((idx) => idx.name === 'description_embedding_index')

    if (!indexExists) {
      console.log('Creating vector search index (768 dimensions, cosine)...')
      await collection.createSearchIndex({
        name: 'description_embedding_index',
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type:          'vector',
              path:          'description_embedding',
              numDimensions: 768,   // text-embedding-004 output dimensions
              similarity:    'cosine',
            },
          ],
        },
      })
      console.log('Vector search index created. Atlas will build it in the background (~1-2 min).')
    } else {
      console.log('Vector search index already exists.')
      console.log('NOTE: If you see dimension mismatch errors, delete and recreate the index with numDimensions: 768.')
    }
  } catch (err) {
    console.warn('Could not manage vector search index (requires Atlas M10+):', err.message)
  }

  console.log(`\nDone. ${casesWithEmbeddings.length} past cases seeded with Vertex AI text-embedding-004 embeddings (${EMBEDDING_DIMENSIONS} dimensions).`)
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
