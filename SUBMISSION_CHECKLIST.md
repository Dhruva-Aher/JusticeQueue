# Submission Readiness Checklist

Run every item before submitting. Mark each ✓ or ✗.

---

## 1. Past Cases — MongoDB Atlas Vector Search

**Required:** `past_cases` collection must exist with 30 documents and Voyage AI embeddings.

```bash
# Verify via the health endpoint (no auth required)
curl https://justicequeuelive.vercel.app/api/health/vector-search | jq .

# Expected healthy response:
# { "status": "healthy", "checks": { "past_cases_total": 30, "past_cases_with_embeddings": 30, "vector_search_ok": true } }
```

**If unhealthy:** Seed the collection:
```bash
# Requires Firebase ID token from a logged-in user
TOKEN="your-firebase-id-token"
curl -X POST https://justicequeuelive.vercel.app/api/seed/past-cases \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-seed-confirm: yes" | jq .
```

**What this unlocks:** Judge Mode health indicator shows green "Vector Search Ready". 
Docket runs show `similar_cases_found > 0`. Score delta (+N pts) appears in Case Detail.

---

## 2. Judge Mode — Live Health Indicators

Open https://justicequeuelive.vercel.app/judge

Scroll to "SYSTEM REVIEW" section.

Confirm the live `VectorSearchHealth` component shows:
- [ ] Atlas Connected
- [ ] Historical Dataset Ready (30 cases)
- [ ] Embeddings Present (30/30)
- [ ] Vector Search Ready (Xms, Y probe results)

If any show errors: fix the seeding step above.

---

## 3. Full Docket Run — End-to-End

1. Log in at https://justicequeuelive.vercel.app/login
2. Click **Import Cases** → load the demo dataset (50 cases) or upload `seed/data/demo_intake.csv`
3. Click **Prepare Tomorrow's Docket**
4. Wait for completion (typically 30–90s)
5. Navigate to **Agent Activity**

Confirm all of the following in the Agent Activity view:

- [ ] **MODEL DECISION** panel appears first with 4 strategy cards (one highlighted)
- [ ] Reasoning text is populated (not empty)
- [ ] "RESULTING EXECUTION" section shows Atlas $vectorSearch and CourtListener outcomes
- [ ] Execution Timeline has 9 rows (Step 1–9), model_decision shows ◆ in indigo
- [ ] `model_decision` row in timeline shows strategy and escalation level in Result column
- [ ] Historical Case Matches section shows cases with similarity scores
- [ ] `+N pts added to priority scores` badge appears next to Historical Case Matches
- [ ] Decision Log shows at least 3 decisions with evidence pills
- [ ] Adapted Execution Plan shows "adapted" tags on changed steps
- [ ] Verification section shows "Run telemetry logged to Google Cloud Logging"
- [ ] Executive Brief opens at `/agent/brief?run=<run_id>` and contains content
- [ ] Historical Case Matches section appears in the brief

---

## 4. Case Detail — Retrieval Impact

1. From the dashboard case queue, click any case
2. Scroll to "Score Breakdown"

Confirm:
- [ ] Score breakdown bars show correct maximum per case type (employment: /8, eviction: /18)
- [ ] "HISTORICAL RETRIEVAL IMPACT" callout appears if `score_without_retrieval` differs from `priority_score`
- [ ] Similar Past Cases section shows outcome badges and similarity percentages

---

## 5. Cloud Logging — GCP Verification

After a docket run, verify telemetry reached Cloud Logging:

1. Open GCP Console → Logging → Log Explorer
2. Filter: `logName="projects/YOUR_PROJECT/logs/justicequeue.agent"`
3. Confirm at least one entry with `event: "docket_run_complete"` and correct `run_id`

If no entries appear: check that `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` are set in Vercel.

---

## 6. Environment Variables — Vercel

Verify all of these are set in the Vercel project settings:

- [ ] `MONGODB_URI`
- [ ] `GOOGLE_CLOUD_PROJECT_ID`
- [ ] `GOOGLE_OAUTH_CLIENT_ID`
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] `GOOGLE_OAUTH_REFRESH_TOKEN`
- [ ] `GEMINI_MODEL_FLASH` (must be a valid model in your GCP project)
- [ ] `GEMINI_MODEL_PRO` (must be a valid model in your GCP project)
- [ ] `VOYAGE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_*` (6 Firebase config vars)
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`

Optional (disable if not configured):
- [ ] `GMAIL_ENABLED=false` (unless Gmail OAuth scopes are configured)
- [ ] `CALENDAR_ENABLED=false` (unless Calendar OAuth scopes are configured)
- [ ] `MCP_ENABLED=false` (always false in production)

---

## 7. Submission Links

Confirm these URLs work and load correctly:

- [ ] https://justicequeuelive.vercel.app/ — landing page
- [ ] https://justicequeuelive.vercel.app/judge — Judge Mode (no login required)
- [ ] https://justicequeuelive.vercel.app/dashboard?demo=true — demo dashboard (no login)
- [ ] https://justicequeuelive.vercel.app/api/health/vector-search — health check JSON

---

## 8. README Final Check

- [ ] Step count says "9-step" (not 8)
- [ ] Model decision step is documented in "How It Works"
- [ ] Known Limitations section is accurate
- [ ] All links resolve

---

## 9. Demo Video (if required by submission form)

Recommended flow (3–5 minutes):

1. Open Judge Mode at `/judge` — describe the problem in one sentence
2. Show the workflow flow strip: INTAKE → DOCKET
3. Open the dashboard, show 50 seeded cases with score breakdowns
4. Click a case, show HISTORICAL RETRIEVAL IMPACT callout (+N pts)
5. Click "Prepare Tomorrow's Docket" — let judges see the loading overlay step labels
6. In Agent Activity: show the MODEL DECISION panel first (strategy cards + rejected alternatives)
7. Show "RESULTING EXECUTION" — what the model decision triggered
8. Scroll through execution timeline (◆ on model_decision step)
9. Show Decision Log — evidence pills
10. Open Executive Brief — historical matches + recommendations

Do not narrate every feature. Narrate: "The model evaluated 4 strategies and selected this one. That decision caused CourtListener to [run/skip]. Here's the audit trail in MongoDB."

---

*Complete all items before submission. The vector search seeding (item 1) has the highest single-item impact on MongoDB track scoring.*
