// POST /api/seed/past-cases
// Seeds the past_cases collection with historical legal aid case outcomes
// and generates Voyage AI embeddings (description_embedding) for Atlas $vectorSearch.
//
// Two corpus options:
//   Default: 30 synthetic cases (representative patterns, immediate availability)
//   Real:    60 cases built from CourtListener public legal opinions via:
//              npm run build:corpus  → generates seed/data/past_cases_real.json
//              Then copy to seed/data/past_cases.json before seeding
//            Attribution: CourtListener / Free Law Project (courtlistener.com)
//
// Prerequisites:
//   1. GOOGLE_CLOUD_PROJECT_ID + OAuth creds set (Vertex AI text-embedding-004)
//      No VOYAGE_API_KEY needed — embeddings now use Vertex AI (same GCP project)
//   2. Atlas Vector Search index "description_embedding_index" created on the
//      past_cases collection with path "description_embedding" (768 dims, cosine)
//
// Run once after deployment: POST /api/seed/past-cases (authenticated)
//
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

import { verifyToken } from '../../../../lib/verifyToken.js'
import { apiError }    from '../../../../lib/apiError.js'
import { connectDB }   from '../../../../lib/mongodb.js'
import { getEmbedding } from '../../../../lib/vectorSearch.js'
import mongoose from 'mongoose'

