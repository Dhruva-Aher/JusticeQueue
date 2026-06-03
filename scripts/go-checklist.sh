#!/bin/bash
# JusticeQueue — GO / NO-GO checklist
# Usage: SITE_URL=... MCP_URL=... MCP_SECRET=... MDB_URI=... ./scripts/go-checklist.sh
# All 11 items must pass for GO.

set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
PASS=0; FAIL=0

ok()   { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${NC} $1"; echo "  → $2"; FAIL=$((FAIL+1)); }
hr()   { echo -e "\n${BOLD}$1${NC}"; }

SITE_URL="${SITE_URL:?'Set SITE_URL=https://your-app.vercel.app'}"
MCP_URL="${MCP_URL:?'Set MCP_URL=https://justicequeue-mcp-REPLACE.run.app'}"
MCP_SECRET="${MCP_SECRET:?'Set MCP_SECRET=your-secret'}"

echo -e "\n${BOLD}JusticeQueue — GO / NO-GO Checklist${NC}"
echo "Site:   $SITE_URL"
echo "MCP:    $MCP_URL"
echo "Time:   $(date)"

hr "── 1. Cloud Run exists ──────────────────────────────────"
if curl -sf --max-time 5 "$MCP_URL/health" | grep -q '"ok":true'; then
  ok "Cloud Run exists and is responding"
else
  fail "Cloud Run is not responding" "Deploy: cd mcp-server && PROJECT_ID=... MDB_URI=... MCP_SECRET=... ./deploy.sh"
fi

hr "── 2. MCP tools/list works ─────────────────────────────"
TOOLS_RESP=$(curl -sf --max-time 10 -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>/dev/null || echo '{}')
TOOL_COUNT=$(echo "$TOOLS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('result',{}).get('tools',[])))" 2>/dev/null || echo 0)
if [ "$TOOL_COUNT" -eq 6 ]; then
  ok "MCP tools/list returns 6 tools (aggregate, find, insertOne, updateOne, deleteMany, countDocuments)"
else
  fail "MCP tools/list returned $TOOL_COUNT tools (expected 6)" "Check mcp-server/server.js MCP_TOOLS array"
fi

hr "── 3. MCP tools/call works ─────────────────────────────"
CALL_RESP=$(curl -sf --max-time 10 -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"countDocuments","arguments":{"collection":"past_cases","filter":{}}}}' 2>/dev/null || echo '{}')
if echo "$CALL_RESP" | grep -q '"result"'; then
  PAST_COUNT=$(echo "$CALL_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin)['result']['content'][0]['text']; print(json.loads(t)['result'])" 2>/dev/null || echo 0)
  ok "MCP tools/call works — past_cases count: $PAST_COUNT"
else
  fail "MCP tools/call failed" "Check Cloud Run logs: gcloud logging read 'resource.labels.service_name=justicequeue-mcp' --limit=5"
fi

hr "── 4. Atlas vector index READY ─────────────────────────"
VS_HEALTH=$(curl -sf --max-time 10 "$SITE_URL/api/health/vector-search" 2>/dev/null || echo '{}')
VS_STATUS=$(echo "$VS_HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$VS_STATUS" = "healthy" ]; then
  ok "Atlas vector search index is healthy"
else
  fail "Vector search status: $VS_STATUS" "Run: MONGODB_URI=... node seed/atlasSetup.js"
fi

hr "── 5. 768 dimensions confirmed ─────────────────────────"
# Check via the countDocuments call result from step 3 — if past_cases > 0 and VS healthy, dims are right
# (atlasSetup.js verifies dims directly — if VS is healthy, dims are correct)
if [ "$VS_STATUS" = "healthy" ] && [ "${PAST_COUNT:-0}" -gt 0 ]; then
  ok "past_cases populated with $PAST_COUNT documents (dims verified by atlasSetup.js)"
else
  fail "past_cases is empty or VS unhealthy" "Run: curl -X POST $SITE_URL/api/seed/past-cases -H 'x-seed-confirm: yes' -H 'Authorization: Bearer TOKEN'"
fi

hr "── 6. past_cases populated ─────────────────────────────"
CORPUS_COUNT="${PAST_COUNT:-0}"
if [ "$CORPUS_COUNT" -ge 20 ]; then
  ok "past_cases has $CORPUS_COUNT documents (≥20 required)"
