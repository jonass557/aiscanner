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

const exerciseSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    context: { type: String, default: '' },
    chartIllustration: { type: String, default: '' }, // ASCII/SVG or chart description
    hint: { type: String, default: '' },
    passingScore: { type: Number, default: 70 },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    answer: { type: String, default: '' },
    feedback: { type: String, default: '' },
    score: { type: Number, default: null }, // 0 to 100
    passed: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    objectives: [{ type: String }],
    status: {
      type: String,
      enum: ['locked', 'available', 'in_progress', 'completed'],
      default: 'locked',
    },
    exercise: exerciseSchema,
    submission: submissionSchema,
    chartIllustration: { type: String, default: '' },
    completedAt: { type: Date, default: null },
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
      enum: ['smc', 'ict', 'price-action', 'risk-management', 'psychology', 'institutional_orderflow', 'general'],
      default: 'general',
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    messages: [messageSchema],
    curriculum: [lessonSchema],
    activeLessonIndex: { type: Number, default: 0 },
    studentProgress: {
      overallScore: { type: Number, default: 0 },
      completedCount: { type: Number, default: 0 },
      totalLessons: { type: Number, default: 0 },
    },
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
