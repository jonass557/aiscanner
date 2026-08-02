import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import MentorConversation from '../models/MentorConversation.js';
import { mentorReply } from '../services/ai/index.js';
import { logAi } from '../services/logService.js';
import logger from '../config/logger.js';

// How many prior turns to send to the model (keeps the prompt bounded/cheap).
const CONTEXT_WINDOW = 20;

const deriveTitle = (text) => {
  const clean = String(text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'New conversation';
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
};

/**
 * GET /mentor/conversations
 * Lightweight list (no message bodies) for the sidebar.
 */
export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await MentorConversation.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .select('title topic level updatedAt createdAt messages')
    .lean();

  const summary = conversations.map((c) => ({
    _id: c._id,
    title: c.title,
    topic: c.topic,
    level: c.level,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    messageCount: c.messages?.length || 0,
    lastMessage: c.messages?.length ? c.messages[c.messages.length - 1].content.slice(0, 120) : '',
  }));

  return sendSuccess(res, { data: { conversations: summary } });
});

/**
 * POST /mentor/conversations
 * Create an empty conversation (optionally with topic/level).
 */
export const createConversation = asyncHandler(async (req, res) => {
  const { topic, level } = req.body;
  const conversation = await MentorConversation.create({
    userId: req.user._id,
    topic: topic || 'general',
    level: level || 'intermediate',
    messages: [],
  });
  return sendSuccess(res, { statusCode: 201, message: 'Conversation created.', data: { conversation } });
});

/**
 * GET /mentor/conversations/:id
 */
export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await MentorConversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();
  if (!conversation) throw ApiError.notFound('Conversation not found.');
  return sendSuccess(res, { data: { conversation } });
});

/**
 * POST /mentor/conversations/:id/message
 * Append a user message, generate the mentor reply, persist both.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { content, level } = req.body;
  if (!content || !String(content).trim()) {
    throw ApiError.badRequest('Message content is required.');
  }
  const text = String(content).trim().slice(0, 4000);

  const conversation = await MentorConversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found.');

  // Append the user's message.
  conversation.messages.push({ role: 'user', content: text, createdAt: new Date() });

  // Title the conversation from its first user message.
  if (conversation.title === 'New conversation') {
    conversation.title = deriveTitle(text);
  }
  if (level) conversation.level = level;

  try {
    // Build the bounded context window for the model.
    const history = conversation.messages
      .slice(-CONTEXT_WINDOW)
      .map((m) => ({ role: m.role, content: m.content }));

    const { reply, meta } = await mentorReply({
      messages: history,
      level: conversation.level,
    });

    const replyText = reply || 'Sorry, I could not generate a response. Please try rephrasing your question.';
    conversation.messages.push({ role: 'assistant', content: replyText, createdAt: new Date() });
    await conversation.save();

    await logAi('mentor_reply', {
      message: `Mentor reply in conversation ${conversation._id}`,
      userId: req.user._id,
      metadata: { conversationId: conversation._id, provider: meta.aiProvider },
    });

    return sendSuccess(res, {
      message: 'Reply generated.',
      data: {
        reply: replyText,
        conversation: {
          _id: conversation._id,
          title: conversation.title,
          level: conversation.level,
          messages: conversation.messages,
        },
      },
    });
  } catch (err) {
    // Persist the user message even if the AI call failed, so it isn't lost.
    await conversation.save();
    logger.error(`Mentor reply failed for user ${req.user._id}: ${err.message}`);
    await logAi('mentor_failed', {
      message: err.message,
      userId: req.user._id,
      metadata: { conversationId: conversation._id },
      level: 'error',
    });
    throw ApiError.internal('The mentor could not respond right now. Please try again.');
  }
});

/**
 * DELETE /mentor/conversations/:id
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await MentorConversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!conversation) throw ApiError.notFound('Conversation not found.');
  await conversation.deleteOne();
  return sendSuccess(res, { message: 'Conversation deleted.' });
});
