import mongoose from 'mongoose';

/**
 * Loose sub-document shape for detected technical elements.
 * Each detected element carries a label, an optional price/level, and a
 * short note. Kept flexible (Mixed) because the AI may return varying detail.
 */
const detectedElementSchema = new mongoose.Schema(
  {
    label: String,
    level: mongoose.Schema.Types.Mixed,
    note: String,
    type: String,
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Image
    imageUrl: { type: String, required: true },
    imagePublicId: String,

    // Auto-recognition
    symbol: { type: String, default: 'Unknown' },
    market: {
      type: String,
      enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'],
      default: 'unknown',
    },
    timeframe: { type: String, default: 'Unknown' },
    broker: { type: String, default: 'Unknown' },
    currentPrice: { type: Number, default: null },

    // Full technical analysis (Smart Money Concepts + classic TA)
    technicalAnalysis: {
      marketStructure: String,
      bos: [detectedElementSchema],
      choch: [detectedElementSchema],
      mss: [detectedElementSchema],
      orderBlocks: [detectedElementSchema],
      fairValueGaps: [detectedElementSchema],
      breakerBlocks: [detectedElementSchema],
      mitigationBlocks: [detectedElementSchema],
      liquidityZones: [detectedElementSchema],
      equalHighs: [detectedElementSchema],
      equalLows: [detectedElementSchema],
      supportLevels: [detectedElementSchema],
      resistanceLevels: [detectedElementSchema],
      trendlines: [detectedElementSchema],
      consolidations: [detectedElementSchema],
      breakouts: [detectedElementSchema],
      fakeBreakouts: [detectedElementSchema],
      momentum: String,
      volatility: String,
      premiumZones: [detectedElementSchema],
      discountZones: [detectedElementSchema],
    },

    // Decision
    decision: {
      type: String,
      enum: ['BUY', 'SELL', 'NO_TRADE'],
      default: 'NO_TRADE',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Trade plan
    tradePlan: {
      entry: Number,
      stopLoss: Number,
      takeProfit1: Number,
      takeProfit2: Number,
      takeProfit3: Number,
      riskRewardRatio: String,
      estimatedDuration: String,
      estimatedProbability: Number,
      tradeType: String, // 'scalp' | 'intraday' | 'swing' (assistant analyses)
    },

    // Detailed report
    report: {
      summary: String,
      validationReasons: [String],
      confluences: [String],
      risks: [String],
      weaknesses: [String],
      missingElements: [String],
      reasoning: [String], // step-by-step explanation (assistant analyses)
    },

    // Provenance: how this analysis was produced and where its data came from.
    source: {
      type: String,
      enum: ['scanner', 'multi-timeframe', 'assistant'],
      default: 'scanner',
    },
    dataSource: String, // market-data provider: 'binance' | 'twelvedata' | 'mock'
    isRealData: Boolean,

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

// Compound indexes for common queries (history filters)
analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ userId: 1, market: 1 });
analysisSchema.index({ userId: 1, decision: 1 });
analysisSchema.index({ symbol: 'text' });

const Analysis = mongoose.model('Analysis', analysisSchema);

export default Analysis;
