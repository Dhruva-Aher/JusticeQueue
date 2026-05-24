# JusticeQueue — Devpost Submission Text

## Tagline
AI agent that tells legal aid clinics who needs help first —
before it is too late.

## What it does

Every year, thousands of families lose their homes not because
no legal help existed — but because the right case never reached
the right lawyer in time.

Legal aid clinics receive dozens of intake requests every week
and have capacity for a fraction. Right now, a caseworker reads
every submission manually. It takes hours. The family with a
72-hour eviction notice gets the same priority as someone with
a 6-month timeline. People lose their homes not because no lawyer
was available — but because no system surfaced the right case
at the right time.

JusticeQueue is the agent that closes that gap.

Upload a batch of intake submissions — CSV, PDF, or plain text.
In under 30 seconds the agent reads every submission, extracts
key facts using Gemini 3.1 Flash Lite, searches the clinic's
entire case history for similar situations using MongoDB Atlas
Vector Search, scores each case 0-100 using a transparent
four-dimension algorithm, and returns a prioritized action list
with full explanations. Every score is broken down into its
components. Every recommendation references the past case it is
grounded in. Staff override anything — every override is logged
and informs future scoring.

The agent does not make decisions. It makes decisions defensible.

## The problem nobody named

Everyone knows legal aid clinics are overwhelmed. That is the
identified problem.

The unidentified problem is this: the bottleneck is not legal
capacity — it is decision paralysis at intake. Clinics have
enough lawyers to help more people. What they do not have is a
fast, defensible way to decide who gets seen first. So they
default to first-come-first-served. The family facing eviction
Thursday gets buried under the case that arrived Monday with a
3-month timeline.

JusticeQueue makes intake triage defensible for the first time.
Every decision is explained, traceable, and grounded in the
clinic's own historical outcomes.

## How we built it

Google Cloud Agent Builder orchestrates the multi-step pipeline.
Gemini 3.1 Flash Lite extracts structured facts from unstructured
intake text. Gemini 3.1 Pro Preview writes case-specific
recommendations for high-priority cases. MongoDB Atlas stores
case documents with flexible schema — critical because eviction,
immigration, and wage theft cases have completely different
fields. Atlas Vector Search finds semantically similar past cases,
making the clinic's institutional history an active reasoning
input for every new decision. The MongoDB MCP Server is wired
as the agent's tool layer for vector search and case persistence,
with .mcp.json at the repo root enabling MCP-compatible
environments to connect directly.

## Why MongoDB is load-bearing (not decorative)

Three reasons this cannot be Postgres or Pinecone:

First: flexible schema. Eviction cases, immigration cases, and
wage theft cases have completely different fields. Postgres needs
migrations every time a new case type arrives. MongoDB stores
each document as-is.

Second: vector search and operational data on one platform.
Most vector search implementations require a separate vector
database synced with the operational store. MongoDB Atlas runs
both on the same cluster. The $vectorSearch aggregation stage
queries the same database that handles inserts, reads, and
status updates. No sync layer. No additional service.

Third: aggregation pipeline as the reasoning engine. The urgency
scoring logic runs entirely inside MongoDB as an aggregation
pipeline — not in the application layer. This makes scores fast,
auditable, and tunable without application deploys.

## What we learned

Building responsible AI means designing for failure modes first.
An agent that explains every recommendation, exposes its
reasoning, and keeps humans in control is more useful in
high-stakes domains than one that simply decides. The override
audit trail was not an afterthought — it is the feature that
makes the whole system trustworthy enough to deploy in a clinic
that cannot afford to get it wrong.

## Tech stack
- Google Cloud Agent Builder — pipeline orchestration
- Gemini 3.1 Flash Lite — fact extraction
- Gemini 3.1 Pro Preview — case recommendations
- MongoDB Atlas — document store with flexible schema
- Atlas Vector Search — semantic case similarity
- MongoDB MCP Server — agent tool layer
- Voyage AI — embeddings for vector search
- Next.js 14 on Vercel — full stack, serverless
- Firebase Auth — Google OAuth + email/password
- Upstash Redis — rate limiting

## Links
- Live: https://justicequeuelive.vercel.app
- Demo (no login): https://justicequeuelive.vercel.app/dashboard?demo=true
- Repo: https://github.com/Dhruva-Aher/JusticeQueue
