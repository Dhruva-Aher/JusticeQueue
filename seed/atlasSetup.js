// atlasSetup.js — idempotent Atlas setup script
//
// 1. Drops and recreates the vector search index (768-dim, cosine)
// 2. Verifies the index reaches READY state
// 3. Tests $vectorSearch with a synthetic query vector
//
// Usage:
//   MONGODB_URI="mongodb+srv://..." node seed/atlasSetup.js
//
// Run this BEFORE seeding past_cases, especially if migrating from
// a Voyage AI (1024-dim) or incorrect-dimension index.

import 'dotenv/config'
import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI required'); process.exit(1) }

const INDEX_NAME = 'description_embedding_index'
const COLLECTION = 'past_cases'
const DB_NAME    = 'justicequeue'
const DIMS       = 768

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function run() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  console.log('Connected to MongoDB Atlas')

  const db   = client.db(DB_NAME)
  const coll = db.collection(COLLECTION)

  // ── 1. Check existing index ────────────────────────────────────────────────
  console.log('\n[1] Checking existing search indexes...')
  const existing = await coll.listSearchIndexes().toArray()
  console.log(`Found ${existing.length} search index(es)`)

  for (const idx of existing) {
    console.log(`  - ${idx.name} | type=${idx.type} | status=${idx.status}`)
    if (idx.definition?.fields) {
      for (const f of idx.definition.fields) {
        console.log(`    field: path=${f.path} numDimensions=${f.numDimensions} similarity=${f.similarity}`)
      }
    }
  }

  // ── 2. Drop if wrong dimensions ───────────────────────────────────────────
  const vectorIdx = existing.find(i => i.name === INDEX_NAME)
  if (vectorIdx) {
    const dims = vectorIdx.definition?.fields?.[0]?.numDimensions
    if (dims !== DIMS) {
      console.log(`\n[2] Dropping index (wrong dimensions: ${dims} → need ${DIMS})...`)
      await coll.dropSearchIndex(INDEX_NAME)
      console.log('Index dropped. Waiting 5s...')
      await sleep(5000)
    } else {
      console.log(`\n[2] Index exists with correct dimensions (${DIMS}). Checking status...`)
      if (vectorIdx.status === 'READY') {
        console.log('Index is READY. Skipping recreation.')
        await verifySearch(coll)
        await client.close()
        return
      }
      console.log(`Status is ${vectorIdx.status} — waiting for READY...`)
      await waitForReady(coll)
      await verifySearch(coll)
      await client.close()
      return
    }
  }

  // ── 3. Create index ────────────────────────────────────────────────────────
  console.log(`\n[3] Creating vector search index (${DIMS}-dim, cosine)...`)
  await coll.createSearchIndex({
    name: INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [{
        type:          'vector',
        path:          'description_embedding',
        numDimensions: DIMS,
        similarity:    'cosine',
      }],
    },
  })
  console.log('Index creation submitted. Waiting for READY status (~1-3 min)...')

  // ── 4. Wait for READY ──────────────────────────────────────────────────────
  await waitForReady(coll)

  // ── 5. Test search ─────────────────────────────────────────────────────────
  await verifySearch(coll)

  await client.close()
  console.log('\nAtlas setup complete.')
}

async function waitForReady(coll, maxWaitMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const indexes = await coll.listSearchIndexes().toArray()
    const idx = indexes.find(i => i.name === INDEX_NAME)
    const status = idx?.status ?? 'NOT_FOUND'
    process.stdout.write(`\r  Status: ${status.padEnd(20)} (${Math.round((Date.now()-start)/1000)}s)`)
    if (status === 'READY') { console.log('\n✓ Index is READY'); return }
    if (status === 'FAILED') { console.error('\nIndex build FAILED'); process.exit(1) }
    await sleep(5000)
  }
  console.warn('\nTimeout waiting for index — check Atlas console manually')
}

async function verifySearch(coll) {
  console.log('\n[4] Testing $vectorSearch...')
  const docCount = await coll.countDocuments()
  console.log(`  past_cases collection: ${docCount} documents`)

  if (docCount === 0) {
    console.warn('  WARNING: Collection is empty. Run POST /api/seed/past-cases first.')
    return
  }

  // Check embedding dimensions in actual documents
  const sample = await coll.findOne({ description_embedding: { $exists: true } }, { projection: { description_embedding: 1 } })
  if (!sample) {
    console.warn('  WARNING: No documents have description_embedding field.')
    console.warn('  Run POST /api/seed/past-cases to add embeddings.')
    return
  }
  const actualDims = sample.description_embedding?.length
  console.log(`  Sample embedding dimensions: ${actualDims} (expected: ${DIMS})`)
  if (actualDims !== DIMS) {
    console.error(`  ERROR: Dimension mismatch! Documents have ${actualDims}-dim embeddings but index expects ${DIMS}.`)
    console.error('  Delete all past_cases and re-run POST /api/seed/past-cases.')
    process.exit(1)
  }

  // Test with synthetic query vector
  try {
    const queryVector = new Array(DIMS).fill(0).map(() => (Math.random() - 0.5) * 0.1)
    const results = await coll.aggregate([
      { $vectorSearch: {
        index:         INDEX_NAME,
        path:          'description_embedding',
        queryVector,
        numCandidates: 20,
        limit:         3,
      }},
      { $project: { case_type: 1, outcome: 1, score: { $meta: 'vectorSearchScore' }, _id: 0 } },
    ]).toArray()

    if (results.length > 0) {
      console.log(`  ✓ $vectorSearch returned ${results.length} results`)
      for (const r of results) {
        console.log(`    - ${r.case_type} (${r.outcome}) score=${r.score?.toFixed(4)}`)
      }
    } else {
      console.warn('  WARNING: $vectorSearch returned 0 results')
      console.warn('  Possible cause: index not yet READY, or all embeddings are zero vectors')
    }
  } catch (err) {
    console.error(`  $vectorSearch test failed: ${err.message}`)
  }
}

run().catch(err => { console.error(err.message); process.exit(1) })
