// Atlas $vectorSearch aggregation — findSimilarCases(description, limit)
import { connectDB } from './mongodb.js'
import mongoose from 'mongoose'

export async function findSimilarCases(descriptionText, limit = 3) {
  try {
    await connectDB()
    const db = mongoose.connection.db
    const collection = db.collection('past_cases')

    const pipeline = [
      {
        $vectorSearch: {
          index: 'description_vector_index',
          path: 'description_embedding',
          queryVector: descriptionText,
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
