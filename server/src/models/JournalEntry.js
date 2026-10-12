import mongoose from 'mongoose';

/**
 * Journal de Trading (Trading Journal).
 * Permet aux traders de consigner leurs trades, leurs confluences, leur psychologie,
 * leurs captures d'écran, PnL, R:R et leçons apprises.
 */

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    market: {
      type: String,
      enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic'],
      default: 'forex',
      index: true,
    },
    timeframe: {
      type: String,
      default: 'H1',
    },
    direction: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'win', 'loss', 'breakeven'],
      default: 'open',
      index: true,
    },

    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    stopLoss: { type: Number, default: null },
    takeProfit: { type: Number, default: null },
    lotSize: { type: Number, default: 0.1 },

    pnl: { type: Number, default: 0 }, // profit or loss in currency ($)
    pnlPips: { type: Number, default: 0 },
    riskRewardRatio: { type: String, default: '1:2.5' },

    strategy: { type: String, default: 'SMC' }, // SMC, ICT, Price-Action, Custom
    setupType: { type: String, default: 'Order Block' },
    confluences: [{ type: String }],

    entryDate: { type: Date, default: Date.now },
    exitDate: { type: Date, default: null },

    chartScreenshot: { type: String, default: '' },
    notes: { type: String, default: '' },
    lessonsLearned: { type: String, default: '' },
    emotion: {
      type: String,
      enum: ['disciplined', 'fomo', 'anxious', 'confident', 'revenge', 'neutral'],
      default: 'disciplined',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

journalEntrySchema.index({ userId: 1, entryDate: -1 });
journalEntrySchema.index({ userId: 1, status: 1 });

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);

export default JournalEntry;
