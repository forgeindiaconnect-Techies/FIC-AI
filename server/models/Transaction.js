import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: String,
  signature: String,
  planType: {
    type: String,
    enum: ['pro', 'business'],
    required: true
  },
  amount: {
    type: Number, // in INR (rupees)
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid OverwriteModelError if model is already registered
export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
