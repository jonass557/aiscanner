import mongoose from 'mongoose';

/**
 * An economic calendar event with optional AI impact analysis.
 * Populated by economicCalendarService (mock or a real ForexFactory-style feed).
 */
const economicEventSchema = new mongoose.Schema(
  {
    // Stable id from the source feed, used to upsert without duplicating.
    externalId: { type: String, index: true },
    title: { type: String, required: true },
    country: String,
    currency: { type: String, index: true },
    dateTime: { type: Date, required: true, index: true },
    impact: { type: String, enum: ['high', 'medium', 'low', 'holiday'], default: 'low', index: true },
    forecast: String,
    previous: String,
    actual: String,
    affectedMarkets: [String],

    aiAnalysis: {
      summary: String,
      expectedImpact: String, // e.g. "USD bullish if actual > forecast"
      volatilityRisk: { type: String, enum: ['high', 'medium', 'low'] },
      tradingAdvice: String,
      analyzedAt: Date,
    },

    notified: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

economicEventSchema.index({ dateTime: 1, impact: 1 });

const EconomicEvent = mongoose.model('EconomicEvent', economicEventSchema);
export default EconomicEvent;
