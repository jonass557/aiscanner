import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Analysis from '../models/Analysis.js';
import { deleteImage } from '../services/uploadService.js';
import { generateAnalysisPDF, generateAnalysesCSV } from '../services/exportService.js';

/**
 * Builds a MongoDB filter from query params, always scoped to the owner.
 */
const buildFilter = (userId, query) => {
  const filter = { userId };
  if (query.market) filter.market = query.market;
  if (query.decision) filter.decision = query.decision;
  if (query.symbol) filter.symbol = new RegExp(query.symbol, 'i');
  if (query.status) filter.status = query.status;

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }
  if (query.minConfidence) {
    filter.confidenceScore = { $gte: Number(query.minConfidence) };
  }
  return filter;
};

/**
 * GET /analyses
 * Paginated, filterable, searchable history for the current user.
 */
export const listAnalyses = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = buildFilter(req.user._id, req.query);

  const sortField = ['createdAt', 'confidenceScore', 'symbol'].includes(req.query.sortBy)
    ? req.query.sortBy
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Analysis.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(limit).lean(),
    Analysis.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { analyses: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /analyses/:id
 */
export const getAnalysis = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!analysis) throw ApiError.notFound('Analysis not found.');
  return sendSuccess(res, { data: { analysis } });
});

/**
 * DELETE /analyses/:id
 */
export const deleteAnalysis = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id });
  if (!analysis) throw ApiError.notFound('Analysis not found.');

  await deleteImage(analysis.imagePublicId);
  await analysis.deleteOne();

  return sendSuccess(res, { message: 'Analysis deleted.' });
});

/**
 * POST /analyses/:id/feedback
 * Quality feedback loop (Engine 5 — continuous improvement). The owner rates an
 * analysis 👍/👎 with an optional comment; ratings are later aggregated per
 * provider/engineVersion in the admin stats to compare model quality (A/B base).
 * A null rating clears the feedback.
 */
export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  if (rating != null && !['up', 'down'].includes(rating)) {
    throw ApiError.badRequest("Rating must be 'up', 'down', or null.");
  }

  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id });
  if (!analysis) throw ApiError.notFound('Analysis not found.');

  analysis.feedback = {
    rating: rating ?? null,
    comment: comment ? String(comment).slice(0, 1000) : undefined,
    ratedAt: rating ? new Date() : undefined,
  };
  await analysis.save();

  return sendSuccess(res, { message: 'Feedback saved.', data: { feedback: analysis.feedback } });
});

/**
 * GET /analyses/stats
 * Aggregated dashboard statistics for the current user.
 */
export const getStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totals, byDecision, byMarket, recent] = await Promise.all([
    Analysis.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgConfidence: { $avg: '$confidenceScore' },
        },
      },
    ]),
    Analysis.aggregate([{ $match: { userId } }, { $group: { _id: '$decision', count: { $sum: 1 } } }]),
    Analysis.aggregate([{ $match: { userId } }, { $group: { _id: '$market', count: { $sum: 1 } } }]),
    Analysis.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Scans over the last 7 days for a chart.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const dailyScans = await Analysis.aggregate([
    { $match: { userId, createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const user = req.user;
  user.checkAndResetMonthlyScans();

  return sendSuccess(res, {
    data: {
      total: totals[0]?.total || 0,
      avgConfidence: Math.round(totals[0]?.avgConfidence || 0),
      byDecision: byDecision.reduce((acc, d) => ({ ...acc, [d._id]: d.count }), {}),
      byMarket: byMarket.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {}),
      dailyScans,
      recent,
      subscription: {
        plan: user.subscription.plan,
        scansUsed: user.subscription.scansUsed,
        scansPerMonth: user.subscription.scansPerMonth,
        scansRemaining: user.subscription.scansRemaining,
      },
    },
  });
});

/**
 * GET /analyses/:id/export/pdf
 */
export const exportPDF = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!analysis) throw ApiError.notFound('Analysis not found.');

  const pdf = await generateAnalysisPDF(analysis);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysis.symbol}-${analysis._id}.pdf"`);
  return res.send(pdf);
});

/**
 * GET /analyses/export/csv
 * Exports the filtered history as CSV (respects the same filters as the list).
 */
export const exportCSV = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.user._id, req.query);
  const analyses = await Analysis.find(filter).sort({ createdAt: -1 }).limit(5000).lean();

  const csv = generateAnalysesCSV(analyses);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="chart-analyses.csv"');
  return res.send(csv);
});

/**
 * POST /analyses/:id/chat
 * Ask questions to the AI about this specific scan analysis.
 */
export const askAnalysisQuestion = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    throw ApiError.badRequest('Question text is required.');
  }

  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id });
  if (!analysis) throw ApiError.notFound('Analysis not found.');

  // Contextualize the prompt with the exact scan facts
  const contextSummary = {
    symbol: analysis.symbol,
    timeframe: analysis.timeframe,
    market: analysis.market,
    currentPrice: analysis.currentPrice,
    decision: analysis.decision,
    confidenceScore: analysis.confidenceScore,
    confidenceLabel: analysis.confidenceLabel,
    tradePlan: analysis.tradePlan,
    technicalSummary: analysis.technicalAnalysis?.marketStructure,
    report: analysis.report,
    customStrategy: analysis.customStrategy,
  };

  const systemPrompt = `You are a world-class institutional trading mentor and hedge fund risk manager.
The trader is asking you a question about a SPECIFIC chart analysis that was just performed.

EXACT VERIFIED ANALYSIS CONTEXT:
${JSON.stringify(contextSummary, null, 2)}

STRICT RULES:
1. NEVER hallucinate or invent price levels or signals not supported by the analysis context.
2. Provide deep, institutional-grade explanations (Order Flow, Liquidity sweeps, Inefficiencies, Market Structure, Risk-Reward).
3. Be completely honest and constructive: if the trader is misinterpreting something or proposing a dangerous/premature trade, tell them directly and explain the exact technical error.
4. Speak professionally, encouragingly, and clearly in French. Keep explanations actionable.`;

  const previousHistory = (analysis.chatMessages || []).slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    ...previousHistory,
    { role: 'user', content: question.trim() },
  ];

  const { getProvider } = await import('../services/ai/index.js');
  const provider = getProvider();

  let aiReply = '';
  try {
    aiReply = await provider.chat({ systemPrompt, messages });
  } catch (err) {
    throw ApiError.internal(`AI failed to answer: ${err.message}`);
  }

  // Persist messages in the analysis document
  analysis.chatMessages = analysis.chatMessages || [];
  analysis.chatMessages.push({ role: 'user', content: question.trim() });
  analysis.chatMessages.push({ role: 'assistant', content: aiReply });
  await analysis.save();

  return sendSuccess(res, {
    statusCode: 200,
    message: 'Question answered.',
    data: {
      reply: aiReply,
      chatMessages: analysis.chatMessages,
    },
  });
});

/**
 * GET /analyses/:id/chat
 * Retrieve the chat history for this analysis.
 */
export const getAnalysisChat = asyncHandler(async (req, res) => {
  const analysis = await Analysis.findOne({ _id: req.params.id, userId: req.user._id }).select('chatMessages');
  if (!analysis) throw ApiError.notFound('Analysis not found.');
  return sendSuccess(res, {
    data: { chatMessages: analysis.chatMessages || [] },
  });
});
