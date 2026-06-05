// MongoDB MCP Client
//
// Sends MCP JSON-RPC 2.0 requests to the Cloud Run MCP server.
// Protocol: MCP 2024-11-05 / JSON-RPC 2.0
//
// Production (MCP_SERVER_URL set):
//   POST JSON-RPC 2.0 to Cloud Run — real MCP protocol, no subprocess.
//
// Local dev (MCP_ENABLED=true, no MCP_SERVER_URL):
//   Spawns @mongodb-js/mongodb-mcp-server as stdio subprocess.
//
// Neither set → throws → callers fall back to Mongoose.

import { Client }               from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MONGODB_URI  = process.env.MONGODB_URI
const DB_NAME      = 'justicequeue'
const MCP_HTTP_URL = process.env.MCP_SERVER_URL

// ── HTTP / JSON-RPC 2.0 transport (Cloud Run production) ──────────────────────
// Sends proper MCP JSON-RPC 2.0 protocol messages.
// The MCP server handles initialize internally per the stateless StreamableHTTP spec.

let _httpRequestId = 0

async function callToolHttp(toolName, args) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept':       'application/json, text/event-stream',
  }
  if (process.env.MCP_SECRET) headers['x-mcp-secret'] = process.env.MCP_SECRET

  // MCP JSON-RPC 2.0 tools/call request
  const body = {
    jsonrpc: '2.0',
    id:      ++_httpRequestId,
    method:  'tools/call',
    params: {
      name:      toolName,
      arguments: args,
    },
  }

  const res = await fetch(`${MCP_HTTP_URL}/mcp`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(12000),
  })

  if (res.status === 401) throw new Error('MCP unauthorized — check MCP_SECRET')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`MCP HTTP ${res.status}: ${text}`)
  }

  // StreamableHTTP response can be JSON or SSE — we configured stateless (JSON only)
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    // SSE response — read the first data event
    const text = await res.text()
    const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
    if (!dataLine) throw new Error('MCP SSE response had no data event')
    const rpc = JSON.parse(dataLine.replace('data: ', ''))
    return extractToolResult(rpc, toolName)
  }

  // JSON response
  const rawText = await res.text()
  console.error('[MCP_DEBUG] Raw HTTP Response:', rawText)
  const rpc = JSON.parse(rawText)
  return extractToolResult(rpc, toolName)
}

function extractToolResult(rpc, toolName) {
  if (rpc.error) {
    throw new Error(`MCP tools/call ${toolName} error: ${rpc.error.message}`)
  }
  if (!rpc.result) throw new Error('MCP response missing result')

  // MCP content is [{type:'text', text: '...'}]
  const text = rpc.result.content?.find((c) => c.type === 'text')?.text
  if (!text) return null

  const parsed = JSON.parse(text)
  // Our server wraps result as { result, latency_ms, tool, collection }
  return parsed.result ?? parsed
}

// ── Stdio transport (local dev) ──────────────────────────────────────────────
let _stdioClient    = null
let _stdioTransport = null

async function getMCPClientStdio() {
  if (_stdioClient) return _stdioClient
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set')

  _stdioTransport = new StdioClientTransport({
    command: 'npx',
    args:    ['-y', '@mongodb-js/mongodb-mcp-server'],
    env:     { ...process.env, MDB_MCP_CONNECTION_STRING: MONGODB_URI },
  })

  _stdioClient = new Client({ name: 'justicequeue-agent', version: '1.0.0' }, { capabilities: {} })
  await _stdioClient.connect(_stdioTransport)
  return _stdioClient
}

async function callToolStdio(toolName, args) {
  const client = await getMCPClientStdio()
  const result = await client.callTool({ name: toolName, arguments: args })
  const text   = result.content?.find((c) => c.type === 'text')?.text
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function callTool(toolName, args) {
  if (MCP_HTTP_URL) return callToolHttp(toolName, args)
  if (process.env.MCP_ENABLED === 'true') return callToolStdio(toolName, args)
  throw new Error('MCP not configured (set MCP_SERVER_URL for production or MCP_ENABLED=true for local dev)')
}

// ── Public API ────────────────────────────────────────────────────────────────

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
  if (_stdioTransport) { await _stdioTransport.close(); _stdioTransport = null; _stdioClient = null }
}