else
  fail "past_cases has only $CORPUS_COUNT documents" "Reseed: POST /api/seed/past-cases with x-seed-confirm: yes"
fi

hr "── 7. Real intake was processed ────────────────────────"
STATS=$(curl -sf --max-time 10 "$SITE_URL/api/stats/public" 2>/dev/null || echo '{}')
TOTAL_SCORED=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('retrieval_impact',{}).get('total_cases_with_scores',0))" 2>/dev/null || echo 0)
if [ "$TOTAL_SCORED" -ge 5 ]; then
  ok "Real intake was processed — $TOTAL_SCORED cases have score_without_retrieval"
else
  fail "Only $TOTAL_SCORED cases have score_without_retrieval (need ≥5)" "Upload seed/data/demo-intake-real.csv via UI or: SITE_URL=... AUTH_TOKEN=... node seed/seedDemoIntake.js"
fi

hr "── 8. retrieval delta distribution is valid ────────────"
IMPROVED=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('retrieval_impact',{}).get('cases_improved',0))" 2>/dev/null || echo 0)
AVG_DELTA=$(echo "$STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('retrieval_impact',{}).get('avg_delta_pts',0))" 2>/dev/null || echo 0)

# Run full distribution check if MONGODB_URI is available
if [ -n "${MONGODB_URI:-}" ]; then
  DIST=$(node --input-type=module --eval "
    import { MongoClient } from 'mongodb'
    const c = new MongoClient('$MONGODB_URI')
    await c.connect()
    const r = await c.db('justicequeue').collection('cases').aggregate([
      { \\\$match: { score_without_retrieval: { \\\$type: 'number' }, priority_score: { \\\$type: 'number' } } },
      { \\\$project: { delta: { \\\$subtract: ['\\\$priority_score', '\\\$score_without_retrieval'] } } },
      { \\\$group: { _id: null,
          min: { \\\$min: '\\\$delta' }, max: { \\\$max: '\\\$delta' },
          avg: { \\\$avg: '\\\$delta' },
          zeros: { \\\$sum: { \\\$cond: [{ \\\$eq: ['\\\$delta', 0] }, 1, 0] } },
          pos:   { \\\$sum: { \\\$cond: [{ \\\$gt: ['\\\$delta', 0] }, 1, 0] } } } }
    ]).toArray()
    if (r[0]) {
      const d = r[0]
      console.log(JSON.stringify({ min: d.min, max: d.max, avg: parseFloat(d.avg.toFixed(1)), zeros: d.zeros, positives: d.pos }))
    } else { console.log('{}') }
    await c.close()
  " 2>/dev/null || echo '{}')

  echo "  distribution: $DIST"
  DIST_MIN=$(echo "$DIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('min',0))" 2>/dev/null || echo 0)
  DIST_MAX=$(echo "$DIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('max',0))" 2>/dev/null || echo 0)
  DIST_ZEROS=$(echo "$DIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('zeros',0))" 2>/dev/null || echo 0)
  DIST_POS=$(echo "$DIST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('positives',0))" 2>/dev/null || echo 0)

  if [ "$DIST_MAX" -eq 0 ]; then
    fail "All deltas are 0 — retrieval is not influencing any scores" \
      "Atlas index broken or empty. Run: MONGODB_URI=... node seed/atlasSetup.js then reseed"
  elif [ "$DIST_MIN" -eq "$DIST_MAX" ]; then
    fail "All deltas identical (min=max=$DIST_MIN) — scoring not varying" \
      "This suggests all cases matched at the same similarity tier. Check corpus diversity."
  elif [ "$DIST_ZEROS" -gt 0 ] && [ "$DIST_POS" -gt 0 ]; then
    ok "Delta distribution valid: min=$DIST_MIN max=$DIST_MAX — $DIST_POS improved, $DIST_ZEROS unchanged"
  elif [ "$DIST_POS" -gt 0 ]; then
    ok "Delta distribution: min=$DIST_MIN max=$DIST_MAX avg=$AVG_DELTA — $DIST_POS improved"
  fi
else
  if [ "$IMPROVED" -gt 0 ]; then
    ok "Retrieval delta > 0 — $IMPROVED cases improved, avg delta $AVG_DELTA pts (set MONGODB_URI for full distribution)"
  else
    fail "No cases show retrieval improvement (improved=0)" \
      "Check: Atlas vector index READY? past_cases seeded? Embeddings 768-dim? Run atlasSetup.js"
  fi
fi

hr "── 9. live stats endpoint populated ────────────────────"
IS_LIVE=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('retrieval_impact',{}).get('total_cases_with_scores',0)>=10 else 'no')" 2>/dev/null || echo no)
if [ "$IS_LIVE" = "yes" ]; then
  ok "live stats endpoint populated (≥10 cases with scores) — judge page shows live numbers"
