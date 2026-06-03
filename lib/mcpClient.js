// MongoDB MCP Client
//
// Two transport modes — same public API for both:
//
//   Production (MCP_SERVER_URL set):
//     HTTP POST to Cloud Run MCP server.
//     Works in Vercel serverless — no subprocess spawning.
//     Set MCP_SERVER_URL=https://justicequeue-mcp-xxx.run.app in Vercel.
//
//   Local dev (MCP_ENABLED=true, no MCP_SERVER_URL):
//     Spawns @mongodb-js/mongodb-mcp-server as stdio subprocess.
//
//   Neither set → throws → callers fall back to Mongoose.

import { Client }               from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MONGODB_URI  = process.env.MONGODB_URI
const DB_NAME      = 'justicequeue'
const MCP_HTTP_URL = process.env.MCP_SERVER_URL   // Cloud Run URL

// ── HTTP transport (Cloud Run / production) ──────────────────────────────────

async function callToolHttp(toolName, args) {
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.MCP_SECRET) headers['x-mcp-secret'] = process.env.MCP_SECRET

  const res = await fetch(`${MCP_HTTP_URL}/mcp`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ tool: toolName, arguments: args }),
    signal:  AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`MCP HTTP ${res.status}: ${text}`)
  }

  const data = await res.json()
  if (data.error) throw new Error(`MCP server error: ${data.error}`)
  return data.result
}

// ── Stdio transport (local dev) ──────────────────────────────────────────────

let _client    = null
let _transport = null

async function getMCPClientStdio() {
  if (_client) return _client
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

  _transport = new StdioClientTransport({
    command: 'npx',
    args:    ['-y', '@mongodb-js/mongodb-mcp-server'],
    env:     { ...process.env, MDB_MCP_CONNECTION_STRING: MONGODB_URI },
  })

  _client = new Client({ name: 'justicequeue-agent', version: '1.0.0' })
  await _client.connect(_transport)
  return _client
}

async function callToolStdio(toolName, args) {
  const client = await getMCPClientStdio()
  const result = await client.callTool({ name: toolName, arguments: args })
  const text   = result.content?.find((c) => c.type === 'text')?.text
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

async function callTool(toolName, args) {
  if (MCP_HTTP_URL) {
    return callToolHttp(toolName, args)
  }
  if (process.env.MCP_ENABLED === 'true') {
    return callToolStdio(toolName, args)
  }
  throw new Error('MCP not configured (set MCP_SERVER_URL for production or MCP_ENABLED=true for local dev)')
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function mcpAggregate(collection, pipeline) {
  return callTool('aggregate', { database: DB_NAME, collection, pipeline })
}

export async function mcpFind(collection, filter = {}, options = {}) {
  return callTool('find', { database: DB_NAME, collection, filter, ...options })
}

export async function mcpInsertOne(collection, document) {
  return callTool('insertOne', { database: DB_NAME, collection, document })
}

export async function mcpUpdateOne(collection, filter, update, options = {}) {
  return callTool('updateOne', { database: DB_NAME, collection, filter, update, options })
}

export async function mcpDeleteMany(collection, filter) {
  return callTool('deleteMany', { database: DB_NAME, collection, filter })
}

export async function closeMCPClient() {
  if (_transport) { await _transport.close(); _transport = null; _client = null }
}
