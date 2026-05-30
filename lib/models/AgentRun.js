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

const agentRunSchema = new mongoose.Schema({
  uid:          { type: String, required: true, index: true },
  run_id:       { type: String, required: true, unique: true, index: true },
  goal:         { type: String },
  plan:         [{ type: String }],
  status:       { type: String, enum: ['running', 'complete', 'error'], default: 'running' },
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
