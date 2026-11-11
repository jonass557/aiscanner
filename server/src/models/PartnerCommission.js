import mongoose from 'mongoose';

/**
 * Tracks individual revenue splits generated when a partner's referred user pays a subscription.
 * Partner receives `partnerRate`% (default 30%), Admin receives `adminRate`% (default 70%).
 */
const partnerCommissionSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: false, unique: true, sparse: true },
    planId: { type: String, required: true },
    planName: { type: String, default: '' },
    subscriptionMonths: { type: Number, default: 1 },
    periodStart: { type: Date, default: Date.now },
    periodEnd: { type: Date, required: true },

    grossAmount: { type: Number, required: true },
    currency: { type: String, default: 'XOF' },

    partnerRate: { type: Number, required: true }, // e.g. 30
    partnerAmount: { type: Number, required: true }, // e.g. 30%
    adminRate: { type: Number, required: true }, // e.g. 70
    adminAmount: { type: Number, required: true }, // e.g. 70%

    status: {
      type: String,
      enum: ['scheduled', 'credited', 'cancelled'],
      default: 'credited',
      index: true,
    },
    creditedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

partnerCommissionSchema.index({ partner: 1, createdAt: -1 });
partnerCommissionSchema.index({ status: 1, periodEnd: 1 });

const PartnerCommission = mongoose.model('PartnerCommission', partnerCommissionSchema);
export default PartnerCommission;
