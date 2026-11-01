import mongoose from 'mongoose';

/**
 * A payment attempt for a subscription plan (iKeePay Inline Checkout, Mobile Money, SebPay, or Demo).
 * Status lifecycle: pending → approved | rejected | failed.
 * Webhooks are idempotent via `providerRef`/`externalRef` unique indexes.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    customerEmail: { type: String, required: false, index: true, lowercase: true, trim: true },
    customerName: { type: String, required: false, default: '' },
    planId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },

    customerPhone: { type: String, required: false, default: '' },
    operator: { type: String, default: 'standard' }, // 'mtn' | 'moov' | 'orange' | 'wave' | 'card'

    provider: { type: String, default: 'ikeepay' }, // 'ikeepay' | 'sebpay' | 'demo'
    providerRef: { type: String, unique: true, sparse: true }, // e.g. IKP_...
    externalRef: { type: String, unique: true, sparse: true }, // e.g. REF_...

    checkoutUrl: String,
    method: { type: String, default: 'inline_checkout' },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    webhookReceivedAt: Date,
    rawWebhook: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
