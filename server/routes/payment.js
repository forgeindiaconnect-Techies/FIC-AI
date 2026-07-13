import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { isMongoAvailable } from '../utils/dbStatus.js';

const router = express.Router();

// Helper: Ensure user exists in MongoDB
const getOrCreateUser = async (email) => {
  if (!isMongoAvailable()) {
    console.warn(`[Payment API] MongoDB not connected. Using local fallback free plan for user ${email}`);
    return { email, plan: 'free' };
  }
  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ email, plan: 'free' });
    await user.save();
  }
  return user;
};

// 1. GET User Status & Plan
router.get('/user/status', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  try {
    const user = await getOrCreateUser(email);
    res.json({ success: true, plan: user.plan });
  } catch (err) {
    console.error('[Payment API] Get user status error:', err);
    // Graceful fallback: return free plan on error rather than throwing 500 error
    res.json({ success: true, plan: 'free', error: err.message });
  }
});

// 2. POST Create Razorpay Order
router.post('/payment/create-order', async (req, res) => {
  const { email, planType } = req.body;
  if (!email || !planType) {
    return res.status(400).json({ success: false, error: 'Email and planType are required' });
  }

  // Define pricing
  let amountInRupees = 499;
  if (planType === 'business') {
    amountInRupees = 999;
  }
  const amountInPaise = amountInRupees * 100;

  try {
    // Ensure user exists
    await getOrCreateUser(email);

    // Call Razorpay Order REST API
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error('[Payment API] Razorpay credentials missing in environment variables');
      return res.status(500).json({ success: false, error: 'Payment gateway configuration error' });
    }

    // ── TEST MODE: bypass Razorpay API for local development ──────────────────
    if (process.env.PAYMENT_TEST_MODE === 'true' || keyId.startsWith('rzp_test_')) {
      console.log('[Payment API] TEST MODE - returning mock order for', email);
      const mockOrderId = `order_test_${Date.now()}`;
      return res.json({
        success: true,
        orderId: mockOrderId,
        keyId: keyId,
        amount: amountInPaise,
        currency: 'INR',
        testMode: true
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const razorpayResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_sub_${Date.now()}`
      },
      {
        auth: {
          username: keyId,
          password: keySecret
        }
      }
    );

    const order = razorpayResponse.data;

    // Save pending Transaction to MongoDB
    if (isMongoAvailable()) {
      try {
        const tx = new Transaction({
          email,
          orderId: order.id,
          planType,
          amount: amountInRupees,
          status: 'pending'
        });
        await tx.save();
      } catch (dbErr) {
        console.warn('[Payment API] Failed to save pending transaction to MongoDB:', dbErr.message);
      }
    } else {
      console.warn('[Payment API] MongoDB disconnected; transaction save skipped.');
    }

    res.json({
      success: true,
      orderId: order.id,
      keyId: keyId,
      amount: amountInPaise,
      currency: 'INR'
    });
  } catch (err) {
    console.error('[Payment API] Create order failed:', err.response?.data || err);
    res.status(500).json({ success: false, error: err.response?.data?.error?.description || err.message || 'Failed to create order' });
  }
});

// 3. POST Verify Payment Signature & Upgrade Access
router.post('/payment/verify-payment', async (req, res) => {
  const { email, planType, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!email || !planType || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Verification parameters missing' });
  }

  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Cryptographic signature verification
    const text = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    const isVerified = expectedSignature === razorpay_signature;

    if (isVerified) {
      if (isMongoAvailable()) {
        try {
          // 1. Update Transaction to Success
          await Transaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            { 
              paymentId: razorpay_payment_id, 
              signature: razorpay_signature, 
              status: 'success' 
            }
          );

          // 2. Upgrade User Plan
          await User.findOneAndUpdate(
            { email },
            { plan: planType, updatedAt: new Date() },
            { new: true, upsert: true }
          );
        } catch (dbErr) {
          console.warn('[Payment API] Failed to update Mongoose documents on success verification:', dbErr.message);
        }
      } else {
        console.log(`[Payment API] Success verified offline (no DB connection). Upgrading ${email} to ${planType}`);
      }

      console.log(`[Payment API] Success! User ${email} upgraded to ${planType}`);
      res.json({ success: true, plan: planType });
    } else {
      if (isMongoAvailable()) {
        try {
          // Update Transaction to Failed
          await Transaction.findOneAndUpdate(
            { orderId: razorpay_order_id },
            { status: 'failed' }
          );
        } catch (dbErr) {}
      }

      res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }
  } catch (err) {
    console.error('[Payment API] Verification error:', err);
    res.status(500).json({ success: false, error: 'Verification process failed: ' + err.message });
  }
});

export default router;
