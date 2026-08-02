import mongoose from 'mongoose';

/**
 * A mentor chat conversation: an ordered list of user/assistant messages.
 * Kept as a single document (conversations are bounded and read as a whole).
 */

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mentorConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, default: 'New conversation' },
    topic: {
      type: String,
      enum: ['smc', 'ict', 'price-action', 'risk-management', 'psychology', 'general'],
      default: 'general',
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    messages: [messageSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

mentorConversationSchema.index({ userId: 1, updatedAt: -1 });

const MentorConversation = mongoose.model('MentorConversation', mentorConversationSchema);

export default MentorConversation;
