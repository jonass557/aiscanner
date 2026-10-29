import mongoose from 'mongoose';

/**
 * User Configuration and Risk Policy for AI Managed Trading.
 *
 * Modes:
 * - 'analysis_only' (Mode 1, Default): Only presents opportunities. 0 orders sent.
 * - 'manual_confirmation' (Mode 2): Detects & calculates order; requires explicit user click to dispatch.
 * - 'automated' (Mode 3): Sends orders respecting user risk policy. Disabled by default.
 */

const managedTradingConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    activeBrokerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerAccount',
      default: null,
    },
    operatingMode: {
      type: String,
      enum: ['analysis_only', 'manual_confirmation', 'automated'],
      default: 'analysis_only',
      index: true,
    },
    // Emergency Kill Switch
    isEmergencyStopped: {
      type: Boolean,
      default: false,
      index: true,
    },
    emergencyStoppedAt: {
      type: Date,
      default: null,
    },
    emergencyStopReason: {
      type: String,
      default: '',
    },

    // 1. Risk Limits (AI Capital Manager Integration)
    maxRiskPerTradePercent: {
      type: Number,
      min: 0.1,
      max: 10.0,
      default: 1.0, // 1% per trade default
    },
    maxRiskPerTradeAmount: {
      type: Number,
      min: 1,
      default: 100, // $100 per trade default
    },
    maxDailyLossPercent: {
      type: Number,
      min: 0.5,
      max: 20.0,
      default: 3.0, // 3% max daily loss
    },
    maxDailyLossAmount: {
      type: Number,
      min: 5,
      default: 300, // $300 max daily loss
    },
    maxDrawdownPercent: {
      type: Number,
      min: 1.0,
      max: 30.0,
      default: 6.0, // 6% max drawdown
    },
    maxOpenPositions: {
      type: Number,
      min: 1,
      max: 10,
      default: 2, // 2 concurrent positions max
    },
    maxOrdersPerDay: {
      type: Number,
      min: 1,
      max: 50,
      default: 5, // 5 orders max per 24h
    },
    maxAllowedSlippagePercent: {
      type: Number,
      min: 0.01,
      max: 1.0,
      default: 0.20, // 0.20% max price slippage from signal
    },

    // 2. Scope & Strategy Constraints
    allowedMarkets: {
      type: [String],
      enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic'],
      default: ['forex', 'commodities', 'indices', 'synthetic', 'crypto'],
    },
    allowedSymbols: {
      type: [String],
      default: [], // Empty means all symbols in allowedMarkets
    },
    allowedStrategies: {
      type: [String],
      default: ['SMC', 'ICT', 'Price-Action'],
    },
    minConfidenceScore: {
      type: Number,
      min: 70,
      max: 100,
      default: 80, // >= 80% confidence required
    },
    minRiskReward: {
      type: Number,
      min: 1.0,
      max: 10.0,
      default: 1.5, // >= 1:1.5 RR required
    },

    // 3. Trading Schedule
    tradingHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '08:00' }, // HH:mm UTC
      end: { type: String, default: '20:00' }, // HH:mm UTC
      timezone: { type: String, default: 'UTC' },
      allowWeekend: { type: Boolean, default: false },
    },

    // 4. Disconnection Policy
    onDisconnectBehavior: {
      type: String,
      enum: ['hold_existing', 'alert_only'],
      default: 'hold_existing',
    },

    // 5. Explicit Confirmation & Legal Acceptance for Automated Mode
    explicitAuthorization: {
      confirmed: { type: Boolean, default: false },
      confirmedAt: { type: Date, default: null },
      confirmedIp: { type: String, default: '' },
      acknowledgedRisks: { type: Boolean, default: false },
    },

    // Daily Metrics Tracking (Reset each 00:00 UTC)
    dailyMetrics: {
      date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
      realizedLossToday: { type: Number, default: 0 },
      realizedProfitToday: { type: Number, default: 0 },
      ordersExecutedToday: { type: Number, default: 0 },
      peakEquity: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helper to check if trading is currently allowed within schedule
managedTradingConfigSchema.methods.isWithinTradingHours = function () {
  if (!this.tradingHours?.enabled) return true;
  const now = new Date();
  const day = now.getUTCDay();
  // Sunday is 0, Saturday is 6
  if (!this.tradingHours.allowWeekend && (day === 0 || day === 6)) {
    return false;
  }
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [startH, startM] = (this.tradingHours.start || '08:00').split(':').map(Number);
  const [endH, endM] = (this.tradingHours.end || '20:00').split(':').map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// Check and reset daily tracking if day changed
managedTradingConfigSchema.methods.ensureDailyMetricsReset = function () {
  const today = new Date().toISOString().slice(0, 10);
  if (this.dailyMetrics?.date !== today) {
    this.dailyMetrics = {
      date: today,
      realizedLossToday: 0,
      realizedProfitToday: 0,
      ordersExecutedToday: 0,
      peakEquity: this.dailyMetrics?.peakEquity || 0,
    };
  }
};

const ManagedTradingConfig = mongoose.model('ManagedTradingConfig', managedTradingConfigSchema);

export default ManagedTradingConfig;
