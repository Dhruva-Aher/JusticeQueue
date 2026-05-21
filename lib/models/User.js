// User profile — created on registration, keyed by Firebase UID
import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    uid:       { type: String, required: true, unique: true, index: true },
    email:     { type: String, required: true, lowercase: true, trim: true },
    name:      { type: String, required: true, trim: true },
    clinic:    { type: String, default: '', trim: true },
    role:      { type: String, enum: ['staff', 'admin', 'supervisor'], default: 'staff' },
    provider:  { type: String, enum: ['email', 'google'], default: 'email' },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model('User', UserSchema)