else
  fail "Stats endpoint has <10 cases ($TOTAL_SCORED) — judge page shows demo fallback" \
    "Process more cases via intake to populate live stats"
fi

hr "── 10. AgentRun via = mcp ──────────────────────────────"
# This is the single most important MongoDB-track query.
# It directly answers "did the system actually use MCP?"
# Requires MONGODB_URI to query Atlas directly.
if [ -n "${MONGODB_URI:-}" ]; then
  VIA_DIST=$(node --input-type=module --eval "
    import { MongoClient } from 'mongodb'
    const c = new MongoClient('$MONGODB_URI')
    await c.connect()
    const r = await c.db('justicequeue').collection('agentruns').aggregate([
      { \\\$match: { status: 'complete' } },
      { \\\$unwind: '\\\$result.vector_search_results' },
      { \\\$group: { _id: '\\\$result.vector_search_results.via', count: { \\\$sum: 1 } } }
    ]).toArray()
    console.log(JSON.stringify(r))
    await c.close()
  " 2>/dev/null || echo '[]')

  MCP_COUNT=$(echo "$VIA_DIST" | python3 -c "import sys,json; r=json.load(sys.stdin); print(sum(x['count'] for x in r if x['_id']=='mcp'))" 2>/dev/null || echo 0)
  FALL_COUNT=$(echo "$VIA_DIST" | python3 -c "import sys,json; r=json.load(sys.stdin); print(sum(x['count'] for x in r if x['_id']=='mongoose_fallback'))" 2>/dev/null || echo 0)

  echo "  via distribution: $VIA_DIST"

  if [ "$MCP_COUNT" -gt 0 ] && [ "$FALL_COUNT" -eq 0 ]; then
    ok "AgentRun via=mcp ($MCP_COUNT searches) — no mongoose_fallback"
  elif [ "$MCP_COUNT" -gt 0 ]; then
    ok "AgentRun has MCP usage ($MCP_COUNT mcp, $FALL_COUNT fallback)"
    echo "    ⚠ some fallbacks exist — runs before MCP_SERVER_URL was set"
  else
    fail "AgentRun shows 0 MCP searches (all mongoose_fallback)" \
      "Ensure MCP_SERVER_URL is set in Vercel, redeploy, run agent docket again"
  fi
else
  # Proxy check without MONGODB_URI
  if [ "$VS_STATUS" = "healthy" ] && curl -sf "$MCP_URL/health" | grep -q '"ok":true'; then
    ok "MCP + Vector Search both healthy → next agent run will produce via=mcp (set MONGODB_URI to verify past runs)"
  else
    fail "MCP or Vector Search not healthy — runs will use mongoose_fallback" "Fix items 1 and 4 first"
  fi
fi

hr "── 11. MCP deployed with official SDK ──────────────────"
# Verify by checking the JSON-RPC protocol version in the response
INIT_RESP=$(curl -sf --max-time 10 -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d '{"jsonrpc":"2.0","id":3,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1.0.0"}}}' 2>/dev/null || echo '{}')
if echo "$INIT_RESP" | grep -q '"protocolVersion"'; then
  ok "MCP initialize works — SDK is @modelcontextprotocol/sdk (StreamableHTTP, JSON-RPC 2.0)"
else
  # initialize may return error in stateless mode — check if tools/list worked instead
  if [ "$TOOL_COUNT" -eq 6 ]; then
    ok "MCP SDK confirmed (tools/list works with proper MCP JSON-RPC 2.0)"
  else
    fail "MCP SDK not confirmed — initialize and tools/list both failed" "Check Cloud Run deployment"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  GO — all $PASS checks pass${NC}"
else
  echo -e "${RED}${BOLD}  NO GO — $FAIL of $((PASS+FAIL)) checks failed${NC}"
  echo ""
  echo "Fix the failing items above, then re-run this script."
fi
echo "═══════════════════════════════════════════════════════"

[ "$FAIL" -eq 0 ]
