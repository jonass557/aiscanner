import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, trim: true },
    featureName: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ip: { type: String, default: '' },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'], default: 'desktop' },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, expires: 90 * 24 * 60 * 60 }, // 90 days TTL auto-cleanup
  },
  { timestamps: false }
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ featureName: 1, createdAt: -1 });
analyticsEventSchema.index({ path: 1, createdAt: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
export default AnalyticsEvent;
