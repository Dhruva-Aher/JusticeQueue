// Atlas $vectorSearch — findSimilarCases(description, limit)
// Uses MongoDB MCP Server (mcpClient.js) for the aggregation when available,
// falls back to direct Mongoose if MCP spawn fails (serverless cold-start).
import { connectDB }  from './mongodb.js'
import { mcpAggregate } from './mcpClient.js'
import mongoose from 'mongoose'

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL   = 'voyage-large-2'

export async function getEmbedding(text) {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch(VOYAGE_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: [text.slice(0, 4000)], model: VOYAGE_MODEL }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI error ${response.status}: ${body}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

const PIPELINE = (queryVector, limit) => [
  {
    $vectorSearch: {
      index:         'description_embedding_index',
      path:          'description_embedding',
      queryVector,
      numCandidates: limit * 10,
      limit,
    },
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

export async function findSimilarCases(descriptionText, limit = 3) {
  try {
    const queryVector = await getEmbedding(descriptionText)
    const pipeline    = PIPELINE(queryVector, limit)

    // ── Try MongoDB MCP Server first ─────────────────────────────────────────
    try {
      const results = await mcpAggregate('past_cases', pipeline)
      if (Array.isArray(results)) return results
    } catch (mcpErr) {
      console.warn('[vectorSearch] MCP aggregation failed, falling back to Mongoose:', mcpErr?.message)
    }

    // ── Fallback: direct Mongoose ─────────────────────────────────────────────
    await connectDB()
    const collection = mongoose.connection.db.collection('past_cases')
    return await collection.aggregate(pipeline).toArray()

  } catch {
    return []
  }
}

export async function testVectorSearch() {
  try {
    const results = await findSimilarCases('tenant facing eviction with minor children')
    return { ok: true, count: results.length, top: results[0] ?? null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
