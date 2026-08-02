import mongoose from 'mongoose';

const tradeValidationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbol: { type: String, default: 'Unknown' },
    market: { type: String, enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'], default: 'unknown' },
    timeframe: { type: String, default: 'Unknown' },
    inputMode: { type: String, enum: ['screenshot', 'parameters'], default: 'screenshot' },
    imageUrl: String,
    imagePublicId: String,
    tradeParams: {
      entry: Number,
      stopLoss: Number,
      takeProfit1: Number,
      takeProfit2: Number,
      strategy: String,
      riskPercent: Number,
      accountBalance: Number,
    },
    decision: { type: String, enum: ['VALIDATE', 'WAIT', 'REJECT'], default: 'WAIT' },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    riskScore: { type: Number, min: 0, max: 100, default: 50 },
    riskRewardRatio: String,
    stopLossAnalysis: {
      isValid: Boolean,
      placement: String,
      reasoning: String,
      suggestions: [String],
    },
    takeProfitAnalysis: {
      isValid: Boolean,
      targeting: String,
      reasoning: String,
      suggestions: [String],
    },
    riskManagementCheck: {
      positionSizeAcceptable: Boolean,
      riskPercentAcceptable: Boolean,
      rrAcceptable: Boolean,
      reasoning: String,
    },
    weaknesses: [{ type: String, severity: { type: String, enum: ['high', 'medium', 'low'] }, description: String }],
    strengths: [String],
    recommendations: [{ action: String, priority: { type: String, enum: ['high', 'medium', 'low'] } }],
    summary: String,
    processingTime: Number,
    aiProvider: String,
    aiModel: String,
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
    error: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

tradeValidationSchema.index({ userId: 1, createdAt: -1 });

const TradeValidation = mongoose.model('TradeValidation', tradeValidationSchema);
export default TradeValidation;
