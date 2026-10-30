import mongoose from 'mongoose';

/**
 * In-App Notification record for trading delegate alerts, opportunities, and lifecycle events.
 */

const inAppNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Opportunity',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'OPPORTUNITY_DETECTED',
        'OPPORTUNITY_TRIGGERED',
        'TARGET_REACHED',
        'OPPORTUNITY_INVALIDATED',
        'DELEGATE_ALERT',
        'RISK_WARNING',
      ],
      default: 'OPPORTUNITY_DETECTED',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    symbol: {
      type: String,
      default: '',
      uppercase: true,
    },
    direction: {
      type: String,
      enum: ['BUY', 'SELL', 'NEUTRAL', ''],
      default: '',
    },
    confidenceScore: {
      type: Number,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

inAppNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const InAppNotification = mongoose.model('InAppNotification', inAppNotificationSchema);

export default InAppNotification;
