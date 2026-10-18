import mongoose from 'mongoose';

/**
 * Strategy model — allows administrators and the platform to define
 * institutional trading strategies (SMC, Support & Resistance, ICT, Trend Following)
 * and lets admins create new strategies at runtime that are dynamically applied
 * across Chart Vision, Opportunity Scanner, and Multi-Timeframe analyses.
 */
const strategySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['smc', 'support_resistance', 'ict', 'price_action', 'trend', 'custom'],
      default: 'smc',
    },
    description: { type: String, default: '' },
    // Rules and confluences required for this strategy
    rules: { type: [String], default: [] },
    // Supply & Demand mode: 'order_block_fvg' (SMC), 'support_resistance' (S/R), 'pivot_levels', etc.
    supplyDemandType: {
      type: String,
      enum: ['order_block_fvg', 'support_resistance', 'pivot_levels', 'dynamic_ema'],
      default: 'order_block_fvg',
    },
    // Liquidity mode: 'bsl_ssl' (Buy/Sell-side liquidity for SMC), 'swing_high_low' (classic S/R stops), etc.
    liquidityRules: {
      type: String,
      enum: ['bsl_ssl', 'swing_high_low', 'channel_bounds'],
      default: 'bsl_ssl',
    },
    targetRiskReward: { type: Number, default: 3.0, min: 1.0 },
    winRateEstimate: { type: Number, default: 85, min: 50, max: 99 },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

strategySchema.index({ isActive: 1, key: 1 });

const Strategy = mongoose.model('Strategy', strategySchema);
export default Strategy;
