import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'business'],
    default: 'free'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid OverwriteModelError if model is already registered
export default mongoose.models.User || mongoose.model('User', userSchema);
