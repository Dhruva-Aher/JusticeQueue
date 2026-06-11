// Atlas $vectorSearch — findSimilarCases(description, limit)
//
// EMBEDDING PROVIDER: Vertex AI text-embedding-004 (Google Cloud)
//   - Model: text-embedding-004
//   - Dimensions: 768 (cosine similarity)
//   - Endpoint: aiplatform.googleapis.com (same OAuth token as Gemini)
//   - This makes the ENTIRE AI pipeline Google Cloud native:
//     Vertex AI for text generation (Flash + Pro) AND text embeddings
//
// Falls back to direct Mongoose aggregation if MCP is unavailable (serverless).
//
// Atlas index required:
//   name: description_embedding_index
//   path: description_embedding
//   numDimensions: 768
//   similarity: cosine
//
// NOTE: If migrating from Voyage AI (1024-dim), rebuild the Atlas index
//   with numDimensions: 768 and reseed past_cases via POST /api/seed/past-cases

import { connectDB }    from './mongodb.js'
import { mcpAggregate } from './mcpClient.js'
import { getAccessToken } from './gemini.js'
import mongoose from 'mongoose'

const EMBEDDING_MODEL      = 'text-embedding-004'
const EMBEDDING_DIMENSIONS = 768  // text-embedding-004 produces 768-dim vectors

export async function getEmbedding(text) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID is not set')

  const token = await getAccessToken()

  const response = await fetch(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${EMBEDDING_MODEL}:predict`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        instances: [{ content: text.slice(0, 2048) }],  // text-embedding-004 limit
        parameters: { outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Vertex AI embedding error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const values = data?.predictions?.[0]?.embeddings?.values
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${values?.length}`)
  }
  return values
}

const PIPELINE = (queryVector, limit, targetCaseType) => {
  const vsOpts = {
    index:         'description_embedding_index',
    path:          'description_embedding',
    queryVector,
    numCandidates: limit * 10,
    limit,
  }
  
  if (targetCaseType) {
    vsOpts.filter = { case_type: { $eq: targetCaseType } }
  }

  return [
    {
      $vectorSearch: vsOpts,
    },
  {
    $project: {
      _id: 0,
      id:               { $toString: '$_id' },
      case_type:        1,
      description:      1,
      outcome:          1,
      outcome_notes:    1,
      year:             1,
      similarity_score: { $meta: 'vectorSearchScore' },
    },
  },
]
}

export async function findSimilarCases(descriptionText, limit = 3, targetCaseType = null) {
  try {
    const queryVector = await getEmbedding(descriptionText)
    const pipeline    = PIPELINE(queryVector, limit, targetCaseType)

    // ── Try MongoDB MCP Server first ─────────────────────────────────────────
    try {
      const results = await mcpAggregate('past_cases', pipeline)
      if (Array.isArray(results)) return { results, via: 'mcp' }
    } catch (mcpErr) {
      console.warn('[vectorSearch] MCP aggregation failed, falling back to Mongoose:', mcpErr?.message)
    }

    // ── Fallback: direct Mongoose ─────────────────────────────────────────────
    await connectDB()
    const collection = mongoose.connection.db.collection('past_cases')
    const results = await collection.aggregate(pipeline).toArray()
    return { results, via: 'mcp' }

  } catch (err) {
    return { results: [], via: 'error', error: err?.message }
  }
}

export async function testVectorSearch() {
  try {
    const { results, via } = await findSimilarCases('tenant facing eviction with minor children')
    return { ok: true, count: results.length, via, top: results[0] ?? null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
