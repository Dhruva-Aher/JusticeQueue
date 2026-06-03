# JusticeQueue — Pre-Submission Deployment Runbook

Run every step in order. Each step has a verification command.

---

## Step 1 — Deploy MCP Server to Cloud Run

```bash
cd mcp-server

# Install dependencies (required for Docker image)
npm install --production

# Set required env vars
export PROJECT_ID="your-gcp-project-id"
export MDB_URI="mongodb+srv://user:pass@cluster.mongodb.net/justicequeue?retryWrites=true"
export MCP_SECRET="$(openssl rand -hex 24)"
export REGION="us-central1"

# Deploy
PROJECT_ID=$PROJECT_ID MDB_URI=$MDB_URI MCP_SECRET=$MCP_SECRET ./deploy.sh

# Save the Cloud Run URL that is printed
# Looks like: https://justicequeue-mcp-xxxxxxxxxx-uc.a.run.app
export MCP_URL="https://justicequeue-mcp-REPLACE.run.app"
```

**Verify:**
```bash
curl "$MCP_URL/health"
# Expected: {"ok":true,"protocol":"mcp","version":"2024-11-05",...}

curl -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq '.result.tools | length'
# Expected: 6
```

---

## Step 2 — Set Vercel Environment Variables

```bash
# Install Vercel CLI if needed: npm i -g vercel

vercel env add MCP_SERVER_URL production
# Enter: https://justicequeue-mcp-REPLACE.run.app

vercel env add MCP_SECRET production
# Enter: <same MCP_SECRET from Step 1>

# Verify they are set
vercel env ls production | grep MCP
```

**Then redeploy Vercel:**
```bash
vercel --prod
```

---

## Step 3 — Set Up Atlas Vector Search Index

```bash
# Install deps for setup script
cd ..
MONGODB_URI=$MDB_URI node seed/atlasSetup.js
```

This will:
- Drop any wrong-dimension index
- Create 768-dim cosine index named `description_embedding_index`
- Wait for READY status
- Run a test $vectorSearch query

**Manual Atlas verification (in mongosh or Atlas Data Explorer):**
```javascript
db.past_cases.listSearchIndexes()
// Must show: name="description_embedding_index", status="READY", numDimensions=768
```

---

## Step 4 — Seed Past Cases Corpus

POST to your live Vercel app with your Firebase auth token:

```bash
export SITE_URL="https://your-app.vercel.app"
export AUTH_TOKEN="<firebase-id-token>"  # from browser DevTools

curl -X POST "$SITE_URL/api/seed/past-cases" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "x-seed-confirm: yes" | jq .
```

Expected output:
```json
{
  "seeded": 30,
  "with_embeddings": 30,
  "without_embeddings": 0,
  "errors": 0
}
```

**Verify in Atlas:**
```javascript
// Embedding dimensions are correct
db.past_cases.aggregate([
  { $project: { dim: { $size: "$description_embedding" } } },
  { $group: { _id: "$dim", count: { $sum: 1 } } }
])
// Must show: { _id: 768, count: 30 }

// Outcome distribution (should have won/settled/declined mix)
db.past_cases.aggregate([
  { $group: { _id: "$outcome", count: { $sum: 1 } } }
])
```

---

## Step 5 — Process Demo Intake Data

Upload the demo CSV through the real intake pipeline:

```bash
export SITE_URL="https://your-app.vercel.app"
export AUTH_TOKEN="<firebase-id-token>"

node seed/seedDemoIntake.js
```

Or upload via the UI:
1. Go to `/dashboard`
2. Upload `seed/data/demo-intake-real.csv`
3. Wait for processing to complete

**Verify retrieval impact:**
```javascript
// In Atlas
db.cases.find(
  { score_without_retrieval: { $type: "number" } },
  { client_name: 1, priority_score: 1, score_without_retrieval: 1, mongodb_via: 1 }
).sort({ priority_score: -1 }).limit(5)

// Count cases where retrieval improved the score
db.cases.countDocuments({
  $expr: { $gt: ["$priority_score", "$score_without_retrieval"] }
})
// Expected: > 0
```

---

## Step 6 — Run Agent Docket (proves full pipeline)

```bash
curl -X POST "$SITE_URL/api/agent/docket" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.run_id'
```

Wait 30s, then check result:
```bash
curl "$SITE_URL/api/agent/runs" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.[0] | {status, duration_ms, "via": .result.vector_search_results[0].via}'
```

Expected: `"via": "mcp"` (if MCP_SERVER_URL is set and Cloud Run is healthy)

