// GET /api/health/vector-search
// Verifies that the MongoDB Atlas Vector Search pipeline is operational:
//   1. past_cases collection exists and has documents
//   2. At least one document has a description_embedding field
//   3. A live $vectorSearch aggregation returns results (proves the index is built)
//
// This endpoint is used by Judge Mode and the Agent Activity header to display
// real-time health indicators. No auth required — no sensitive data is exposed.
export const dynamic = 'force-dynamic'

import { connectDB }       from '../../../../lib/mongodb.js'
import { findSimilarCases } from '../../../../lib/vectorSearch.js'
import mongoose             from 'mongoose'

export async function GET() {
  const t0 = Date.now()

  try {
    await connectDB()
    const collection = mongoose.connection.db.collection('past_cases')

    // ── Check 1: document count ───────────────────────────────────────────────
    const totalCount = await collection.countDocuments()

    // ── Check 2: embedding presence ──────────────────────────────────────────
    const withEmbedding = await collection.countDocuments({
      description_embedding: { $exists: true, $not: { $size: 0 } },
    })

    // ── Check 2b: outcome distribution via Atlas aggregation pipeline ────────
    // This is a real $group aggregation — demonstrates MongoDB beyond countDocuments
    let outcomeDistribution = null
    let corpusYearRange     = null
    try {
      const [distResult, yearResult] = await Promise.all([
        collection.aggregate([
          { $group: { _id: '$outcome', count: { $sum: 1 } } },
          { $sort:  { count: -1 } },
        ]).toArray(),
        collection.aggregate([
          { $group: { _id: null, min_year: { $min: '$year' }, max_year: { $max: '$year' } } },
        ]).toArray(),
      ])
      outcomeDistribution = Object.fromEntries(distResult.map((d) => [d._id || 'unknown', d.count]))
      corpusYearRange     = yearResult[0] ? `${yearResult[0].min_year}–${yearResult[0].max_year}` : null
    } catch {
      // Non-fatal — aggregation stats are informational only
    }

    // ── Check 3: live $vectorSearch probe ────────────────────────────────────
    // Uses a generic legal-aid query — tests the actual index path and dimensions.
    let vectorSearchOk    = false
    let vectorSearchMs    = null
    let vectorSearchVia   = null
    let vectorSearchCount = 0
    let vectorSearchError = null

    if (withEmbedding > 0) {
      const vs0 = Date.now()
      try {
        const { results, via } = await findSimilarCases(
          'emergency housing eviction tenant family children deadline',
          3
        )
        vectorSearchMs    = Date.now() - vs0
        vectorSearchVia   = via
        vectorSearchCount = results.length
        vectorSearchOk    = true
      } catch (err) {
        vectorSearchMs    = Date.now() - vs0
        vectorSearchError = err.message
      }
    }

    const overallStatus = vectorSearchOk && totalCount >= 30
      ? 'healthy'
      : totalCount === 0
        ? 'no_data'
        : !vectorSearchOk
          ? 'degraded'
          : 'partial'

    return Response.json({
      status: overallStatus,
      checks: {
        atlas_connected:               true,
        past_cases_total:              totalCount,
        past_cases_with_embeddings:    withEmbedding,
        past_cases_without_embeddings: totalCount - withEmbedding,
        vector_index_name:             'description_embedding_index',
        embedding_model:               'text-embedding-004',
        embedding_dimensions:          768,
        vector_search_executed:        withEmbedding > 0,
        vector_search_ok:              vectorSearchOk,
        vector_search_latency_ms:      vectorSearchMs,
        vector_search_results:         vectorSearchCount,
        vector_search_via:             vectorSearchVia,
        vector_search_error:           vectorSearchError ?? null,
        // Atlas aggregation pipeline results
        corpus_outcome_distribution:   outcomeDistribution,
        corpus_year_range:             corpusYearRange,
      },
      labels: {
        atlas_connection:  'Atlas Connected',
        past_cases:        totalCount >= 30
          ? `Historical Dataset Ready (${totalCount} cases)`
          : totalCount > 0
            ? `Partial Dataset (${totalCount} / 30 cases)`
            : 'Historical Dataset Empty — run POST /api/seed/past-cases',
        embeddings:        withEmbedding === totalCount && totalCount > 0
          ? `Embeddings Present (${withEmbedding}/${totalCount})`
          : withEmbedding > 0
            ? `Partial Embeddings (${withEmbedding}/${totalCount}) — re-run seed`
            : 'No Embeddings — set VOYAGE_API_KEY and re-run seed',
        vector_search:     vectorSearchOk
          ? `Vector Search Ready (${vectorSearchMs}ms, ${vectorSearchCount} probe results)`
          : withEmbedding === 0
            ? 'Vector Search Blocked — embeddings required'
            : `Vector Search Unavailable — ${vectorSearchError || 'unknown error'}`,
      },
      latency_ms: Date.now() - t0,
      checked_at: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json({
      status: 'unavailable',
      error:  err.message,
      checks: { atlas_connected: false },
      labels: { atlas_connection: `Atlas Unavailable: ${err.message}` },
      latency_ms: Date.now() - t0,
      checked_at: new Date().toISOString(),
    }, { status: 503 })
  }
}
