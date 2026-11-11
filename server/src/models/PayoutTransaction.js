import mongoose from 'mongoose';

/**
 * H2H Payout transactions (POST /h2h-payout) for Partners & Admin withdrawals.
 */
const payoutTransactionSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['partner', 'admin'], required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'XOF' },
    country: { type: String, default: 'CI' },
    phoneNumber: { type: String, required: true },
    operator: { type: String, required: true },
    externalRef: { type: String, required: true, unique: true },
    providerRef: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    rawResponse: mongoose.Schema.Types.Mixed,
    rawWebhook: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true }
);

payoutTransactionSchema.index({ user: 1, createdAt: -1 });

const PayoutTransaction = mongoose.model('PayoutTransaction', payoutTransactionSchema);
export default PayoutTransaction;
