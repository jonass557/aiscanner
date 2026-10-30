import mongoose from 'mongoose';

/**
 * Configuration and Profile for AI Trading Delegate.
 *
 * Allows users to set their trading parameters once and delegate market
 * surveillance to the background server engine.
 */

const tradingDelegateConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Global delegation state
    isEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    // "Mode : Je n'ai pas le temps de trader" (Hands-free passive mode)
    isPassiveMode: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Markets watched
    markets: {
      type: [String],
      enum: ['forex', 'commodities', 'crypto', 'indices', 'synthetic'],
      default: ['forex', 'commodities', 'indices', 'synthetic', 'crypto'],
    },
    // Specific symbols (empty = all in allowed markets)
    symbols: {
      type: [String],
      default: ['EURUSD', 'GBPUSD', 'XAUUSD', 'US30', 'Volatility 75 Index', 'BTCUSD'],
    },
    // Monitored timeframes
    timeframes: {
      type: [String],
      enum: ['M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1'],
      default: ['H1', 'H4'],
    },
    // Allowed strategy philosophies
    strategies: {
      type: [String],
      default: ['SMC', 'ICT', 'Price-Action', 'Supply-Demand'],
    },
    // Preferred trading sessions
    sessions: {
      type: [String],
      enum: ['London', 'New-York', 'Asian', 'Any'],
      default: ['Any'],
    },
    // Minimum Confluence Score (Quality criteria, NOT guaranteed win rate)
    minConfidenceScore: {
      type: Number,
      min: 70,
      max: 95,
      default: 75,
    },
    // Minimum Risk / Reward ratio (e.g. 2.0 = 1:2)
    minRiskReward: {
      type: Number,
      min: 1.0,
      max: 10.0,
      default: 2.0,
    },
    // Risk tolerance bound (checked against AI Capital Manager)
    maxRiskPerTradePercent: {
      type: Number,
      min: 0.1,
      max: 10.0,
      default: 1.0,
    },
    // Surveillance Schedule
    operatingHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '08:00' }, // HH:mm UTC
      end: { type: String, default: '20:00' }, // HH:mm UTC
      timezone: { type: String, default: 'UTC' },
    },
    // Active days of the week (0 = Sunday, 1 = Monday ... 6 = Saturday)
    activeDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday through Friday by default
    },
    // Maximum signals generated per day to avoid over-exposure
    maxSignalsPerDay: {
      type: Number,
      min: 1,
      max: 20,
      default: 5,
    },
    // Notification Channels
    notifications: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      minScoreForEmail: { type: Number, default: 80 },
    },
    // Invalidation rules
    invalidationRules: {
      maxSlippageDriftPercent: { type: Number, default: 0.35 }, // 0.35% price drift from zone
      ttlHours: { type: Number, default: 8 },
      cancelOnOppositeStructure: { type: Boolean, default: true },
    },
    // Daily Metrics & Counters
    metrics: {
      date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
      signalsCountToday: { type: Number, default: 0 },
      lastScanAt: { type: Date, default: null },
      lastSignalAt: { type: Date, default: null },
      totalSignalsGenerated: { type: Number, default: 0 },
    },
    // Status text for UI diagnostics
    serverStatus: {
      type: String,
      enum: ['active', 'paused', 'outside_hours', 'limit_reached', 'idle'],
      default: 'idle',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Helper: check if current time is within active trading schedule
tradingDelegateConfigSchema.methods.isWithinActiveWindow = function () {
  const now = new Date();
  const day = now.getUTCDay();

  // Check day of week
  if (Array.isArray(this.activeDays) && !this.activeDays.includes(day)) {
    return false;
  }

  // Check hours if enabled
  if (this.operatingHours?.enabled) {
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [startH, startM] = (this.operatingHours.start || '08:00').split(':').map(Number);
    const [endH, endM] = (this.operatingHours.end || '20:00').split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return false;
    }
  }

  return true;
};

// Helper: daily counter reset
tradingDelegateConfigSchema.methods.ensureDailyReset = function () {
  const today = new Date().toISOString().slice(0, 10);
  if (this.metrics?.date !== today) {
    this.metrics = {
      date: today,
      signalsCountToday: 0,
      lastScanAt: this.metrics?.lastScanAt || null,
      lastSignalAt: this.metrics?.lastSignalAt || null,
      totalSignalsGenerated: this.metrics?.totalSignalsGenerated || 0,
    };
  }
};

const TradingDelegateConfig = mongoose.model('TradingDelegateConfig', tradingDelegateConfigSchema);

export default TradingDelegateConfig;