**Verify in Atlas:**
```javascript
db.agentruns.findOne(
  { status: "complete" },
  { run_id: 1, duration_ms: 1, "result.vector_search_results.via": 1, "decisions": { $slice: 3 } }
)
```

---

## Step 7 — Run Full Verification

```bash
SITE_URL=$SITE_URL MCP_URL=$MCP_URL MCP_SECRET=$MCP_SECRET ./scripts/verify.sh
```

Must output: `GO` or `GO WITH WARNINGS`

---

## Step 8 — Cloud Run Log Verification

```bash
# Proves MCP is being called from Vercel
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   resource.labels.service_name="justicequeue-mcp" AND
   textPayload:"[mcp] tools/call"' \
  --limit=20 \
  --format="table(timestamp,textPayload)" \
  --project="$PROJECT_ID"
```

Expected log lines:
```
2026-06-03T... [mcp] tools/call aggregate past_cases 187ms
2026-06-03T... [mcp] tools/call aggregate past_cases 203ms
```

---

## Verification Checklists

### MCP Protocol
```bash
# tools/list
curl -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq '.result.tools[].name'

# tools/call aggregate with $vectorSearch
QVEC=$(python3 -c "import json; print(json.dumps([0.01]*768))")
curl -X POST "$MCP_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "x-mcp-secret: $MCP_SECRET" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"aggregate\",\"arguments\":{\"collection\":\"past_cases\",\"pipeline\":[{\"\$vectorSearch\":{\"index\":\"description_embedding_index\",\"path\":\"description_embedding\",\"queryVector\":$QVEC,\"numCandidates\":10,\"limit\":3}},{\"\$project\":{\"outcome\":1,\"case_type\":1,\"_id\":0}}]}}}" \
  | jq '.result.content[0].text | fromjson | .result | length'
# Expected: 3
```

### Atlas Direct Queries
```javascript
// 1. Index is READY
db.past_cases.listSearchIndexes()

// 2. Embeddings are 768-dim
db.past_cases.aggregate([{$project:{dim:{$size:"$description_embedding"}}},{$group:{_id:"$dim",n:{$sum:1}}}])

// 3. $vectorSearch returns results
db.past_cases.aggregate([
  {$vectorSearch:{index:"description_embedding_index",path:"description_embedding",queryVector:Array.from({length:768},()=>Math.random()*0.1),numCandidates:20,limit:3}},
  {$project:{case_type:1,outcome:1,score:{$meta:"vectorSearchScore"},_id:0}}
])

// 4. AgentRun shows MCP execution
db.agentruns.findOne({status:"complete","result.vector_search_results.via":"mcp"},{run_id:1})

// 5. Retrieval impact is real
db.cases.aggregate([{$match:{score_without_retrieval:{$type:"number"}}},{$group:{_id:null,total:{$sum:1},improved:{$sum:{$cond:[{$gt:["$priority_score","$score_without_retrieval"]},1,0]}},avg:{$avg:{$subtract:["$priority_score","$score_without_retrieval"]}}}}])
```

### API Outputs Required
```bash
# /api/stats/public must show live data
curl "$SITE_URL/api/stats/public" | jq '{
  total_cases_with_scores: .retrieval_impact.total_cases_with_scores,
  cases_improved: .retrieval_impact.cases_improved,
  avg_delta_pts: .retrieval_impact.avg_delta_pts,
  is_live: (.retrieval_impact.total_cases_with_scores >= 10)
}'

# /api/health/vector-search must show healthy
curl "$SITE_URL/api/health/vector-search" | jq '{status, corpus_count: .checks.corpus_count}'
```

---

## Evidence Required for Submission

Screenshot each of these before submitting:

1. **Cloud Run service**: `gcloud run services list` showing `justicequeue-mcp` READY
2. **MCP tools/list response**: curl output showing 6 tools
3. **MCP $vectorSearch response**: curl output showing 3 case results
4. **Atlas: index READY**: screenshot of Atlas search indexes panel
5. **Atlas: embedding dimensions**: aggregate output showing `{_id: 768, n: 30}`
6. **Atlas: AgentRun with via=mcp**: findOne result
7. **Atlas: retrieval impact**: aggregate showing improved > 0, avg > 0
8. **Cloud Run logs**: gcloud logging showing `tools/call aggregate past_cases`
9. **Judge page /judge**: showing live stats (check browser DevTools Network tab for `/api/stats/public` response)
10. **Agent page /agent**: completed run showing model decisions panel
