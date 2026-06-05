import { NextResponse } from 'next/server'
import { connectDB } from '../../../lib/mongodb.js'
import Case from '../../../lib/models/Case.js'
import { findSimilarCases } from '../../../lib/vectorSearch.js'
import { computeScore } from '../../../lib/urgencyScore.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 minutes

export async function GET() {
  try {
    await connectDB()
    const cases = await Case.find({ similar_cases: { $size: 0 } })
    
    let improved = 0
    let processed = 0
    const logs = []
    
    for (const c of cases) {
      if (logs.length > 50) break

      try {
        const { results, via, error } = await findSimilarCases(c.summary)
        
        if (!results || results.length === 0) {
          logs.push(`CASE ${c.uid}: via=${via} count=${results?.length || 0} error=${error || 'none'}`)
          continue
        }
        
        const extracted = { 
          case_type: c.case_type, 
          deadline_days: c.deadline_days, 
          vulnerability_flags: c.vulnerability_flags 
        }
        const { score, breakdown, reason_string } = computeScore(extracted, results)
        
        c.similar_cases = results
        c.priority_score = score
        c.score_breakdown = breakdown
        c.priority_reason = reason_string
        c.mongodb_via = via
        
        await c.save()
        processed++
        
        if (score > c.score_without_retrieval) {
          improved++
        }
        logs.push(`Fixed Case ${c.uid} via ${via}: ${c.score_without_retrieval} -> ${score}`)
      } catch (err) {
        logs.push(`ERROR ${c.uid}: ${err.message}`)
      }
    }
    
    return NextResponse.json({ 
      ok: true, 
      cases_found: cases.length,
      cases_processed: processed,
      cases_improved: improved,
      logs 
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
