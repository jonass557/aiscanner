import mongoose from 'mongoose';

/**
 * Persisted result of a Multi-Timeframe analysis: one symbol read across
 * several timeframes, plus a synthesized top-down verdict.
 * Mirrors the shape produced by multiTimeframeParser.js.
 */

const keyLevelSchema = new mongoose.Schema(
  {
    label: String,
    level: mongoose.Schema.Types.Mixed,
    note: String,
    type: String,
  },
  { _id: false }
);

const timeframeSchema = new mongoose.Schema(
  {
    timeframe: String,
    imageUrl: String,
    imagePublicId: String,
    trend: { type: String, enum: ['bullish', 'bearish', 'ranging'], default: 'ranging' },
    marketStructure: String,
    keyLevels: [keyLevelSchema],
    bias: { type: String, enum: ['BUY', 'SELL', 'NEUTRAL'], default: 'NEUTRAL' },
  },
  { _id: false }
);

const conflictSchema = new mongoose.Schema(
  { tf1: String, tf2: String, description: String },
  { _id: false }
);

const multiTimeframeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Auto-recognition
    symbol: { type: String, default: 'Unknown' },
    market: {
      type: String,
      enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'],
      default: 'unknown',
    },
    broker: { type: String, default: 'Unknown' },
    currentPrice: { type: Number, default: null },

    // Per-timeframe reads
    timeframes: [timeframeSchema],

    // Cross-timeframe synthesis
    alignmentStatus: {
      type: String,
      enum: ['aligned', 'partial', 'conflicted'],
      default: 'partial',
    },
    confluenceScore: { type: Number, min: 0, max: 100, default: 0 },
    dominantBias: { type: String, enum: ['BUY', 'SELL'], default: 'BUY' },
    conflicts: [conflictSchema],

    recommendation: {
      // WAIT = no confirmed top-down entry, but a suggested zone + waitReason
      // are provided. NO_TRADE kept only for legacy records.
      decision: { type: String, enum: ['BUY', 'SELL', 'WAIT', 'NO_TRADE'], default: 'WAIT' },
      entry: Number,
      stopLoss: Number,
      takeProfit1: Number,
      takeProfit2: Number,
      riskRewardRatio: String,
      reasoning: String,
      waitReason: String, // WAIT only: why wait + which zone to wait for
    },

    summary: String,

    // Metadata
    processingTime: Number,
    aiProvider: String,
    aiModel: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    error: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

multiTimeframeSchema.index({ userId: 1, createdAt: -1 });

const MultiTimeframeAnalysis = mongoose.model('MultiTimeframeAnalysis', multiTimeframeSchema);

export default MultiTimeframeAnalysis;
