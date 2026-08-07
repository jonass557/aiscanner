import mongoose from 'mongoose';

/**
 * Loose sub-document shape for detected technical elements.
 * Each detected element carries a label, an optional price/level, and a
 * short note. Kept flexible (Mixed) because the AI may return varying detail.
 *
 * Extended for the Computer-Vision pipeline: every detection can now carry a
 * visual `confidence` (0-100), a normalized `bbox`, a `direction`, and
 * `evidence` (references to the perceived elements that justify it). All are
 * optional, so pre-CV records remain valid.
 */
const detectedElementSchema = new mongoose.Schema(
  {
    label: String,
    level: mongoose.Schema.Types.Mixed,
    note: String,
    type: String,
    direction: String, // 'bullish' | 'bearish' | 'neutral'
    confidence: Number, // 0-100 (visual/model confidence)
    bbox: mongoose.Schema.Types.Mixed, // { x, y, w, h } normalized 0-1
    evidence: [String], // perceived-element references
  },
  { _id: false }
);

/**
 * A single overlay annotation (normalized coords) produced by the overlay
 * builder. Rendered client-side on top of the chart image.
 */
const annotationSchema = new mongoose.Schema(
  {
    layer: String, // 'orderBlocks' | 'fvg' | 'liquidity' | 'entry' | ...
    shape: String, // 'rect' | 'line' | 'zone' | 'label'
    coords: mongoose.Schema.Types.Mixed, // { bbox } or { points: [{x,y}] }
    color: String,
    label: String,
    confidence: Number,
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
      enum: ['forex', 'crypto', 'indices', 'commodities', 'stocks', 'synthetic', 'unknown'],
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

      // --- Advanced SMC/ICT families (Computer-Vision pipeline, Engine 2) ---
      higherHighs: [detectedElementSchema],
      higherLows: [detectedElementSchema],
      lowerHighs: [detectedElementSchema],
      lowerLows: [detectedElementSchema],
      inverseFvg: [detectedElementSchema],
      imbalances: [detectedElementSchema],
      displacement: [detectedElementSchema],
      oteZones: [detectedElementSchema],
      liquiditySweeps: [detectedElementSchema],
      stopHunts: [detectedElementSchema],
      inducement: [detectedElementSchema],
      retests: [detectedElementSchema],
      channels: [detectedElementSchema],
      fibonacci: [detectedElementSchema],
      chartPatterns: [detectedElementSchema],
      candlePatterns: [detectedElementSchema],
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

    // --- Computer-Vision pipeline additions ---------------------------------
    // Raw perception (Engine 1): everything the vision model reported as
    // literally visible, with per-element confidence + normalized bboxes.
    perception: {
      context: mongoose.Schema.Types.Mixed,
      candles: [mongoose.Schema.Types.Mixed],
      indicators: [mongoose.Schema.Types.Mixed],
      drawnObjects: [mongoose.Schema.Types.Mixed],
      texts: [mongoose.Schema.Types.Mixed],
      gaps: [mongoose.Schema.Types.Mixed],
      psychLevels: [mongoose.Schema.Types.Mixed],
      consolidations: [mongoose.Schema.Types.Mixed],
      volumeVisible: Boolean,
      meta: mongoose.Schema.Types.Mixed, // { imageWidth, imageHeight }
    },

    // Overlay annotations (Engine 4): drawable layers in normalized coords.
    annotations: [annotationSchema],

    // Pipeline provenance.
    engineVersion: String,
    visionProvider: String,
    visionModel: String,

    // User quality feedback (Engine 5 — continuous improvement).
    feedback: {
      rating: { type: String, enum: ['up', 'down', null], default: null },
      comment: String,
      ratedAt: Date,
    },

    // Provenance: how this analysis was produced and where its data came from.
    source: {
      type: String,
      enum: ['scanner', 'multi-timeframe', 'assistant', 'vision'],
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
