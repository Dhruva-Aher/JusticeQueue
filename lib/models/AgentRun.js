import mongoose from 'mongoose'

const stepSchema = new mongoose.Schema({
  id:          { type: String },
  label:       { type: String },
  tool:        { type: String },
  status:      { type: String, default: 'complete' },
  started_ms:  { type: Number },   // ms elapsed from run start when step began
  duration_ms: { type: Number },   // how long the step took
  result:      { type: mongoose.Schema.Types.Mixed },
  error:       { type: String },
}, { _id: false })

const decisionSchema = new mongoose.Schema({
  decision:     { type: String },
  reason:       { type: String },
  evidence:     { type: mongoose.Schema.Types.Mixed },
  outcome:      { type: String },
  timestamp_ms: { type: Number },
}, { _id: false })

const modelDecisionSchema = new mongoose.Schema({
  strategy:               { type: String },   // 'emergency'|'standard'|'documentation-focus'|'monitoring'
  escalation_level:       { type: String },   // 'immediate'|'urgent'|'routine'
  precedent_research:     { type: Boolean },  // model decided to run CourtListener or not
  courtlistener_depth:    { type: String },   // 'comprehensive'|'targeted'|'none'
  reasoning:              { type: String },
  alternatives_considered: [{ option: String, rejected_reason: String }],
  model:                  { type: String },   // which model made the decision
  timestamp_ms:           { type: Number },   // ms from run start
  fallback_used:          { type: Boolean, default: false }, // true if Gemini call failed
}, { _id: false })

const agentRunSchema = new mongoose.Schema({
  uid:           { type: String, required: true, index: true },
  run_id:        { type: String, required: true, unique: true, index: true },
  goal:          { type: String },
  plan:          [{ type: String }],   // original static plan
  adapted_plan:  [{ type: String }],   // plan generated after case analysis, reflecting actual execution
  model_decision: modelDecisionSchema, // Gemini's strategy selection — drives CourtListener execution
  status:        { type: String, enum: ['running', 'complete', 'error'], default: 'running' },
  started_at:   { type: Date, default: Date.now },
  completed_at: { type: Date },
  duration_ms:  { type: Number },
  steps:        [stepSchema],
  decisions:    [decisionSchema],
  result: {
    cases_reviewed:         Number,
    critical_cases:         Number,
    urgent_cases:           Number,
    missing_documents:      Number,
    recommendations_count:  Number,
    court_opinions_count:   Number,
    recommendations:        [mongoose.Schema.Types.Mixed],
    court_opinions:         [mongoose.Schema.Types.Mixed],
    executive_report:       String,
    action_items:           [mongoose.Schema.Types.Mixed],
    // Real Atlas $vectorSearch results — one entry per case searched
    vector_search_results:  [mongoose.Schema.Types.Mixed],

    // ── Model-directed execution decisions ────────────────────────────────────
    // Priority 1: Flash selects which tools to run and which to skip
    tool_selection: {
      tools:          String,   // 'atlas_only'|'atlas_courtlistener'|'courtlistener_only'|'atlas_courtlistener_escalate'
      selected_tools: [String],
      rejected_tools: [String],
      reasoning:      String,
      confidence:     Number,
      fallback_used:  Boolean,
    },
    // Priority 2: Flash selects which cases receive retrieval resources
    case_selection: {
      selected_case_ids:   [String],
      rejected_case_ids:   [String],
      selected_count:      Number,
      rejected_count:      Number,
      reasoning:           String,
      selection_criteria:  String,
      fallback_used:       Boolean,
    },
    // Priority 3: Flash evaluates whether retrieved evidence is sufficient
    evidence_sufficiency: {
      verdict:               String,  // 'sufficient'|'retrieve_more'|'escalate'
      match_quality:         String,  // 'high'|'medium'|'low'
      missing_context:       String,
      reasoning:             String,
      second_pass_triggered: Boolean,
      fallback_used:         Boolean,
    },
    // Priority 4: Flash self-critiques generated recommendations
    challenge_review: {
      most_uncertain_case:   String,
      uncertainty_reason:    String,
      missing_evidence:      [String],
      confidence_assessment: String,
      recommended_follow_up: String,
      execution_effect:      mongoose.Schema.Types.Mixed,
      fallback_used:         Boolean,
    },

    reasoning_summary: {
      prioritization_rationale: String,
      key_patterns:             [String],
      historical_findings:      String,
      confidence_assessment:    String,
    },
  },
  error: { type: String },
}, { timestamps: true })

export default mongoose.models.AgentRun || mongoose.model('AgentRun', agentRunSchema)
