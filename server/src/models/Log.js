import mongoose from 'mongoose';

/**
 * System/audit log entry. Written by the logging service for auth events,
 * AI requests, admin actions, and errors. Surfaced in the admin panel.
 */
const logSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
      index: true,
    },
    category: {
      type: String,
      enum: ['auth', 'ai', 'admin', 'system', 'subscription', 'scan'],
      required: true,
      index: true,
    },
    action: { type: String, required: true },
    message: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    metadata: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true }
);

logSchema.index({ createdAt: -1 });

// Auto-expire logs after 90 days to keep the collection bounded.
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Log = mongoose.model('Log', logSchema);

export default Log;