// ── Historical case outcomes — realistic legal aid case data ─────────────────
// Each description is written as dense semantic text (≈ what a case summary
// looks like) so that Voyage AI embeddings capture the fact pattern accurately.
const PAST_CASES = [
  // ── EVICTION ──────────────────────────────────────────────────────────────
  {
    case_type: 'eviction',
    description: 'Single mother with two minor children ages 4 and 7 facing eviction for three months of unpaid rent following sudden job loss. Landlord filed unlawful detainer. Tenant holds a Section 8 housing voucher. Landlord failed to provide HUD-required 30-day notice prior to filing.',
    outcome: 'won',
    outcome_notes: 'Won on procedural grounds — landlord failed to comply with HUD notice requirements. Tenant retained housing. Lease reinstated with repayment plan.',
    year: 2024,
  },
  {
    case_type: 'eviction',
    description: 'Elderly tenant, 74 years old, residing in rent-controlled apartment for 19 years. Landlord claims owner move-in eviction but purchased building only three months prior. Tenant has no family support network and limited mobility.',
    outcome: 'settled',
    outcome_notes: 'Settled for $12,000 relocation assistance. Landlord could not demonstrate bona fide intent to occupy within statutory timeframe.',
    year: 2023,
  },
  {
    case_type: 'eviction',
    description: 'Domestic violence survivor fled apartment after documented assault with police report and emergency protective order. Landlord filing eviction for abandonment and unpaid rent during shelter stay.',
    outcome: 'won',
    outcome_notes: 'Won under state domestic violence tenant protection statutes. Lease terminated without penalty. Security deposit returned in full.',
    year: 2024,
  },
  {
    case_type: 'eviction',
    description: 'Family of five facing eviction for alleged lease violation — unauthorized occupant. Tenant argues occupant is an undocumented family member who moved in temporarily during medical crisis. Two children enrolled in local school.',
    outcome: 'settled',
    outcome_notes: 'Negotiated lease amendment adding the occupant as authorized. Eviction withdrawn. Tenant avoided displacement during school year.',
    year: 2022,
  },
  {
    case_type: 'eviction',
    description: 'Tenant with documented serious mental illness facing eviction following repeated neighbor noise complaints. Landlord did not engage in any interactive reasonable accommodation process under the Fair Housing Act prior to filing.',
    outcome: 'won',
    outcome_notes: 'Won on Fair Housing Act failure-to-accommodate claim. Court required landlord to engage in interactive process and offer reasonable accommodation plan.',
    year: 2023,
  },

  // ── IMMIGRATION ───────────────────────────────────────────────────────────
  {
    case_type: 'immigration',
    description: 'Honduran asylum seeker with documented gang-based political persecution. Credible fear interview passed. Immigration judge hearing scheduled in 45 days. Client requires Spanish interpreter. No prior legal representation.',
    outcome: 'won',
    outcome_notes: 'Asylum granted. Immigration judge found well-founded fear of persecution on account of political opinion. Client granted lawful permanent resident status after one year.',
    year: 2024,
  },
  {
    case_type: 'immigration',
    description: 'DACA recipient with renewal application denied following policy change, now facing removal proceedings. Has US citizen spouse and two children born in the US. Prior employer willing to sponsor H-1B petition. 60-day grace period actively running.',
    outcome: 'won',
    outcome_notes: 'H-1B approved with employer sponsorship filed within grace period. Removal proceedings administratively closed. Client now on path to adjustment of status.',
    year: 2023,
  },
  {
    case_type: 'immigration',
    description: 'Undocumented father of three US citizen children. ICE detainer issued following minor traffic stop. Bond hearing required within days. Family at immediate risk of separation. Client has no criminal history.',
    outcome: 'settled',
    outcome_notes: 'Bond set at $5,000, paid by community fund. Case continues with adjustment of status filed through US citizen spouse. Family remains together.',
    year: 2024,
  },
  {
    case_type: 'immigration',
    description: 'TPS holder from El Salvador with 12 years of continuous US residence. Work permit expiring. Program termination challenged in federal district court. Client has US-born children and established small business employing six people.',
    outcome: 'won',
    outcome_notes: 'TPS protected by federal injunction pending appeal. Work authorization extended. Client continued operating business without interruption.',
    year: 2023,
  },
  {
    case_type: 'immigration',
    description: 'Vietnamese refugee seeking derivative asylum for adult son left behind when father was resettled eight years ago. Son now faces persecution from government authorities. Derivative claim has complications due to aging out of minor status.',
    outcome: 'declined',
    outcome_notes: 'Case declined after intake — complexity of aged-out derivative claims exceeded clinic capacity. Referred to specialized immigration law clinic with expertise in complex family reunification.',
    year: 2022,
  },

  // ── CUSTODY ───────────────────────────────────────────────────────────────
  {
    case_type: 'custody',
    description: 'Mother seeking emergency custody modification after father tested positive for methamphetamine during custody exchange in front of child age 6. Child protective services report filed. Father refusing to participate in drug testing as required by existing custody order.',
    outcome: 'won',
    outcome_notes: 'Emergency temporary order granted within 48 hours. Supervised visits only until father completes 90-day substance abuse treatment program and passes three consecutive drug tests.',
    year: 2024,
  },
  {
    case_type: 'custody',
    description: 'Father seeking modification of custody order after mother relocated 380 miles away to new partner\'s residence without notice or consent. Existing order requires written consent for any relocation. Child missing school and established social connections.',
    outcome: 'won',
    outcome_notes: 'Return order granted. Mother ordered to return to original jurisdiction within 30 days. Custody schedule modified to reflect school calendar and father\'s work schedule.',
    year: 2023,
  },
  {
    case_type: 'custody',
    description: 'Maternal grandparents seeking legal guardianship of two grandchildren ages 3 and 5 after both parents incarcerated on drug-related charges. Children currently in foster care system and expressing strong desire to live with grandparents.',
    outcome: 'won',
    outcome_notes: 'Guardianship granted to grandparents. Children placed in familiar family environment. Court issued monthly financial support order from state.',
    year: 2024,
  },
  {
    case_type: 'custody',
    description: 'Domestic violence victim seeking custody modification to restrict ex-spouse to supervised visitation only. Multiple documented incidents of violence witnessed by child age 9. Child exhibiting behavioral changes at school following incidents.',
    outcome: 'won',
    outcome_notes: 'Modification granted. Unsupervised contact prohibited. Supervised visits required at certified facility with trained monitor. Child enrolled in trauma-informed counseling.',
    year: 2023,
  },
  {
    case_type: 'custody',
    description: 'Non-custodial parent disputing school enrollment decision. Custodial parent enrolled child in school 40 miles from prior residence without agreement. Change significantly disrupts existing visitation logistics and child\'s established friendships.',
    outcome: 'settled',
    outcome_notes: 'Mediation resulted in transfer to compromise school location. Transportation cost-sharing agreement reached. Both parties enrolled in co-parenting communication program.',
    year: 2022,
  },

  // ── WAGE THEFT ────────────────────────────────────────────────────────────
  {
    case_type: 'wage_theft',
    description: 'Restaurant worker owed $16,200 in unpaid overtime accumulated over 22 months. Employer improperly applied tip credit to reduce base wage below federal minimum wage. Forty-seven documented FLSA violations across pay periods.',
    outcome: 'won',
    outcome_notes: 'Won with treble damages under FLSA. Total recovery $48,600 including liquidated damages and attorney fees. Employer required to correct pay practices for all tipped employees.',
    year: 2024,
  },
  {
    case_type: 'wage_theft',
    description: 'Construction worker misclassified as independent contractor by general contractor for three years. Employer controlled all conditions of work, hours, equipment, and work locations. Worker owed minimum wage, overtime pay, and denied benefits.',
    outcome: 'won',
    outcome_notes: 'Court found employer-employee relationship under economic realities test. Back wages of $31,400 awarded plus civil penalties.',
    year: 2023,
  },
  {
    case_type: 'wage_theft',
    description: 'Live-in domestic worker paid $4.50 per hour for 60-hour work weeks over 18 months. Employer used client\'s undocumented immigration status as leverage to prevent wage complaint filing and intimidate her into silence.',
    outcome: 'won',
    outcome_notes: 'Full back wages of $22,800 awarded. Court held immigration status irrelevant to wage and hour claims. Employer sanctioned for threatening witness.',
    year: 2024,
  },
  {
    case_type: 'wage_theft',
    description: 'Retail store manager misclassified as overtime-exempt executive employee under FLSA. Time study demonstrated manager spent 85% of shift hours performing non-managerial hourly work alongside subordinates.',
    outcome: 'settled',
    outcome_notes: 'Settled for $28,500 representing 18 months of unpaid overtime. Employer reclassified the managerial role and adjusted job descriptions company-wide.',
    year: 2023,
  },
  {
    case_type: 'wage_theft',
    description: 'Class of 34 farm workers not compensated for mandatory pre-shift equipment inspection time and daily travel between worksites owned by same employer. Employer claimed portal-to-portal exemption. Workers averaging 45 minutes unpaid daily.',
    outcome: 'won',
    outcome_notes: 'Both pre-shift time and inter-site travel ruled compensable as integral to employment. Class recovery totaling $187,000. Average per-worker recovery $5,500.',
    year: 2022,
  },

  // ── DOMESTIC VIOLENCE ─────────────────────────────────────────────────────
  {
    case_type: 'domestic_violence',
    description: 'Victim of repeated physical abuse with medical records from emergency room and police reports documenting three separate incidents over six months. Two children in home ages 4 and 8. Abuser controls all household finances and housing, leaving victim with no independent resources.',
    outcome: 'won',
    outcome_notes: 'Full protective order granted for three years. Emergency housing voucher obtained. Safety planning conducted. Financial independence plan implemented with credit counseling.',
    year: 2024,
  },
  {
    case_type: 'domestic_violence',
    description: 'Economic abuse case. Victim has no independent access to bank accounts, identification documents, or mobile phone. Abuser monitors all communications. Client reached out through neighbor. Minor child also isolated from peers and extended family.',
    outcome: 'won',
    outcome_notes: 'Emergency protective order granted same day. Financial advocacy team recovered access to accounts. New housing and employment obtained within 60 days. Child enrolled in therapy.',
    year: 2024,
  },
  {
    case_type: 'domestic_violence',
    description: 'Immigrant victim of two-year documented abuse pattern. Abuser repeatedly threatened to report undocumented immigration status to ICE if victim sought help from authorities. Victim has photographs, medical records, and neighbor witness statements.',
    outcome: 'won',
    outcome_notes: 'VAWA self-petition filed. U-Visa law enforcement certification obtained. Abuser prosecuted criminally. Victim obtained independent immigration status.',
    year: 2023,
  },
  {
    case_type: 'domestic_violence',
    description: 'Victim with physical disability whose intimate partner was also her primary daily caregiver. Requires wheelchair assistance for mobility. Leaving abuser means immediate loss of daily care and housing. Adult protective services involved in case.',
    outcome: 'won',
    outcome_notes: 'Emergency protective order granted. Coordination with county disability services secured nursing facility placement within 72 hours. New independent caregiver arranged.',
    year: 2023,
  },
  {
    case_type: 'domestic_violence',
    description: 'Same-sex relationship domestic violence case. Victim hesitant to involve legal system due to fear of discrimination and outing. Documented pattern of digital harassment, location tracking, stalking, and two physical assaults with photographic evidence.',
    outcome: 'won',
    outcome_notes: 'Protective order granted. Court demonstrated sensitivity to relationship dynamics. Victim connected with LGBTQ+-specific domestic violence services and safe housing.',
    year: 2024,
  },

  // ── EMPLOYMENT ────────────────────────────────────────────────────────────
  {
    case_type: 'employment',
    description: 'Warehouse employee wrongfully terminated two weeks after filing formal OSHA complaint about hazardous chemical storage practices. Timeline and documented supervisor retaliation motive are unambiguous. No performance issues existed prior to complaint.',
    outcome: 'won',
    outcome_notes: 'OSHA retaliation complaint upheld. Reinstatement ordered with full back pay covering 8 months of lost wages. $15,000 compensatory damages awarded.',
    year: 2024,
  },
  {
    case_type: 'employment',
    description: 'Pregnant employee terminated following performance review meeting where she announced her pregnancy. Prior performance reviews had all been positive or exceeding expectations. No documented performance concerns existed before the announcement.',
    outcome: 'settled',
    outcome_notes: 'Settled for $42,000 following EEOC right-to-sue letter. Employer updated HR policies and provided mandatory supervisor training on pregnancy accommodation.',
    year: 2023,
  },
  {
    case_type: 'employment',
    description: 'Diabetic employee with Type 1 diabetes refused reasonable workplace accommodation for insulin administration and blood glucose monitoring breaks during 8-hour warehouse shifts. Manager actively disciplined employee for medical absences required for diabetes management.',
    outcome: 'won',
    outcome_notes: 'ADA reasonable accommodation ordered. Employer required to provide 15-minute breaks for diabetes management. Disciplinary records expunged. $8,500 damages for pain and suffering.',
    year: 2024,
  },
  {
    case_type: 'employment',
    description: 'Female employee subjected to two years of pervasive sexual harassment by direct supervisor. Human resources received three written complaints from the employee. No investigation was conducted and no corrective action was taken. Hostile work environment continued.',
    outcome: 'settled',
    outcome_notes: 'Settled for $95,000 under Title VII. Supervisor terminated by employer following settlement. Company-wide mandatory harassment prevention training implemented.',
    year: 2023,
  },
  {
    case_type: 'employment',
    description: 'Group of seven employees all over age 55 terminated in single layoff event while younger workers performing identical roles in the same department were retained. Employer claims terminations based on performance but documentation is inconsistent and internally contradictory.',
    outcome: 'won',
    outcome_notes: 'ADEA class action prevailed. Statistical pattern of age discrimination established by expert witness. Average recovery $38,000 per class member plus attorney fees.',
    year: 2024,
  },
]

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    await verifyToken(request)
  } catch {
    return apiError('Unauthorized', 401)
  }

  // This endpoint modifies a shared collection — restrict to admin-level use
  // by requiring an explicit confirmation header to prevent accidental execution
  const confirmed = request.headers.get('x-seed-confirm')
  if (confirmed !== 'yes') {
    return apiError(
      'Add header x-seed-confirm: yes to confirm seeding. This operation will clear existing seeded cases.',
      400
    )
  }

  try {
    await connectDB()
    const collection = mongoose.connection.db.collection('past_cases')

    // Clear previously seeded cases only (preserves any manually-added cases)
    const deleteResult = await collection.deleteMany({ _seeded: true })

    const results = []
    const errors  = []

    // Process in batches of 5 (Vertex AI rate limiting is generous; batch size is conservative)
    const BATCH = 5
    for (let i = 0; i < PAST_CASES.length; i += BATCH) {
      const batch = PAST_CASES.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        batch.map(async (c) => {
          let description_embedding = null
          try {
            description_embedding = await getEmbedding(c.description)
          } catch (embErr) {
            // Embedding failed — insert without embedding.
            // Likely cause: GOOGLE_CLOUD_PROJECT_ID missing or OAuth token expired.
            // The document will exist in the collection but $vectorSearch won't return it.
            errors.push({ case_type: c.case_type, error: embErr.message })
          }
          return {
            case_type:   c.case_type,
            description: c.description,
            outcome:     c.outcome,
            outcome_notes: c.outcome_notes,
            year:        c.year,
            ...(description_embedding ? { description_embedding } : {}),
            _seeded:     true,
            createdAt:   new Date(),
          }
        })
      )
      for (const s of settled) {
        if (s.status === 'fulfilled') results.push(s.value)
        else errors.push({ error: s.reason?.message ?? String(s.reason) })
      }
    }

    if (results.length > 0) {
      await collection.insertMany(results, { ordered: false })
    }

    const withEmbeddings = results.filter((r) => !!r.description_embedding).length

    return Response.json({
      seeded:           results.length,
      with_embeddings:  withEmbeddings,
      without_embeddings: results.length - withEmbeddings,
      errors:           errors.length,
      deleted_previous: deleteResult.deletedCount,
      message:          withEmbeddings === results.length
        ? `${results.length} historical cases seeded with Voyage AI embeddings. Atlas $vectorSearch is ready.`
        : withEmbeddings > 0
          ? `${results.length} cases seeded; ${withEmbeddings} with embeddings, ${results.length - withEmbeddings} without (Vertex AI embedding error — check GOOGLE_CLOUD_PROJECT_ID and OAuth credentials).`
          : `${results.length} cases inserted WITHOUT embeddings — Vertex AI embedding call failed. Verify GOOGLE_CLOUD_PROJECT_ID and OAuth token are set.`,
      next_steps: withEmbeddings < results.length
        ? ['Verify GOOGLE_CLOUD_PROJECT_ID env var', 'Check GOOGLE_OAUTH_REFRESH_TOKEN is valid', 'Re-run POST /api/seed/past-cases']
        : ['Verify Atlas Search index "description_embedding_index" exists on past_cases collection with path: description_embedding, dimensions: 768, similarity: cosine'],
    })

  } catch (err) {
    console.error('[seed/past-cases POST]', err.message)
    return apiError(`Seeding failed: ${err.message}`, 500)
  }
}
