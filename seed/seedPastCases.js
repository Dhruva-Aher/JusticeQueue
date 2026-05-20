// Standalone seed script — inserts 30 past_cases with Voyage AI embeddings
import 'dotenv/config'
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-large-2'

async function getEmbedding(text) {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set')

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: [text.slice(0, 4000)], model: VOYAGE_MODEL }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI error ${response.status}: ${body}`)
  }

  const data = await response.json()
  return data.data[0].embedding
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
    await mongoose.disconnect()
    return
  }

  const rawData = readFileSync(join(__dirname, 'data', 'past_cases.json'), 'utf8')
  const cases = JSON.parse(rawData)

  console.log(`Generating embeddings for ${cases.length} cases...`)
  const casesWithEmbeddings = []
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const textToEmbed = `${c.case_type} ${c.description || ''} ${c.outcome_notes || ''}`.trim()
    try {
      const embedding = await getEmbedding(textToEmbed)
      casesWithEmbeddings.push({ ...c, description_embedding: embedding })
      process.stdout.write(`\r  ${i + 1}/${cases.length} embeddings generated`)
    } catch (err) {
      console.warn(`\nSkipping case ${i + 1} — embedding failed: ${err.message}`)
      casesWithEmbeddings.push(c)
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
      console.log('Creating vector search index...')
      await collection.createSearchIndex({
        name: 'description_embedding_index',
        type: 'vectorSearch',
        definition: {
          fields: [
            {
              type: 'vector',
              path: 'description_embedding',
              numDimensions: 1024,
              similarity: 'cosine',
            },
          ],
        },
      })
      console.log('Vector search index created. Atlas will build it in the background (~1-2 min).')
    } else {
      console.log('Vector search index already exists.')
    }
  } catch (err) {
    console.warn('Could not manage vector search index (requires Atlas M10+):', err.message)
  }

  console.log('Done. 30 past cases seeded with embeddings.')
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
