// POST /api/admin/seed-corpus
// One-time admin endpoint — seeds past_cases WITHOUT requiring a Firebase token.
// Auth: x-admin-key header must match ADMIN_SEED_KEY env var.
//
// Set ADMIN_SEED_KEY in Vercel: any random string, e.g. openssl rand -hex 20
// Then: curl -X POST https://your-app.vercel.app/api/admin/seed-corpus
//            -H "x-admin-key: YOUR_KEY" -H "x-seed-confirm: yes"
//
// Delete this file after seeding is confirmed.
export const maxDuration = 60
export const dynamic     = 'force-dynamic'

import { connectDB }   from '../../../../lib/mongodb.js'
import { getEmbedding } from '../../../../lib/vectorSearch.js'
import mongoose from 'mongoose'

const PAST_CASES = [
  { case_type:'eviction',    outcome:'won',     year:2024, description:'Single mother with two minor children ages 4 and 7 facing eviction for three months of unpaid rent following sudden job loss. Landlord filed unlawful detainer. Tenant holds a Section 8 housing voucher. Landlord failed to provide HUD-required 30-day notice prior to filing.', outcome_notes:'Won on procedural grounds — landlord failed to comply with HUD notice requirements. Tenant retained housing. Lease reinstated with repayment plan.' },
  { case_type:'eviction',    outcome:'settled', year:2023, description:'Elderly tenant, 74 years old, residing in rent-controlled apartment for 19 years. Landlord claims owner move-in eviction but purchased building only three months prior. Tenant has no family support network and limited mobility.', outcome_notes:'Settled for $12,000 relocation assistance.' },
  { case_type:'eviction',    outcome:'won',     year:2024, description:'Domestic violence survivor fled apartment after documented assault with police report and emergency protective order. Landlord filing eviction for abandonment and unpaid rent during shelter stay.', outcome_notes:'Won under state domestic violence tenant protection statutes. Lease terminated without penalty.' },
  { case_type:'eviction',    outcome:'settled', year:2022, description:'Family of five facing eviction for alleged lease violation — unauthorized occupant. Tenant argues occupant is an undocumented family member who moved in temporarily during medical crisis. Two children enrolled in local school.', outcome_notes:'Negotiated lease amendment adding the occupant as authorized. Eviction withdrawn.' },
  { case_type:'eviction',    outcome:'won',     year:2023, description:'Tenant with documented serious mental illness facing eviction following repeated neighbor noise complaints. Landlord did not engage in any interactive reasonable accommodation process under the Fair Housing Act prior to filing.', outcome_notes:'Won on Fair Housing Act failure-to-accommodate claim.' },
  { case_type:'immigration', outcome:'won',     year:2024, description:'Honduran asylum seeker with documented gang-based political persecution. Credible fear interview passed. Immigration judge hearing scheduled in 45 days. Client requires Spanish interpreter. No prior legal representation.', outcome_notes:'Asylum granted. Immigration judge found well-founded fear of persecution on account of political opinion.' },
  { case_type:'immigration', outcome:'won',     year:2023, description:'DACA recipient with renewal application denied following policy change, now facing removal proceedings. Has US citizen spouse and two children born in the US. Prior employer willing to sponsor H-1B petition. 60-day grace period actively running.', outcome_notes:'H-1B approved with employer sponsorship filed within grace period. Removal proceedings administratively closed.' },
  { case_type:'immigration', outcome:'settled', year:2024, description:'Undocumented father of three US citizen children. ICE detainer issued following minor traffic stop. Bond hearing required within days. Family at immediate risk of separation. Client has no criminal history.', outcome_notes:'Bond set at $5,000, paid by community fund. Case continues with adjustment of status.' },
  { case_type:'immigration', outcome:'won',     year:2023, description:'TPS holder from El Salvador with 12 years of continuous US residence. Work permit expiring. Program termination challenged in federal district court. Client has US-born children and established small business employing six people.', outcome_notes:'TPS protected by federal injunction pending appeal. Work authorization extended.' },
  { case_type:'immigration', outcome:'declined',year:2022, description:'Vietnamese refugee seeking derivative asylum for adult son left behind when father was resettled eight years ago. Son now faces persecution from government authorities. Derivative claim has complications due to aging out of minor status.', outcome_notes:'Case declined after intake — complexity exceeded clinic capacity. Referred to specialized immigration law clinic.' },
  { case_type:'custody',     outcome:'won',     year:2024, description:'Mother seeking emergency custody modification after father tested positive for methamphetamine during custody exchange in front of child age 6. Child protective services report filed. Father refusing to participate in drug testing.', outcome_notes:'Emergency temporary order granted within 48 hours. Supervised visits only.' },
  { case_type:'custody',     outcome:'won',     year:2023, description:'Father seeking modification of custody order after mother relocated 380 miles away to new partner\'s residence without notice or consent. Existing order requires written consent for any relocation.', outcome_notes:'Return order granted. Mother ordered to return to original jurisdiction within 30 days.' },
  { case_type:'custody',     outcome:'won',     year:2024, description:'Maternal grandparents seeking legal guardianship of two grandchildren ages 3 and 5 after both parents incarcerated on drug-related charges. Children currently in foster care system.', outcome_notes:'Guardianship granted to grandparents. Children placed in familiar family environment.' },
  { case_type:'custody',     outcome:'won',     year:2023, description:'Domestic violence victim seeking custody modification to restrict ex-spouse to supervised visitation only. Multiple documented incidents of violence witnessed by child age 9. Child exhibiting behavioral changes at school.', outcome_notes:'Modification granted. Unsupervised contact prohibited. Supervised visits required at certified facility.' },
  { case_type:'custody',     outcome:'settled', year:2022, description:'Non-custodial parent disputing school enrollment decision. Custodial parent enrolled child in school 40 miles from prior residence without agreement. Change significantly disrupts existing visitation logistics.', outcome_notes:'Mediation resulted in transfer to compromise school location. Transportation cost-sharing agreement reached.' },
  { case_type:'wage_theft',  outcome:'won',     year:2024, description:'Restaurant worker owed $16,200 in unpaid overtime accumulated over 22 months. Employer improperly applied tip credit to reduce base wage below federal minimum wage. Forty-seven documented FLSA violations across pay periods.', outcome_notes:'Won with treble damages under FLSA. Total recovery $48,600.' },
  { case_type:'wage_theft',  outcome:'won',     year:2023, description:'Construction worker misclassified as independent contractor by general contractor for three years. Employer controlled all conditions of work, hours, equipment, and work locations. Worker owed minimum wage and overtime pay.', outcome_notes:'Court found employer-employee relationship under economic realities test. Back wages of $31,400 awarded.' },
  { case_type:'wage_theft',  outcome:'won',     year:2024, description:'Live-in domestic worker paid $4.50 per hour for 60-hour work weeks over 18 months. Employer used client\'s undocumented immigration status as leverage to prevent wage complaint filing.', outcome_notes:'Full back wages of $22,800 awarded. Immigration status ruled irrelevant to wage and hour claims.' },
  { case_type:'wage_theft',  outcome:'settled', year:2023, description:'Retail store manager misclassified as overtime-exempt executive employee under FLSA. Time study demonstrated manager spent 85% of shift hours performing non-managerial hourly work alongside subordinates.', outcome_notes:'Settled for $28,500 representing 18 months of unpaid overtime.' },
  { case_type:'wage_theft',  outcome:'won',     year:2022, description:'Class of 34 farm workers not compensated for mandatory pre-shift equipment inspection time and daily travel between worksites owned by same employer. Workers averaging 45 minutes unpaid daily.', outcome_notes:'Both pre-shift time and inter-site travel ruled compensable. Class recovery totaling $187,000.' },
  { case_type:'domestic_violence', outcome:'won', year:2024, description:'Victim of repeated physical abuse with medical records from emergency room and police reports documenting three separate incidents over six months. Two children in home ages 4 and 8. Abuser controls all household finances.', outcome_notes:'Full protective order granted for three years. Emergency housing voucher obtained.' },
  { case_type:'domestic_violence', outcome:'won', year:2024, description:'Economic abuse case. Victim has no independent access to bank accounts, identification documents, or mobile phone. Abuser monitors all communications. Minor child also isolated from peers and extended family.', outcome_notes:'Emergency protective order granted same day. Financial advocacy team recovered access to accounts.' },
  { case_type:'domestic_violence', outcome:'won', year:2023, description:'Immigrant victim of two-year documented abuse pattern. Abuser repeatedly threatened to report undocumented immigration status to ICE if victim sought help from authorities. Victim has photographs, medical records, and neighbor witness statements.', outcome_notes:'VAWA self-petition filed. U-Visa law enforcement certification obtained. Victim obtained independent immigration status.' },
  { case_type:'domestic_violence', outcome:'won', year:2023, description:'Victim with physical disability whose intimate partner was also her primary daily caregiver. Requires wheelchair assistance for mobility. Leaving abuser means immediate loss of daily care and housing.', outcome_notes:'Emergency protective order granted. Coordination with county disability services secured nursing facility placement.' },
  { case_type:'domestic_violence', outcome:'won', year:2024, description:'Same-sex relationship domestic violence case. Victim hesitant to involve legal system due to fear of discrimination and outing. Documented pattern of digital harassment, location tracking, stalking, and two physical assaults.', outcome_notes:'Protective order granted. Victim connected with LGBTQ+-specific domestic violence services and safe housing.' },
  { case_type:'employment',  outcome:'won',     year:2024, description:'Warehouse employee wrongfully terminated two weeks after filing formal OSHA complaint about hazardous chemical storage practices. Timeline and documented supervisor retaliation motive are unambiguous. No prior performance issues.', outcome_notes:'OSHA retaliation complaint upheld. Reinstatement ordered with full back pay covering 8 months. $15,000 compensatory damages.' },
  { case_type:'employment',  outcome:'settled', year:2023, description:'Pregnant employee terminated following performance review meeting where she announced her pregnancy. Prior performance reviews had all been positive or exceeding expectations.', outcome_notes:'Settled for $42,000 following EEOC right-to-sue letter. Employer updated HR policies.' },
  { case_type:'employment',  outcome:'won',     year:2024, description:'Diabetic employee with Type 1 diabetes refused reasonable workplace accommodation for insulin administration and blood glucose monitoring breaks during 8-hour warehouse shifts.', outcome_notes:'ADA reasonable accommodation ordered. Disciplinary records expunged. $8,500 damages.' },
  { case_type:'employment',  outcome:'settled', year:2023, description:'Female employee subjected to two years of pervasive sexual harassment by direct supervisor. Human resources received three written complaints from the employee. No investigation was conducted and no corrective action was taken.', outcome_notes:'Settled for $95,000 under Title VII. Supervisor terminated. Company-wide harassment training implemented.' },
  { case_type:'employment',  outcome:'won',     year:2024, description:'Group of seven employees all over age 55 terminated in single layoff event while younger workers performing identical roles in the same department were retained. Documentation internally contradictory.', outcome_notes:'ADEA class action prevailed. Statistical pattern of age discrimination established. Average recovery $38,000 per class member.' },
]

