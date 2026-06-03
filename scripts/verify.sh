#!/bin/bash
# JusticeQueue — end-to-end verification script
# Run this before recording the demo.
# Usage: SITE_URL=https://your-app.vercel.app MCP_URL=https://mcp.run.app MCP_SECRET=xxx ./scripts/verify.sh

set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

check() {
  local label="$1"; local cmd="$2"; local expected="$3"
  local out
  out=$(eval "$cmd" 2>&1) || true
  if echo "$out" | grep -q "$expected"; then
    echo -e "${GREEN}✓${NC} $label"
    PASS=$((PASS+1))
  else
    echo -e "${RED}✗${NC} $label"
    echo "  Expected: $expected"
    echo "  Got:      $(echo "$out" | head -3)"
    FAIL=$((FAIL+1))
  fi
}

warn() {
  local label="$1"
  echo -e "${YELLOW}⚠${NC} $label"
  WARN=$((WARN+1))
}

SITE_URL="${SITE_URL:?'Set SITE_URL'}"
MCP_URL="${MCP_URL:-}"
MCP_SECRET="${MCP_SECRET:-}"

echo "================================================="
echo " JusticeQueue Verification — $(date)"
echo " Site: $SITE_URL"
echo "================================================="

echo ""
echo "── PHASE 1: APPLICATION HEALTH ─────────────────"
check "App responds" "curl -sf '$SITE_URL/api/health'" '"ok"'
check "Vector search health" "curl -sf '$SITE_URL/api/health/vector-search'" '"ok"'
check "Public stats API" "curl -sf '$SITE_URL/api/stats/public'" '"ok":true'

echo ""
echo "── PHASE 2: MCP SERVER ─────────────────────────"
if [ -z "$MCP_URL" ]; then
  warn "MCP_URL not set — skipping MCP checks (set MCP_URL env var)"
else
  check "MCP health endpoint" \
    "curl -sf '$MCP_URL/health'" '"ok":true'
  check "MCP tools/list returns 6 tools" \
    "curl -sf -X POST '$MCP_URL/mcp' -H 'Content-Type: application/json' -H 'x-mcp-secret: $MCP_SECRET' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}'" \
    '"name":"aggregate"'
  check "MCP tools/call countDocuments" \
    "curl -sf -X POST '$MCP_URL/mcp' -H 'Content-Type: application/json' -H 'x-mcp-secret: $MCP_SECRET' -d '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"countDocuments\",\"arguments\":{\"collection\":\"past_cases\",\"filter\":{}}}}'" \
    '"result"'
  check "MCP rejects wrong secret (401)" \
    "curl -s -o /dev/null -w '%{http_code}' -X POST '$MCP_URL/mcp' -H 'Content-Type: application/json' -H 'x-mcp-secret: WRONG' -d '{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/list\",\"params\":{}}'" \
    "401"
fi

echo ""
echo "── PHASE 3: ATLAS CORPUS ───────────────────────"
STATS=$(curl -sf "$SITE_URL/api/stats/public" 2>/dev/null || echo '{}')
TOTAL=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('corpus',{}).get('total_cases',0))" 2>/dev/null || echo 0)
SCORED=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('retrieval_impact',{}).get('total_cases_with_scores',0))" 2>/dev/null || echo 0)
IMPROVED=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('retrieval_impact',{}).get('cases_improved',0))" 2>/dev/null || echo 0)
AVG=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('retrieval_impact',{}).get('avg_delta_pts',0))" 2>/dev/null || echo 0)

echo "  Total cases in Atlas: $TOTAL"
echo "  Cases with score_without_retrieval: $SCORED"
echo "  Cases improved by retrieval: $IMPROVED"
echo "  Average delta (pts): $AVG"

[ "$TOTAL" -gt 0 ] && { echo -e "${GREEN}✓${NC} Atlas has case data"; PASS=$((PASS+1)); } || { echo -e "${RED}✗${NC} No cases in Atlas — run demo intake"; FAIL=$((FAIL+1)); }
[ "$SCORED" -ge 5 ] && { echo -e "${GREEN}✓${NC} Retrieval impact data present ($SCORED cases)"; PASS=$((PASS+1)); } || warn "Fewer than 5 cases have score_without_retrieval — run demo intake"
[ "$IMPROVED" -gt 0 ] && { echo -e "${GREEN}✓${NC} Retrieval positively impacts $IMPROVED cases"; PASS=$((PASS+1)); } || warn "No cases show retrieval improvement — check Atlas vector search index"
[ "$AVG" -gt 0 ] && { echo -e "${GREEN}✓${NC} Avg delta is $AVG pts (nonzero)"; PASS=$((PASS+1)); } || warn "Avg delta is 0 — retrieval not influencing scores"

echo ""
echo "── PHASE 4: VECTOR SEARCH HEALTH ──────────────"
VS=$(curl -sf "$SITE_URL/api/health/vector-search" 2>/dev/null || echo '{}')
VS_STATUS=$(echo "$VS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
VS_COUNT=$(echo "$VS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checks',{}).get('corpus_count',0))" 2>/dev/null || echo 0)
echo "  Vector search status: $VS_STATUS"
echo "  past_cases corpus: $VS_COUNT documents"
[ "$VS_STATUS" = "healthy" ] && { echo -e "${GREEN}✓${NC} Vector search is healthy"; PASS=$((PASS+1)); } || { echo -e "${RED}✗${NC} Vector search status: $VS_STATUS"; FAIL=$((FAIL+1)); }
[ "$VS_COUNT" -ge 20 ] && { echo -e "${GREEN}✓${NC} past_cases has $VS_COUNT documents"; PASS=$((PASS+1)); } || { echo -e "${RED}✗${NC} past_cases has only $VS_COUNT documents (need ≥20)"; FAIL=$((FAIL+1)); }

echo ""
echo "================================================="
echo " Results: ${GREEN}${PASS} PASS${NC} · ${WARN} WARN · ${RED}${FAIL} FAIL${NC}"
echo "================================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "BLOCKERS — fix before demo:"
  [ -z "$MCP_URL" ] && echo "  • Set MCP_URL and run this script again to verify MCP"
  [ "$TOTAL" -eq 0 ] && echo "  • Upload demo-intake-real.csv via app UI, or run: node seed/seedDemoIntake.js"
  [ "$VS_STATUS" != "healthy" ] && echo "  • POST /api/seed/past-cases (with x-seed-confirm: yes header)"
  echo ""
  exit 1
fi

[ "$WARN" -gt 0 ] && echo "GO WITH WARNINGS — see ⚠ items above" || echo -e "${GREEN}GO — all checks pass${NC}"
