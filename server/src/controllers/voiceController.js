import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import VoiceConversation from '../models/VoiceConversation.js';
import { parseIntent } from '../services/voice/intentEngine.js';
import { synthesizeSpeech, transcribeAudio } from '../services/voice/index.js';
import { mentorReply } from '../services/ai/index.js';
import Analysis from '../models/Analysis.js';
import Opportunity from '../models/Opportunity.js';
import { getUpcomingHighImpact } from '../services/economicCalendarService.js';

/**
 * Resolves a dataKey against the user's live context so the voice assistant
 * can answer "quel est mon stop loss?" etc. with actual facts.
 */
const resolveData = async (dataKey, user) => {
  switch (dataKey) {
    case 'current_analysis': {
      const a = await Analysis.findOne({ userId: user._id, status: 'completed' })
        .sort({ createdAt: -1 })
        .lean();
      return a || null;
    }
    case 'opportunities':
      return Opportunity.find({ status: 'active', expiresAt: { $gt: new Date() } })
        .sort({ confidenceScore: -1 })
        .limit(10)
        .lean();
    case 'news': {
      const events = await getUpcomingHighImpact(48);
      return events;
    }
    default:
      return null;
  }
};

/**
 * Build a concise reply for explain_* intents using the last analysis data.
 */
const buildExplainReply = (action, analysis) => {
  if (!analysis) return null;
  const tp = analysis.tradePlan || {};
  const rep = analysis.report || {};
  switch (action) {
    case 'explain_stop_loss':
      return `Stop Loss à ${tp.stopLoss || 'non défini'}. Raison : le stop est placé derrière un niveau technique clé pour protéger le trade d'un faux mouvement. ${rep.risks?.length ? 'Risque identifié : ' + rep.risks[0] : ''}`;
    case 'explain_take_profit':
      return `Take Profit 1 à ${tp.takeProfit1 || 'non défini'}, Take Profit 2 à ${tp.takeProfit2 || 'non défini'}. Ces cibles correspondent à des zones de liquidité visibles sur le graphique.`;
    case 'explain_rr':
      return `Le ratio risque/rendement est ${tp.riskRewardRatio || 'indisponible'}. ${tp.riskRewardRatio && tp.riskRewardRatio.replace('1:', '') > 2 ? 'C\'est favorable, au-dessus du seuil de 1:2.' : 'Visez au moins 1:2 avant de prendre ce trade.'}`;
    case 'explain_confidence':
      return `Score de confiance : ${analysis.confidenceScore}%. Ce score est basé sur ${(rep.confluences || []).length} confluences techniques détectées.`;
    case 'explain_why_buy':
      return `Signal d'achat sur ${analysis.symbol} (${analysis.timeframe}). Structure : ${analysis.technicalAnalysis?.marketStructure || ''}. Confluences : ${(rep.confluences || []).join(', ')}. Confiance ${analysis.confidenceScore}%.`;
    case 'explain_why_sell':
      return `Signal de vente sur ${analysis.symbol} (${analysis.timeframe}). Structure : ${analysis.technicalAnalysis?.marketStructure || ''}. Confluences : ${(rep.confluences || []).join(', ')}. Confiance ${analysis.confidenceScore}%.`;
    case 'explain_why_no_trade':
      return `Pas de trade recommandé pour ${analysis.symbol}. Confiance ${analysis.confidenceScore}% (< 70%). Raisons : ${(rep.weaknesses || []).join('; ') || 'aucun signal clair détecté'}.`;
    case 'summarize_analysis':
      return rep.summary || analysis.technicalAnalysis?.marketStructure || 'Analyse indisponible.';
    case 'explain_analysis':
      return `${rep.summary || ''} Décision : ${analysis.decision} à ${analysis.confidenceScore}%. ${(rep.validationReasons || []).join('. ')}`;
    default:
      return null;
  }
};

/**
 * POST /voice/command
 * Accepts a transcript, resolves the intent, fetches context data, generates
 * a spoken reply, and returns text + optional audio + a UI directive.
 */
