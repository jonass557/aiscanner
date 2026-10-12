import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import MentorConversation from '../models/MentorConversation.js';
import { mentorReply } from '../services/ai/index.js';
import { logAi } from '../services/logService.js';
import logger from '../config/logger.js';

import { getInitialCurriculum } from '../services/ai/curriculumData.js';
import { gradeExercise } from '../services/ai/index.js';

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
    .select('title topic level updatedAt createdAt messages curriculum activeLessonIndex studentProgress')
    .lean();

  const summary = conversations.map((c) => ({
    _id: c._id,
    title: c.title,
    topic: c.topic,
    level: c.level,
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    messageCount: c.messages?.length || 0,
    curriculumProgress: {
      activeLessonIndex: c.activeLessonIndex || 0,
      totalLessons: c.curriculum?.length || 0,
      completedCount: (c.curriculum || []).filter((l) => l.status === 'completed').length,
    },
    lastMessage: c.messages?.length ? c.messages[c.messages.length - 1].content.slice(0, 120) : '',
  }));

  return sendSuccess(res, { data: { conversations: summary } });
});

/**
 * POST /mentor/conversations
 * Create an empty conversation initialized with a personalized curriculum.
 */
export const createConversation = asyncHandler(async (req, res) => {
  const { topic, level } = req.body;
  const chosenLevel = level || 'intermediate';
  const initialCurriculum = getInitialCurriculum(chosenLevel);

  const conversation = await MentorConversation.create({
    userId: req.user._id,
    topic: topic || 'general',
    level: chosenLevel,
    curriculum: initialCurriculum,
    activeLessonIndex: 0,
    studentProgress: {
      overallScore: 0,
      completedCount: 0,
      totalLessons: initialCurriculum.length,
    },
    messages: [
      {
        role: 'assistant',
        content: `Bienvenue dans votre formation académique en trading institutionnel. Je suis votre Professeur Agrégé en Trading.

Nous travaillerons selon un syllabus universitaire rigoureux, inspiré des meilleures salles de marchés (SMC, ICT, Wyckoff, Risk Management).
Votre premier module d'études est **${initialCurriculum[0]?.title || 'Module 1'}**.

Vous pouvez me poser des questions vocalement ou par écrit, et lorsque vous vous sentirez prêt, soumettez l'exercice pratique pour valider votre passage au module suivant.`,
        createdAt: new Date(),
      },
    ],
  });
  return sendSuccess(res, { statusCode: 201, message: 'Conversation created.', data: { conversation } });
});

/**
 * GET /mentor/conversations/:id
 */
export const getConversation = asyncHandler(async (req, res) => {
  let conversation = await MentorConversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found.');

  // If conversation has no curriculum, initialize it dynamically
  if (!conversation.curriculum || conversation.curriculum.length === 0) {
    conversation.curriculum = getInitialCurriculum(conversation.level || 'intermediate');
    conversation.activeLessonIndex = 0;
    conversation.studentProgress = {
      overallScore: 0,
      completedCount: 0,
      totalLessons: conversation.curriculum.length,
    };
    await conversation.save();
  }

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

    const userLang = req.body.lang || req.user.preferences?.language || 'fr';

    const { reply, meta } = await mentorReply({
      messages: history,
      level: conversation.level,
      lang: userLang,
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
          curriculum: conversation.curriculum,
          activeLessonIndex: conversation.activeLessonIndex,
          studentProgress: conversation.studentProgress,
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
 * POST /mentor/conversations/:id/exercise/submit
 * Submit an answer to the current lesson's exercise, evaluated and graded by the AI Professor.
 */
export const submitExercise = asyncHandler(async (req, res) => {
  const { answer } = req.body;
  if (!answer || !String(answer).trim()) {
    throw ApiError.badRequest('La réponse à l\'exercice est obligatoire.');
  }

  const conversation = await MentorConversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found.');

  const curIndex = conversation.activeLessonIndex || 0;
  const currentLesson = conversation.curriculum[curIndex];
  if (!currentLesson) throw ApiError.badRequest('Aucune leçon active trouvée dans le cursus.');

  const exercise = currentLesson.exercise;
  if (!exercise) throw ApiError.badRequest('Cette leçon ne contient pas d\'exercice.');

  // Grade via AI Professor
  const evaluation = await gradeExercise({
    lesson: currentLesson,
    exercise,
    answer: String(answer).trim(),
    level: conversation.level,
  });

  // Record submission
  currentLesson.submission = {
    answer: String(answer).trim(),
    feedback: evaluation.feedback,
    score: evaluation.score,
    passed: evaluation.passed,
    submittedAt: new Date(),
    evaluatedAt: new Date(),
  };

  // If passed, mark current lesson completed and unlock next lesson
  if (evaluation.passed) {
    currentLesson.status = 'completed';
    currentLesson.completedAt = new Date();

    const nextIndex = curIndex + 1;
    if (nextIndex < conversation.curriculum.length) {
      conversation.curriculum[nextIndex].status = 'in_progress';
      conversation.activeLessonIndex = nextIndex;
    }
  } else {
    currentLesson.status = 'in_progress';
  }

  // Update overall progress metrics
  const completedCount = conversation.curriculum.filter((l) => l.status === 'completed').length;
  const totalScore = conversation.curriculum.reduce(
    (acc, l) => acc + (l.submission?.score || 0),
    0
  );
  conversation.studentProgress = {
    completedCount,
    totalLessons: conversation.curriculum.length,
    overallScore: completedCount > 0 ? Math.round(totalScore / completedCount) : 0,
  };

  // Add notification message from professor to the conversation transcript
  const verdictMsg = evaluation.passed
    ? `🎓 **Félicitations de votre Professeur !** Vous avez validé l'exercice du **${currentLesson.title}** avec une note de **${evaluation.score}/100**.\n\n${evaluation.feedback}\n\n*Le module suivant est désormais débloqué.*`
    : `📝 **Correction de l'exercice - ${currentLesson.title}** (Note : **${evaluation.score}/100** - Seuil requis : **${exercise.passingScore || 70}/100**).\n\n${evaluation.feedback}\n\n*Veuillez réviser vos arguments et soumettre à nouveau votre réponse pour valider la leçon.*`;

  conversation.messages.push({
    role: 'assistant',
    content: verdictMsg,
    createdAt: new Date(),
  });

  await conversation.save();

  return sendSuccess(res, {
    message: evaluation.passed ? 'Exercice validé avec succès !' : 'Exercice corrigé.',
    data: {
      evaluation,
      lesson: currentLesson,
      conversation,
    },
  });
});

/**
 * POST /mentor/conversations/:id/lesson/select
 * Switch active lesson if unlocked or completed.
 */
export const selectLesson = asyncHandler(async (req, res) => {
  const { lessonIndex } = req.body;
  const conversation = await MentorConversation.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found.');

  const idx = parseInt(lessonIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= conversation.curriculum.length) {
    throw ApiError.badRequest('Indice de leçon invalide.');
  }

  const targetLesson = conversation.curriculum[idx];
  if (targetLesson.status === 'locked') {
    throw ApiError.forbidden('Cette leçon est verrouillée. Vous devez valider les modules précédents.');
  }

  conversation.activeLessonIndex = idx;
  if (targetLesson.status === 'available') {
    targetLesson.status = 'in_progress';
  }
  await conversation.save();

  return sendSuccess(res, {
    message: 'Leçon sélectionnée.',
    data: { conversation },
  });
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
