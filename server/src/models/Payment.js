import mongoose from 'mongoose';

/**
 * A payment attempt for a subscription plan (Mobile Money via SebPay).
 * Status lifecycle: pending → approved | rejected | failed.
 * Webhooks are idempotent via `providerRef`/`externalRef` unique indexes.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'XOF' },

    customerPhone: { type: String, required: true },
    operator: { type: String, default: 'mtn' }, // 'mtn' | 'moov'

    provider: { type: String, default: 'demo' }, // 'sebpay' | 'demo'
    providerRef: { type: String, unique: true, sparse: true },
    externalRef: { type: String, unique: true, sparse: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'failed'], default: 'pending', index: true },
    webhookReceivedAt: Date,
    rawWebhook: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
