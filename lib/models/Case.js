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
    status: { type: String, enum: ['pending', 'reviewed', 'overridden', 'closed'], default: 'pending' },
    rank: { type: Number, default: 0 },
    raw_text: { type: String, default: '' },
  },
  { timestamps: true }
)

export default mongoose.models.Case || mongoose.model('Case', CaseSchema)
