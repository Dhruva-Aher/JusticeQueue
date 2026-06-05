import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { connectDB } from './lib/mongodb.js'
import Case from './lib/models/Case.js'
import { findSimilarCases } from './lib/vectorSearch.js'
import { computeScore } from './lib/urgencyScore.js'

async function run() {
  await connectDB()
  
  // Any case with an empty array missed the vector search step
  const cases = await Case.find({ similar_cases: { $size: 0 } })
  console.log(`Found ${cases.length} cases missing vector search results.`)
  
  let improved = 0
  for (const c of cases) {
    const { results, via } = await findSimilarCases(c.summary)
    
    if (results.length > 0) {
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
      
      if (score > c.score_without_retrieval) improved++
      console.log(`Fixed Case ${c.uid} via ${via}: ${c.score_without_retrieval} -> ${score}`)
    }
  }
  
  console.log(`Done. ${improved} cases had improved scores.`)
  process.exit(0)
}
run()
