import mongoose from 'mongoose';

/**
 * Subscription plan — now database-backed so admins can create, edit, disable,
 * and manage plans (and their free trial) at runtime without a deploy.
 *
 * The file `config/plans.js` remains the SEED source: on first boot, its plans
 * are inserted here. After that, this collection is the source of truth.
 *
 * scansPerMonth: -1 means unlimited.
 */
const planSchema = new mongoose.Schema(
  {
    // Stable slug used everywhere as the plan identifier ('free', 'pro', …).
    id: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    scansPerMonth: { type: Number, default: -1 }, // -1 = unlimited scans for all plans
    features: { type: [String], default: [] },

    // Admin controls
    isActive: { type: Boolean, default: true }, // inactive plans are hidden from users
    trial: {
      enabled: { type: Boolean, default: false },
      days: { type: Number, default: 7, min: 0 },
    },
    // Special post-free trial promotion (e.g., 3,000 for 1 month then normal price)
    promo: {
      enabled: { type: Boolean, default: false },
      price: { type: Number, default: 0, min: 0 },
      durationMonths: { type: Number, default: 1, min: 1 },
      description: { type: String, default: '' },
    },
    order: { type: Number, default: 0 }, // display order on the pricing page
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

planSchema.index({ isActive: 1, order: 1 });

const Plan = mongoose.model('Plan', planSchema);
export default Plan;
