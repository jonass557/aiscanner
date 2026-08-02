import mongoose from 'mongoose';

const voiceTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },
    action: String, // resolved intent action, when applicable
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * A voice-assistant conversation, scoped to a user. Turns hold the transcript
 * of both sides so the history is searchable and replayable. Audio itself is
 * not persisted (privacy) — the client re-synthesizes assistant text on replay.
 */
const voiceConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Nouvelle conversation' },
    turns: [voiceTurnSchema],
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

voiceConversationSchema.index({ user: 1, lastMessageAt: -1 });
// Text index for searching conversation content.
voiceConversationSchema.index({ title: 'text', 'turns.text': 'text' });

const VoiceConversation = mongoose.model('VoiceConversation', voiceConversationSchema);
export default VoiceConversation;