export const handleVoiceCommand = asyncHandler(async (req, res) => {
  const { transcript, conversationId, language } = req.body;
  if (!transcript || !String(transcript).trim()) {
    throw ApiError.badRequest('Transcript is required.');
  }
  const text = String(transcript).trim();
  const lang = String(language || 'fr').slice(0, 2);

  // 1. Parse intent
  const intent = parseIntent(text);

  // 2. Load or create conversation doc
  let conv;
  if (conversationId) {
    conv = await VoiceConversation.findOne({ _id: conversationId, user: req.user._id });
  }
  if (!conv) {
    conv = await VoiceConversation.create({
      user: req.user._id,
      title: text.length > 50 ? text.slice(0, 47) + '…' : text,
    });
  }

  // 3. Add user turn
  const userTurn = { role: 'user', text, action: intent.action, createdAt: new Date() };
  conv.turns.push(userTurn);

  // 4. Resolve the intent
  let reply;

  // 4a. Pre-baked response from intent definition.
  if (intent.response && !intent.needsAI) {
    reply = intent.response;
  } else if (intent.dataKey === 'current_analysis') {
    const analysis = await resolveData('current_analysis', req.user);
    const explain = buildExplainReply(intent.action, analysis);
    if (explain) {
      reply = explain;
    } else if (intent.needsAI) {
      // Build a focused prompt with the analysis as context.
      const ctx = analysis
        ? `Le trade est ${analysis.symbol} ${analysis.timeframe}, décision ${analysis.decision}, confiance ${analysis.confidenceScore}%, entrée ${analysis.tradePlan?.entry}, SL ${analysis.tradePlan?.stopLoss}, TP ${analysis.tradePlan?.takeProfit1}. Résumé : ${analysis.report?.summary}`
        : 'Aucune analyse récente.';
      const { reply: aiReply } = await mentorReply({
        messages: [
          {
            role: 'user',
            content: `Contexte de mon dernier trade : ${ctx}\n\nRéponds en français, en 1 à 3 phrases concises, sans markdown. Ma question : ${text}`,
          },
        ],
      });
      reply = aiReply;
    }
  } else if (intent.needsAI) {
    // Open question — use the mentor. Keep it short and spoken-friendly.
    const instruction =
      lang === 'fr'
        ? 'Réponds de façon concise (2 à 4 phrases), en français, sans markdown ni listes.'
        : 'Answer concisely (2-4 sentences), in English, no markdown or lists.';
    const { reply: aiReply } = await mentorReply({
      messages: [{ role: 'user', content: `${instruction}\n\n${text}` }],
    });
    reply = aiReply;
  }

  reply = reply || 'Je n\'ai pas pu répondre à cette question. Reformulez ou demandez-moi d\'expliquer un concept de trading.';

  // 5. Save assistant turn
  const assistantTurn = { role: 'assistant', text: reply, createdAt: new Date() };
  conv.turns.push(assistantTurn);
  conv.lastMessageAt = new Date();
  await conv.save();

  // 6. Synthesize speech (null = client-side Web Speech)
  const audioResult = await synthesizeSpeech({ text: reply, language: lang }).catch(() => null);

  const response = {
    transcript: text,
    reply,
    intent: { action: intent.action },
    conversationId: conv._id,
    audioAvailable: !audioResult, // true → client synthesizes; false → use audioUrl
    audioUrl: audioResult ? null : null, // placeholder; server-side audio would go here
    directive: intent.directive || null,
  };

  return sendSuccess(res, { data: response });
});

/**
 * POST /voice/transcribe  (server-side STT, optional route)
 * Provided so mobile or desktop can have the server run Whisper instead of
 * relying on the browser's Web Speech API.
 */
export const transcribe = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Audio file required.');
  const { text } = await transcribeAudio({
    audio: req.file.buffer,
    mimeType: req.file.mimetype,
    language: req.body.language || 'fr',
  });
  return sendSuccess(res, { data: { text } });
});

/**
 * GET /voice/conversations
 * List the user's voice conversations.
 */
export const listConversations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { user: req.user._id };
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [items, total] = await Promise.all([
    VoiceConversation.find(filter)
      .select('title lastMessageAt turns createdAt')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    VoiceConversation.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { conversations: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /voice/conversations/:id */
export const getConversation = asyncHandler(async (req, res) => {
  const conv = await VoiceConversation.findOne({
    _id: req.params.id,
    user: req.user._id,
  }).lean();
  if (!conv) throw ApiError.notFound('Conversation not found.');
  return sendSuccess(res, { data: { conversation: conv } });
});

/** DELETE /voice/conversations/:id */
export const deleteConversation = asyncHandler(async (req, res) => {
  const conv = await VoiceConversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!conv) throw ApiError.notFound('Conversation not found.');
  await conv.deleteOne();
  return sendSuccess(res, { message: 'Conversation deleted.' });
});
