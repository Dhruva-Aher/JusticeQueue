// scripts/run-queries.js
// Runs the three verification queries directly against Atlas.
// Usage: MONGODB_URI="mongodb+srv://..." node scripts/run-queries.js
//
// Prints JSON results for:
//   1. Retrieval delta distribution (cases collection)
//   2. AgentRun via distribution (agentruns collection)
//   3. past_cases corpus stats (past_cases collection)

import { MongoClient } from 'mongodb'

const URI = process.env.MONGODB_URI
if (!URI) {
  console.error('ERROR: MONGODB_URI env var required')
  console.error('Usage: MONGODB_URI="mongodb+srv://..." node scripts/run-queries.js')
  process.exit(1)
}

async function run() {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db('justicequeue')

  console.log('\n══════════════════════════════════════════════════')
  console.log(' JusticeQueue — Atlas Verification Queries')
  console.log('══════════════════════════════════════════════════\n')

  // ── Query 1: Retrieval delta distribution ───────────────────────────────────
  console.log('── 1. Retrieval delta distribution (cases collection) ──')
  const deltaResult = await db.collection('cases').aggregate([
    {
      $match: {
        score_without_retrieval: { $type: 'number' },
        priority_score:          { $type: 'number' },
      },
    },
    {
      $project: {
        delta: { $subtract: ['$priority_score', '$score_without_retrieval'] },
      },
    },
    {
      $group: {
        _id:   null,
        min:   { $min: '$delta' },
        max:   { $max: '$delta' },
        avg:   { $avg: '$delta' },
        count: { $sum: 1 },
        zero_deltas:     { $sum: { $cond: [{ $eq: ['$delta', 0] }, 1, 0] } },
        positive_deltas: { $sum: { $cond: [{ $gt: ['$delta', 0] }, 1, 0] } },
      },
    },
  ]).toArray()

  if (deltaResult.length === 0) {
    console.log('  NO DATA — no cases have score_without_retrieval set')
    console.log('  Fix: upload intake CSV and run the agent docket\n')
  } else {
    const d = deltaResult[0]
    const avgFixed = typeof d.avg === 'number' ? d.avg.toFixed(1) : d.avg
    console.log(JSON.stringify({
      total_cases_with_scores: d.count,
      min_delta:   d.min,
      max_delta:   d.max,
      avg_delta:   parseFloat(avgFixed),
      zero_delta:  d.zero_deltas,   // retrieval left these unchanged
      positive_delta: d.positive_deltas, // retrieval improved these
    }, null, 2))

    // Verdict
    if (d.min === 0 && d.max === 0) {
      console.log('\n  ✗ BAD — min=max=0: retrieval is not influencing any scores')
      console.log('    Check: Atlas index READY? Embeddings 768-dim? past_cases populated?')
    } else if (d.min === d.max) {
      console.log('\n  ✗ BAD — min===max: all cases have identical delta (hardcoded?)')
    } else if (d.min === 0 && d.max > 0 && d.zero_deltas > 0 && d.positive_deltas > 0) {
      console.log('\n  ✓ GOOD — distribution shows retrieval sometimes increases, sometimes leaves unchanged')
    } else if (d.min > 0) {
      console.log('\n  ⚠ WARN — min>0: retrieval always increases score (threshold may be too low)')
    } else {
      console.log('\n  ✓ OK')
    }
  }

  // ── Query 2: AgentRun via distribution ─────────────────────────────────────
  console.log('\n── 2. AgentRun vector search via distribution (agentruns) ──')
  const viaResult = await db.collection('agentruns').aggregate([
    { $match: { status: 'complete' } },
    { $unwind: '$result.vector_search_results' },
    {
      $group: {
        _id:   '$result.vector_search_results.via',
        count: { $sum: 1 },
      },
    },
  ]).toArray()

  if (viaResult.length === 0) {
    console.log('  NO DATA — no completed agent runs with vector search results')
    console.log('  Fix: run the agent docket from /agent')
  } else {
    console.log(JSON.stringify(viaResult, null, 2))
    const hasMcp = viaResult.some(v => v._id === 'mcp' && v.count > 0)
    const hasMongoose = viaResult.some(v => v._id === 'mongoose_fallback')
    if (hasMcp && !hasMongoose) {
      console.log('\n  ✓ GOOD — all vector searches used MCP')
    } else if (hasMcp && hasMongoose) {
      console.log('\n  ⚠ WARN — mixed: some MCP, some mongoose_fallback')
      console.log('    MCP was active for some runs. Check MCP_SERVER_URL was set when mongoose_fallback runs occurred.')
    } else {
      console.log('\n  ✗ BAD — no MCP usage found')
      console.log('    Fix: set MCP_SERVER_URL in Vercel, redeploy, run agent again')
    }
  }

  // ── Query 3: past_cases corpus stats ───────────────────────────────────────
  console.log('\n── 3. past_cases corpus stats ──')
  const corpusResult = await db.collection('past_cases').aggregate([
    {
      $facet: {
        total:    [{ $count: 'n' }],
        has_embedding: [{ $match: { description_embedding: { $exists: true } } }, { $count: 'n' }],
        dim_check: [
          { $match: { description_embedding: { $exists: true } } },
          { $project: { dim: { $size: '$description_embedding' } } },
          { $group: { _id: '$dim', count: { $sum: 1 } } },
        ],
        by_outcome: [{ $group: { _id: '$outcome', n: { $sum: 1 } } }],
      },
    },
  ]).toArray()

  const corpus = corpusResult[0]
  const total    = corpus.total[0]?.n ?? 0
  const withEmb  = corpus.has_embedding[0]?.n ?? 0
  const dims     = corpus.dim_check
  const outcomes = corpus.by_outcome

  console.log(JSON.stringify({
    total_documents: total,
    with_embeddings: withEmb,
    without_embeddings: total - withEmb,
    dimension_distribution: dims,
    outcome_distribution:   outcomes,
  }, null, 2))

  if (total === 0) {
    console.log('\n  ✗ BAD — corpus is empty')
    console.log('    Fix: POST /api/seed/past-cases with header x-seed-confirm: yes')
  } else if (withEmb < total) {
    console.log(`\n  ⚠ WARN — ${total - withEmb} documents missing embeddings`)
    console.log('    Fix: Reseed with POST /api/seed/past-cases')
  } else if (dims.some(d => d._id !== 768)) {
    console.log('\n  ✗ BAD — wrong embedding dimensions')
    console.log('    Fix: run atlasSetup.js then reseed')
  } else {
    console.log('\n  ✓ GOOD — corpus is healthy')
  }

  console.log('\n══════════════════════════════════════════════════\n')
  await client.close()
}

run().catch(err => { console.error(err.message); process.exit(1) })
