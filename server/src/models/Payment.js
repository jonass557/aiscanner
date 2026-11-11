import mongoose from 'mongoose';

/**
 * Payment & H2H transaction model (Payin & Payout via iKeePay H2H, SebPay, or Demo).
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
    currency: { type: String, default: 'XOF' },

    type: {
      type: String,
      enum: ['payin', 'payout'],
      default: 'payin',
      index: true,
    },
    purpose: {
      type: String,
      enum: ['subscription', 'partnership', 'partner_payout', 'admin_payout'],
      default: 'subscription',
      index: true,
    },

    country: { type: String, default: 'CI' },
    customerPhone: { type: String, required: false, default: '' },
    operator: { type: String, default: 'ORANGE' }, // 'ORANGE' | 'MTN' | 'WAVE' | 'MOOV' | 'MOBICASH' | 'AIRTEL' | 'VODACOM'

    provider: { type: String, default: 'ikeepay' }, // 'ikeepay' | 'sebpay' | 'demo'
    providerRef: { type: String, unique: true, sparse: true }, // e.g. IKP-H2H-...
    externalRef: { type: String, unique: true, sparse: true }, // e.g. REF_... / PART_... / PAYOUT_...

    paymentLink: { type: String, default: '' },
    checkoutUrl: { type: String, default: '' },
    method: { type: String, default: 'h2h_payin' },

    referralCodeUsed: { type: String, default: '' },
    referredByPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    splitApplied: { type: Boolean, default: false },
    partnerShare: { type: Number, default: 0 },
    adminShare: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    webhookReceivedAt: Date,
    rawWebhook: mongoose.Schema.Types.Mixed,
    rawResponse: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ purpose: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
