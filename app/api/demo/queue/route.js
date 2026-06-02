// GET /api/demo/queue — hardcoded 5-case demo queue, no auth required.
// agent_trace reflects the steps actually produced by lib/agent/orchestrator.js:
//   extract_facts, vector_search, score_urgency, write_recommendation (score >= 80 only)
// similar_cases use canonical format: { outcome, outcome_notes, similarity_score, year }
// mongodb_via is 'mongoose_fallback' — MCP_ENABLED=false in production.
export const dynamic = 'force-dynamic'

const TOMORROW_9AM = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
})()

const DEMO_CASES = [
  {
    id: 'demo-001',
    rank: 1,
    client_name: 'Rodriguez Family',
    case_type: 'eviction',
    summary: 'Family of four including two minor children facing eviction in 48 hours after landlord refused payment plan following primary earner hospitalization.',
    deadline_days: 2,
    vulnerability_flags: { minor_children: true, language_barrier: false, medical_condition: false },
    // computeScore: deadline(2→40) + vuln(minor_children→15) + eviction(18) + won@0.94(→15) = 88
    priority_score: 88,
    score_breakdown: { deadline_points: 40, vulnerability_points: 15, case_type_points: 18, similarity_points: 15 },
    priority_reason: 'Court date in 48 hours. Minor children at risk of housing loss. Similar cases won when represented.',
    recommendation: 'Assign immediately. Court appearance in 48 hours with two minor children present. Request emergency continuance and document the hospitalization with medical records.',
    similar_cases: [
      { outcome: 'won',     outcome_notes: 'Emergency continuance granted; family kept housing after payment plan negotiated', similarity_score: 0.94, year: 2024 },
      { outcome: 'won',     outcome_notes: 'Tenant given 60-day extension; housing authority intervened after minor children flagged', similarity_score: 0.87, year: 2023 },
      { outcome: 'settled', outcome_notes: 'Negotiated payment plan accepted by landlord; family remained housed', similarity_score: 0.79, year: 2022 },
    ],
    missing_info: [],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    outreach: {
      subject: 'Re: Your housing legal aid request',
      body: 'We have received your intake request regarding the eviction notice at your current residence. Your case has been flagged as high priority and a caseworker will contact you within 24 hours. Please bring a copy of your lease agreement and any written communications from your landlord to your appointment.',
      status: 'draft',
      draft_id: null,
      sent_at: null,
    },
    calendar: {
      event_id: 'demo-event-001',
      event_link: 'https://calendar.google.com/calendar/r',
      scheduled_at: TOMORROW_9AM,
      status: 'scheduled',
    },
    brief: {
      available: true,
      content: null,
      generated_at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    },
    // Steps produced by lib/agent/orchestrator.js for this case (score >= 80 → write_recommendation runs)
    agent_trace: [
      { name: 'extract_facts',       durationMs: 1180, output: { case_type: 'eviction', deadline_days: 2, missing_info_count: 0 } },
      { name: 'vector_search',       durationMs:  820, output: { results_found: 3, top_similarity: 0.94, top_outcome: 'won', mongodb_via: 'mongoose_fallback' } },
      { name: 'score_urgency',       durationMs:    1, output: { score: 88, breakdown: { deadline_points: 40, vulnerability_points: 15, case_type_points: 18, similarity_points: 15 } } },
      { name: 'write_recommendation', durationMs: 2340, output: { chars: 218 } },
    ],
    mongodb_via: 'mongoose_fallback',
  },
  {
    id: 'demo-002',
    rank: 2,
    client_name: 'Anh Nguyen',
    case_type: 'immigration',
    summary: 'Long-term resident of 19 years with final order of removal and 72-hour deadline to file motion to reopen after attorney error; US-born daughter has serious medical condition.',
    deadline_days: 3,
    vulnerability_flags: { minor_children: false, language_barrier: true, medical_condition: false },
    // computeScore: deadline(3→40) + vuln(language_barrier→10) + immigration(20) + won@0.88(→15) = 85
    priority_score: 85,
    score_breakdown: { deadline_points: 40, vulnerability_points: 10, case_type_points: 20, similarity_points: 15 },
    priority_reason: '72-hour deadline for motion to reopen. Attorney error creates strong grounds for relief. Language barrier present.',
    recommendation: "Assign to immigration specialist today. Attorney error at missed hearing is well-established grounds for motion to reopen — file immediately. Gather documentation of daughter's medical condition as hardship evidence.",
    similar_cases: [
      { outcome: 'won',     outcome_notes: 'Motion to reopen granted based on attorney ineffective assistance; removal order vacated', similarity_score: 0.88, year: 2024 },
      { outcome: 'won',     outcome_notes: 'Stay of removal granted; case remanded to immigration judge; client remains in country', similarity_score: 0.81, year: 2023 },
      { outcome: 'settled', outcome_notes: 'Voluntary departure granted with 90-day window; client relocated safely with family', similarity_score: 0.73, year: 2022 },
    ],
    missing_info: ['Attorney name and bar number for ineffective assistance claim'],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    outreach: {
      subject: 'Re: Your immigration legal aid request',
      body: 'Thank you for reaching out to our clinic regarding your immigration matter. Your case has been flagged as high priority and a caseworker will contact you within 24 hours.',
      status: 'draft',
      draft_id: null,
      sent_at: null,
    },
    calendar: {
      event_id: 'demo-event-002',
      event_link: 'https://calendar.google.com/calendar/r',
      scheduled_at: TOMORROW_9AM,
      status: 'scheduled',
    },
    brief: {
      available: true,
      content: null,
      generated_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    },
    // score 85 >= 80 → write_recommendation runs
    agent_trace: [
      { name: 'extract_facts',       durationMs: 1050, output: { case_type: 'immigration', deadline_days: 3, missing_info_count: 1 } },
      { name: 'vector_search',       durationMs:  790, output: { results_found: 3, top_similarity: 0.88, top_outcome: 'won', mongodb_via: 'mongoose_fallback' } },
      { name: 'score_urgency',       durationMs:    1, output: { score: 85 } },
      { name: 'write_recommendation', durationMs: 2210, output: { chars: 201 } },
    ],
    mongodb_via: 'mongoose_fallback',
  },
  {
    id: 'demo-003',
    rank: 3,
    client_name: 'Keisha Brown',
    case_type: 'custody',
    summary: 'Child not returned by ex-partner after scheduled visit 4 days ago; police report filed; emergency custody modification needed with 21-day family court wait.',
    deadline_days: 21,
    vulnerability_flags: { minor_children: true, language_barrier: false, medical_condition: false },
    // computeScore: deadline(21→0) + vuln(minor_children→15) + custody(10) + won@0.79(→8) = 33
    priority_score: 33,
    score_breakdown: { deadline_points: 0, vulnerability_points: 15, case_type_points: 10, similarity_points: 8 },
    priority_reason: 'Child may be in unsafe situation. Emergency ex parte motion may bypass the 21-day docket.',
    // score < 80 → write_recommendation does not run in production; recommendation is advisory note
    recommendation: null,
    similar_cases: [
      { outcome: 'won', outcome_notes: 'Emergency ex parte granted same day; child returned within 24 hours', similarity_score: 0.79, year: 2024 },
      { outcome: 'won', outcome_notes: 'Emergency hearing granted within 48 hours; supervised visitation ordered pending full hearing', similarity_score: 0.74, year: 2023 },
      { outcome: 'won', outcome_notes: 'Police report elevated case priority; primary custody awarded at emergency hearing', similarity_score: 0.68, year: 2022 },
    ],
    missing_info: ['Details of any prior custody order'],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    outreach: {
      subject: 'Re: Your family law request',
      body: "Thank you for contacting our clinic about your custody matter. We have received your intake request and will review it shortly.",
      status: 'draft',
      draft_id: null,
      sent_at: null,
    },
    calendar: {
      event_id: 'demo-event-003',
      event_link: 'https://calendar.google.com/calendar/r',
      scheduled_at: TOMORROW_9AM,
      status: 'scheduled',
    },
    brief: { available: false, content: null, generated_at: null },
    agent_trace: [
      { name: 'extract_facts', durationMs: 990, output: { case_type: 'custody', deadline_days: 21, missing_info_count: 1 } },
      { name: 'vector_search', durationMs: 810, output: { results_found: 3, top_similarity: 0.79, top_outcome: 'won', mongodb_via: 'mongoose_fallback' } },
      { name: 'score_urgency', durationMs:   1, output: { score: 33 } },
    ],
    mongodb_via: 'mongoose_fallback',
  },
  {
    id: 'demo-004',
    rank: 4,
    client_name: 'Marcus Webb',
    case_type: 'wage_theft',
    summary: 'Terminated without final two weeks wages; employer has documented state labor violations history; 14-day window to file with labor commissioner before employer closes.',
    deadline_days: 14,
    vulnerability_flags: { minor_children: false, language_barrier: false, medical_condition: false },
    // computeScore: deadline(14→15) + vuln(0) + wage_theft(12) + won@0.82(→8) = 35
    priority_score: 35,
    score_breakdown: { deadline_points: 15, vulnerability_points: 0, case_type_points: 12, similarity_points: 8 },
    priority_reason: 'Employer closing imminently. Documented violation history strengthens claim significantly.',
    // score < 80 → write_recommendation does not run
    recommendation: null,
    similar_cases: [
      { outcome: 'won',     outcome_notes: 'Full wages recovered plus penalties; employer had prior violation history', similarity_score: 0.82, year: 2024 },
      { outcome: 'won',     outcome_notes: 'Labor commissioner ruled in favor; employer paid back wages plus 25% penalty', similarity_score: 0.77, year: 2023 },
      { outcome: 'settled', outcome_notes: 'Pre-hearing settlement; 85% of unpaid wages recovered before employer dissolved', similarity_score: 0.71, year: 2022 },
    ],
    missing_info: ['Pay stubs or employment contract'],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    outreach: {
      subject: 'Re: Your wage claim request',
      body: 'We have received your intake request regarding unpaid wages. We are reviewing your case and will be in touch shortly.',
      status: 'draft',
      draft_id: null,
      sent_at: null,
    },
    calendar: { event_id: null, event_link: null, scheduled_at: null, status: 'none' },
    brief: { available: false, content: null, generated_at: null },
    agent_trace: [
      { name: 'extract_facts', durationMs: 1010, output: { case_type: 'wage_theft', deadline_days: 14, missing_info_count: 1 } },
      { name: 'vector_search', durationMs:  770, output: { results_found: 3, top_similarity: 0.82, top_outcome: 'won', mongodb_via: 'mongoose_fallback' } },
      { name: 'score_urgency', durationMs:    1, output: { score: 35 } },
    ],
    mongodb_via: 'mongoose_fallback',
  },
  {
    id: 'demo-005',
    rank: 5,
    client_name: 'Jin Park',
    case_type: 'employment',
    summary: 'Constructively dismissed after raising safety violations; employer withheld COBRA notice and final paycheck; 30 days until statute of limitations on wrongful termination.',
    deadline_days: 30,
    vulnerability_flags: { minor_children: false, language_barrier: false, medical_condition: false },
    // computeScore: deadline(30→0) + vuln(0) + employment(8) + won@0.76(→8) = 16
    priority_score: 16,
    score_breakdown: { deadline_points: 0, vulnerability_points: 0, case_type_points: 8, similarity_points: 8 },
    priority_reason: '30-day window before limitations period. COBRA and final paycheck violations add additional claims.',
    // score < 80 → write_recommendation does not run
    recommendation: null,
    similar_cases: [
      { outcome: 'won',     outcome_notes: 'Wrongful termination upheld; 6-month wage settlement plus attorney fees', similarity_score: 0.76, year: 2024 },
      { outcome: 'settled', outcome_notes: 'COBRA violation settled; employer paid retroactive coverage plus 3-month penalty', similarity_score: 0.69, year: 2023 },
      { outcome: 'won',     outcome_notes: 'Retaliation claim successful; final paycheck and COBRA notice recovered with statutory interest', similarity_score: 0.61, year: 2022 },
    ],
    missing_info: ['Written records of safety complaints to HR', 'Date of termination'],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    outreach: {
      subject: 'Re: Your employment legal aid request',
      body: 'We have received your intake request regarding your termination. We are reviewing your case and will be in touch shortly.',
      status: 'draft',
      draft_id: null,
      sent_at: null,
    },
    calendar: { event_id: null, event_link: null, scheduled_at: null, status: 'none' },
    brief: { available: false, content: null, generated_at: null },
    agent_trace: [
      { name: 'extract_facts', durationMs: 970, output: { case_type: 'employment', deadline_days: 30, missing_info_count: 2 } },
      { name: 'vector_search', durationMs: 750, output: { results_found: 3, top_similarity: 0.76, top_outcome: 'won', mongodb_via: 'mongoose_fallback' } },
      { name: 'score_urgency', durationMs:   1, output: { score: 16 } },
    ],
    mongodb_via: 'mongoose_fallback',
  },
]

export async function GET() {
  return Response.json({ cases: DEMO_CASES, demo: true })
}
