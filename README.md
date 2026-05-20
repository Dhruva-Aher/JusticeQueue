# JusticeQueue

AI triage agent for legal aid clinics. Intake workers upload a CSV, text, or PDF of pending cases; Gemini Flash extracts structured facts from each case, Atlas vector search finds similar past outcomes, and a scoring function ranks cases by urgency (deadline proximity, vulnerability flags, case type, and precedent similarity) so the most critical clients are never buried under paperwork.

Built for the Google Cloud Rapid Agent Hackathon 2026 — MongoDB track.

## Setup

```bash
git clone https://github.com/Dhruva-Aher/Hackathon
cd Hackathon
npm install
cp .env.example .env.local
# Fill all values in .env.local (see comments in the file)
npm run seed        # insert 30 past cases + create vector search index
npm run dev         # start dev server at http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub (already done)
2. Go to [vercel.com/new](https://vercel.com/new) and import this repo
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Deploy — Vercel auto-detects Next.js

## Architecture

```
Browser
  │
  ├─ app/(public)/page.jsx          Landing page
  ├─ app/(public)/login/page.jsx    Firebase Auth (email + Google OAuth)
  └─ app/(protected)/dashboard/     Protected queue view
       page.jsx
         │
         ├─ POST /api/intake/upload  ← mulitpart file
         │     parseFile → extractCaseFacts (Gemini Flash)
         │                → findSimilarCases (Atlas $vectorSearch)
         │                → computeScore (pure function)
         │                → writeRecommendation (Gemini Pro, top 3 only)
         │                → Case.insertMany (MongoDB Atlas)
         │
         ├─ GET  /api/cases/queue    Sorted by priority_score
         ├─ GET  /api/cases/:id      Full document
         ├─ POST /api/cases/:id/override  Staff override → staff_actions
         └─ GET  /api/cases/history  Batch history

Stack
  Next.js 14 App Router     — frontend + serverless API routes
  MongoDB Atlas             — document store + vector search (cosine, 1024-dim)
  Vertex AI (Gemini)        — extraction (Flash) + recommendation (Pro)
  Firebase Auth             — client auth + admin token verification
  Upstash Redis             — serverless rate limiting (10 req / 15 min)
  Vercel                    — hosting, iad1 region, 30s function timeout
```

## Environment Variables

See `.env.example` for the full list with comments.
Key groups: `MONGODB_URI`, `FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`,
`GOOGLE_CLOUD_*`, `GEMINI_MODEL_*`, `VOYAGE_API_KEY`, `UPSTASH_*`.

## Hackathon

Google Cloud Rapid Agent Hackathon 2026 — MongoDB track  
Public repo: https://github.com/Dhruva-Aher/Hackathon  
License: MIT