export async function POST(request) {
  // Admin key auth — no Firebase required
  const adminKey = request.headers.get('x-admin-key')
  const envKey   = process.env.ADMIN_SEED_KEY

  if (!envKey) {
    return Response.json({ error: 'ADMIN_SEED_KEY env var not set in Vercel. Add it first.' }, { status: 500 })
  }
  if (adminKey !== envKey) {
    return Response.json({ error: 'Invalid x-admin-key header' }, { status: 401 })
  }
  if (request.headers.get('x-seed-confirm') !== 'yes') {
    return Response.json({ error: 'Add header x-seed-confirm: yes' }, { status: 400 })
  }

  try {
    await connectDB()
    const collection = mongoose.connection.db.collection('past_cases')

    await collection.deleteMany({ _seeded: true })

    const results = []
    const errors  = []
    const BATCH   = 5

    for (let i = 0; i < PAST_CASES.length; i += BATCH) {
      const batch = PAST_CASES.slice(i, i + BATCH)
      const settled = await Promise.allSettled(batch.map(async (c) => {
        let description_embedding = null
        try {
          description_embedding = await getEmbedding(c.description)
        } catch (e) {
          errors.push({ case_type: c.case_type, error: e.message })
        }
        return { ...c, ...(description_embedding ? { description_embedding } : {}), _seeded: true, createdAt: new Date() }
      }))
      for (const s of settled) {
        if (s.status === 'fulfilled') results.push(s.value)
        else errors.push({ error: s.reason?.message })
      }
    }

    if (results.length > 0) await collection.insertMany(results, { ordered: false })

    const withEmbeddings = results.filter(r => !!r.description_embedding).length

    return Response.json({
      seeded:             results.length,
      with_embeddings:    withEmbeddings,
      without_embeddings: results.length - withEmbeddings,
      errors:             errors.length,
      error_details:      errors.slice(0, 3),
      verdict: withEmbeddings === 30
        ? 'PASS — corpus ready, vector search active'
        : withEmbeddings > 0
        ? 'PARTIAL — some embeddings missing, check GOOGLE_CLOUD_PROJECT_ID'
        : 'FAIL — no embeddings, check Vertex AI credentials',
      next: 'Run GET /api/health/vector-search to confirm index status',
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
