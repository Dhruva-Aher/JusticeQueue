// Mongoose schema for the cases collection
import mongoose from 'mongoose'

const CaseSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    batch_id: { type: String, required: true, index: true },
    client_name: { type: String, default: '' },
    case_type: { type: String, enum: ['eviction', 'immigration', 'wage_theft', 'custody', 'employment', 'other'], default: 'other' },
    summary: { type: String, default: '' },
    deadline_days: { type: Number, default: null },
    vulnerability_flags: {
      minor_children: { type: Boolean, default: false },
      language_barrier: { type: Boolean, default: false },
      medical_condition: { type: Boolean, default: false },
    },
    missing_info: [String],
    priority_score: { type: Number, default: 0 },
    // Score computed with similarCases = [] — shows the marginal value of vector retrieval
    score_without_retrieval: { type: Number, default: null },
    score_breakdown: {
      deadline_points: { type: Number, default: 0 },
      vulnerability_points: { type: Number, default: 0 },
      case_type_points: { type: Number, default: 0 },
      similarity_points: { type: Number, default: 0 },
    },
    priority_reason: { type: String, default: '' },
    similar_cases: { type: mongoose.Schema.Types.Mixed, default: [] },
    recommendation: { type: String, default: '' },
    agent_trace: { type: mongoose.Schema.Types.Mixed, default: [] },
    mongodb_via: { type: String, default: 'mongoose_fallback' },
    mcp_config:  { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['pending', 'reviewed', 'overridden', 'closed'], default: 'pending' },
    rank: { type: Number, default: 0 },
    raw_text: { type: String, default: '' },
    outreach: {
      subject:  { type: String, default: null },
      body:     { type: String, default: null },
      status:   { type: String, enum: ['none', 'draft', 'sent'], default: 'none' },
      draft_id: { type: String, default: null },
      sent_at:  { type: Date,   default: null },
    },
    calendar: {
      event_id:     { type: String, default: null },
      event_link:   { type: String, default: null },
      scheduled_at: { type: Date,   default: null },
      status:       { type: String, enum: ['none', 'scheduled', 'cancelled', 'failed'], default: 'none' },
    },
    brief: {
      available:    { type: Boolean, default: false },
      content:      { type: String,  default: null },
      generated_at: { type: Date,    default: null },
    },
  },
  { timestamps: true }
)

export default mongoose.models.Case || mongoose.model('Case', CaseSchema)
