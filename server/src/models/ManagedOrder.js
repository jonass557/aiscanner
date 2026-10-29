import mongoose from 'mongoose';

/**
 * Managed order & position record.
 * Tracks the full lifecycle from pre-flight validation to broker fill, protection orders, and closure.
 */

const managedOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    brokerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerAccount',
      required: true,
      index: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      default: null,
      index: true,
    },
    // Unique idempotency key to prevent double execution under any circumstance
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    executionMode: {
      type: String,
      enum: ['paper', 'manual_confirmation', 'automated'],
      required: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    market: {
      type: String,
      enum: ['forex', 'crypto', 'indices', 'commodities', 'synthetic'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true,
    },
    orderType: {
      type: String,
      enum: ['MARKET', 'LIMIT', 'STOP'],
      default: 'MARKET',
    },

    // Planned volumes & prices
    volume: { type: Number, required: true },
    signalPrice: { type: Number, required: true },
    requestedPrice: { type: Number, required: true },
    executionPrice: { type: Number, default: null }, // Confirmed real price from broker
    slippage: { type: Number, default: 0 }, // Requested vs Real fill difference
    slippagePercent: { type: Number, default: 0 },

    // Risk levels & protections
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number, default: null },
    isBrokerSideSlTpAccepted: { type: Boolean, default: false },

    // Financial Metrics
    riskAmount: { type: Number, required: true },
    riskPercent: { type: Number, required: true },
    marginRequired: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    swap: { type: Number, default: 0 },
    realizedPnl: { type: Number, default: 0 },

    // Lifecycle Status
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'VALIDATED',
        'SUBMITTED',
        'ACCEPTED',
        'FILLED',
        'PARTIALLY_FILLED',
        'REJECTED',
        'CANCELLED',
        'CLOSED',
      ],
      default: 'REQUESTED',
      index: true,
    },

    // Broker Reference Identifiers
    brokerOrderId: { type: String, default: null, index: true },
    brokerPositionId: { type: String, default: null, index: true },
    brokerRawResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    // Audit Checklist & Rejection Diagnostics
    preFlightChecklist: {
      userAuth: Boolean,
      modeActive: Boolean,
      connectionValid: Boolean,
      freshData: Boolean,
      notExpired: Boolean,
      notDuplicate: Boolean,
      symbolAllowed: Boolean,
      riskWithinLimit: Boolean,
      sizeCorrect: Boolean,
      slTpValid: Boolean,
      dailyLimitsOk: Boolean,
      slippageOk: Boolean,
      brokerConstraintsOk: Boolean,
    },
    rejectionReason: { type: String, default: null },

    submittedAt: { type: Date, default: null },
    filledAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedPrice: { type: Number, default: null },
    closeReason: {
      type: String,
      enum: ['tp_hit', 'sl_hit', 'manual_close', 'emergency_close', 'expired', null],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

managedOrderSchema.index({ userId: 1, status: 1 });
managedOrderSchema.index({ brokerAccountId: 1, status: 1 });
managedOrderSchema.index({ createdAt: -1 });

const ManagedOrder = mongoose.model('ManagedOrder', managedOrderSchema);

export default ManagedOrder;
