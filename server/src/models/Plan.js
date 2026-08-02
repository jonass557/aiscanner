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
    scansPerMonth: { type: Number, default: 5 }, // -1 = unlimited
    features: { type: [String], default: [] },

    // Admin controls
    isActive: { type: Boolean, default: true }, // inactive plans are hidden from users
    trial: {
      enabled: { type: Boolean, default: false },
      days: { type: Number, default: 7, min: 0 },
    },
    order: { type: Number, default: 0 }, // display order on the pricing page
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

planSchema.index({ isActive: 1, order: 1 });

const Plan = mongoose.model('Plan', planSchema);
export default Plan;
