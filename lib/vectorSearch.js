// Atlas $vectorSearch aggregation — findSimilarCases(description, limit)
import { connectDB } from './mongodb.js'
import mongoose from 'mongoose'

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-large-2'

export async function getEmbedding(text) {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text.slice(0, 4000)],
      model: VOYAGE_MODEL,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI error ${response.status}: ${body}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function findSimilarCases(descriptionText, limit = 3) {
  try {
    const queryVector = await getEmbedding(descriptionText)

    await connectDB()
    const db = mongoose.connection.db
    const collection = db.collection('past_cases')

    const pipeline = [
      {
        $vectorSearch: {
          index: 'description_embedding_index',
          path: 'description_embedding',
          queryVector,
          numCandidates: limit * 10,
          limit,
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          case_type: 1,
          description: 1,
          outcome: 1,
          outcome_notes: 1,
          year: 1,
          similarity_score: { $meta: 'vectorSearchScore' },
        },
      },
    ]

    const results = await collection.aggregate(pipeline).toArray()
    return results
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
