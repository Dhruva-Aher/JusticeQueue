// JusticeQueue MCP Server — standards-compliant implementation
// Uses @modelcontextprotocol/sdk with StreamableHTTP transport.
// Deployed on Cloud Run. Vercel functions call POST /mcp with proper MCP JSON-RPC 2.0.
//
// Protocol: MCP 2024-11-05 / JSON-RPC 2.0
// Transport: StreamableHTTP (stateless mode — each request is a complete exchange)
//
// Routes:
//   GET  /health  — liveness probe (Cloud Run)
//   POST /mcp     — MCP JSON-RPC endpoint (initialize + tools/list + tools/call)

import express from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { MongoClient } from 'mongodb'

const app  = express()
const PORT = process.env.PORT || 8080

const MONGODB_URI = process.env.MDB_MCP_CONNECTION_STRING
const DB_NAME     = 'justicequeue'
const MCP_SECRET  = process.env.MCP_SECRET

if (!MONGODB_URI) {
  console.error('[mcp] MDB_MCP_CONNECTION_STRING is required')
  process.exit(1)
}

// ── MongoDB connection (reused across requests) ──────────────────────────────
let _mongoClient = null

async function getDb() {
  if (!_mongoClient) {
    _mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    })
    await _mongoClient.connect()
    console.log('[mcp] connected to MongoDB Atlas')
  }
  return _mongoClient.db(DB_NAME)
}

// Keep-warm: establish connection on startup
getDb().catch((err) => console.error('[mcp] startup connection failed:', err.message))

// ── Tool definitions (MCP tools/list response) ────────────────────────────────
const MCP_TOOLS = [
  {
    name:        'aggregate',
    description: 'Execute a MongoDB aggregation pipeline. Supports $vectorSearch for Atlas Vector Search.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string', description: 'Database name (defaults to justicequeue)' },
        collection: { type: 'string', description: 'Collection name' },
        pipeline:   { type: 'array',  description: 'Aggregation pipeline stages' },
      },
      required: ['collection', 'pipeline'],
    },
  },
  {
    name:        'find',
    description: 'Query documents from a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string' },
        collection: { type: 'string' },
        filter:     { type: 'object', description: 'Query filter' },
        projection: { type: 'object', description: 'Field projection' },
        sort:       { type: 'object', description: 'Sort specification' },
        limit:      { type: 'number', description: 'Maximum documents to return' },
      },
      required: ['collection'],
    },
  },
  {
    name:        'insertOne',
    description: 'Insert a single document into a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string' },
        collection: { type: 'string' },
        document:   { type: 'object', description: 'Document to insert' },
      },
      required: ['collection', 'document'],
    },
  },
  {
    name:        'updateOne',
    description: 'Update a single document in a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string' },
        collection: { type: 'string' },
        filter:     { type: 'object', description: 'Filter to match document' },
        update:     { type: 'object', description: 'Update operation' },
        options:    { type: 'object' },
      },
      required: ['collection', 'filter', 'update'],
    },
  },
  {
    name:        'deleteMany',
    description: 'Delete documents matching a filter from a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string' },
        collection: { type: 'string' },
        filter:     { type: 'object', description: 'Filter to match documents' },
      },
      required: ['collection', 'filter'],
    },
  },
  {
    name:        'countDocuments',
    description: 'Count documents matching a filter in a MongoDB collection.',
    inputSchema: {
      type: 'object',
      properties: {
        database:   { type: 'string' },
        collection: { type: 'string' },
        filter:     { type: 'object' },
      },
      required: ['collection'],
    },
  },
]

// ── MCP Server factory — creates a fresh server per request (stateless) ────────
function createMcpServer() {
  const server = new Server(
    { name: 'justicequeue-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS,
  }))

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params
    const started = Date.now()

    try {
      const db   = await getDb()
      const coll = db.collection(args.collection)
      let result

      switch (name) {
        case 'aggregate': {
          result = await coll.aggregate(args.pipeline, { allowDiskUse: true }).toArray()
          break
        }
        case 'find': {
          let cursor = coll.find(args.filter ?? {})
          if (args.projection) cursor = cursor.project(args.projection)
          if (args.sort)       cursor = cursor.sort(args.sort)
          if (args.limit)      cursor = cursor.limit(args.limit)
          result = await cursor.toArray()
          break
        }
        case 'insertOne': {
          result = await coll.insertOne(args.document)
          break
        }
        case 'updateOne': {
          result = await coll.updateOne(args.filter, args.update, args.options ?? {})
          break
        }
        case 'deleteMany': {
          result = await coll.deleteMany(args.filter)
          break
        }
        case 'countDocuments': {
          result = await coll.countDocuments(args.filter ?? {})
          break
        }
        default:
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
            isError: true,
          }
      }

      const ms = Date.now() - started
      console.log(`[mcp] tools/call ${name} ${args.collection} ${ms}ms`)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ result, latency_ms: ms, tool: name, collection: args.collection }),
        }],
        isError: false,
      }
    } catch (err) {
      console.error(`[mcp] tools/call ${name} error:`, err.message)
      _mongoClient = null  // reset on connection error
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true,
      }
    }
  })

  return server
}

// ── Express setup ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '8mb' }))

// Shared-secret auth on /mcp only
function requireSecret(req, res, next) {
  if (!MCP_SECRET) return next()
  if (req.headers['x-mcp-secret'] !== MCP_SECRET) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null })
  }
  next()
}

// Health endpoint (no auth — Cloud Run liveness probe)
app.get('/health', (_req, res) => {
  res.json({
    ok:       true,
    protocol: 'mcp',
    version:  '2024-11-05',
    db:       DB_NAME,
    ts:       new Date().toISOString(),
  })
})

// MCP endpoint — stateless StreamableHTTP
app.post('/mcp', requireSecret, async (req, res) => {
  const server    = createMcpServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // stateless: no session management needed
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('[mcp] transport error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error', data: err.message },
        id: req.body?.id ?? null,
      })
    }
  } finally {
    // Give the transport time to flush, then close
    setImmediate(() => server.close().catch(() => {}))
  }
})

app.listen(PORT, () => {
  console.log(`[mcp] MCP server (protocol 2024-11-05) listening on :${PORT}`)
})
