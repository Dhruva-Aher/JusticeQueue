// Mongoose schema for the staff_actions collection
import mongoose from 'mongoose'

const StaffActionSchema = new mongoose.Schema(
  {
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    staff_uid: { type: String, required: true },
    action: { type: String, enum: ['override', 'review', 'close'], required: true },
    previous_score: { type: Number, default: null },
    new_rank: { type: Number, default: null },
    reason: { type: String, default: '' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

export default mongoose.models.StaffAction || mongoose.model('StaffAction', StaffActionSchema, 'staff_actions')
