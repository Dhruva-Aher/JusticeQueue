// Mongoose schema for the past_cases collection (no embedding field — Atlas manages it)
import mongoose from 'mongoose'

const PastCaseSchema = new mongoose.Schema(
  {
    case_type: { type: String, required: true },
    description: { type: String, required: true },
    outcome: { type: String, enum: ['won', 'settled', 'declined'], required: true },
    outcome_notes: { type: String, default: '' },
    year: { type: Number, required: true },
  },
  { timestamps: false }
)

export default mongoose.models.PastCase || mongoose.model('PastCase', PastCaseSchema, 'past_cases')
