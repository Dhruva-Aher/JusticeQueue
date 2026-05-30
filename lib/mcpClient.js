// MongoDB MCP Client — wraps @mongodb-js/mongodb-mcp-server via MCP protocol
// The MCP server is configured in .mcp.json and runs as a stdio subprocess.
// In serverless (Vercel), we spawn the MCP server per-request using StdioClientTransport.
// Falls back to direct Mongoose if MCP spawn fails (e.g. cold-start timeouts).
//
// MCP tools exposed by @mongodb-js/mongodb-mcp-server:
//   find            — query documents with filter/projection/sort/limit
//   insertOne       — insert a single document
//   updateOne       — update a single document
//   deleteMany      — delete documents matching a filter
//   aggregate       — run an aggregation pipeline
//   listCollections — list collections in a database
//   listDatabases   — list databases

import { Client }               from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME     = 'justicequeue'

let _client    = null
let _transport = null

async function getMCPClient() {
  if (_client) return _client

  if (process.env.MCP_ENABLED !== 'true') {
    throw new Error('MCP disabled — falling back to Mongoose')
  }

  if (!MONGODB_URI) throw new Error('MONGODB_URI not set — cannot start MongoDB MCP server')

  _transport = new StdioClientTransport({
    command: 'npx',
    args:    ['-y', '@mongodb-js/mongodb-mcp-server'],
    env:     { ...process.env, MDB_MCP_CONNECTION_STRING: MONGODB_URI },
  })

  _client = new Client({ name: 'justicequeue-agent', version: '1.0.0' })
  await _client.connect(_transport)
  return _client
}

async function callTool(toolName, args) {
  const client = await getMCPClient()
  const result = await client.callTool({ name: toolName, arguments: args })
  // MCP returns content as array of text blocks
  const text = result.content?.find((c) => c.type === 'text')?.text
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

// ── Public API — mirrors what the agent needs ────────────────────────────────

export async function mcpFind(collection, filter = {}, options = {}) {
  return callTool('find', {
    connectionStringOrName: MONGODB_URI,
    database:   DB_NAME,
    collection,
    filter,
    ...options,
  })
}

export async function mcpInsertOne(collection, document) {
  return callTool('insertOne', {
    connectionStringOrName: MONGODB_URI,
    database:   DB_NAME,
    collection,
    document,
  })
}

export async function mcpAggregate(collection, pipeline) {
  return callTool('aggregate', {
    connectionStringOrName: MONGODB_URI,
    database:   DB_NAME,
    collection,
    pipeline,
  })
}

export async function mcpDeleteMany(collection, filter) {
  return callTool('deleteMany', {
    connectionStringOrName: MONGODB_URI,
    database:   DB_NAME,
    collection,
    filter,
  })
}

export async function mcpUpdateOne(collection, filter, update) {
  return callTool('updateOne', {
    connectionStringOrName: MONGODB_URI,
    database:   DB_NAME,
    collection,
    filter,
    update,
  })
}

// Close transport when done (call in cleanup if needed)
export async function closeMCPClient() {
  if (_transport) { await _transport.close(); _transport = null; _client = null }
}
