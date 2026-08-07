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
