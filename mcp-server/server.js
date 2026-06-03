// JusticeQueue MCP HTTP Server
// Deploy to Cloud Run. Vercel functions call POST /mcp over HTTP.
// No subprocess spawning required — compatible with serverless callers.
//
// Usage:
//   MDB_MCP_CONNECTION_STRING=mongodb+srv://... node server.js
//
// Routes:
//   GET  /health   — liveness check
//   POST /mcp      — { tool, arguments } → { result }

import express  from 'express'
import { MongoClient } from 'mongodb'

const app  = express()
const PORT = process.env.PORT || 8080

const MONGODB_URI = process.env.MDB_MCP_CONNECTION_STRING
const DB_NAME     = 'justicequeue'

if (!MONGODB_URI) {
  console.error('MDB_MCP_CONNECTION_STRING is required')
  process.exit(1)
}

let _client = null

async function getDb() {
  if (!_client) {
    _client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS:         5000,
    })
    await _client.connect()
    console.log('[mcp] connected to MongoDB Atlas')
  }
  return _client.db(DB_NAME)
}

// Keep-warm: connect on startup
getDb().catch((err) => console.error('[mcp] startup connection failed:', err.message))

app.use(express.json({ limit: '8mb' }))

// Shared-secret auth — set MCP_SECRET on Cloud Run and in Vercel
const MCP_SECRET = process.env.MCP_SECRET

function requireSecret(req, res, next) {
  if (!MCP_SECRET) return next()  // secret not configured — open (dev only)
  if (req.headers['x-mcp-secret'] !== MCP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), db: DB_NAME })
})

app.post('/mcp', requireSecret, async (req, res) => {
  const { tool, arguments: args } = req.body ?? {}

  if (!tool || typeof args !== 'object') {
    return res.status(400).json({ error: 'Body must be { tool, arguments }' })
  }

  const started = Date.now()

  try {
    const db = await getDb()
    let result

    switch (tool) {
      case 'aggregate': {
        const coll = db.collection(args.collection)
        result = await coll.aggregate(args.pipeline, { allowDiskUse: true }).toArray()
        break
      }

      case 'find': {
        const coll = db.collection(args.collection)
        let cursor = coll.find(args.filter ?? {})
        if (args.projection) cursor = cursor.project(args.projection)
        if (args.sort)       cursor = cursor.sort(args.sort)
        if (args.limit)      cursor = cursor.limit(args.limit)
        result = await cursor.toArray()
        break
      }

      case 'insertOne': {
        const coll = db.collection(args.collection)
        result = await coll.insertOne(args.document)
        break
      }

      case 'updateOne': {
        const coll = db.collection(args.collection)
        result = await coll.updateOne(args.filter, args.update, args.options ?? {})
        break
      }

      case 'deleteMany': {
        const coll = db.collection(args.collection)
        result = await coll.deleteMany(args.filter)
        break
      }

      case 'countDocuments': {
        const coll = db.collection(args.collection)
        result = await coll.countDocuments(args.filter ?? {})
        break
      }

      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` })
    }

    const ms = Date.now() - started
    console.log(`[mcp] ${tool} ${args.collection ?? ''} ${ms}ms`)
    return res.json({ result, latency_ms: ms })

  } catch (err) {
    console.error(`[mcp] ${tool} error:`, err.message)
    // Attempt reconnect on next call
    _client = null
    return res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`[mcp] HTTP server listening on :${PORT}`)
})
