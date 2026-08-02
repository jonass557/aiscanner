import mongoose from 'mongoose';

/**
 * A message in an AI Trading Assistant conversation.
 *
 * - `context` snapshots the working symbol/timeframe/strategy so follow-ups
 *   ("et si je passe en H4 ?") can inherit it (see contextManager).
 * - `analysisId` links an assistant message to the persisted Analysis it
 *   produced, so the UI can render the rich decision/trade-plan card and the
 *   analysis also shows up in the unified History.
 */
const assistantMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    action: String, // resolved intent action (analyze, coach, compare…)
    analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', default: null },
    // Optional array of analysis ids for multi-analysis messages (compare).
    analysisIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Analysis' }],
    context: {
      symbols: [String],
      timeframe: String,
      strategy: String,
    },
    dataSource: String, // 'binance' | 'twelvedata' | 'mock'
    isRealData: Boolean,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assistantConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Nouvelle conversation' },
    messages: [assistantMessageSchema],
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

assistantConversationSchema.index({ user: 1, lastMessageAt: -1 });

const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema);
export default AssistantConversation;
