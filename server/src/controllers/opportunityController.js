import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Opportunity from '../models/Opportunity.js';
import { runScan, SYMBOL_UNIVERSE } from '../services/opportunityScanner.js';

/**
 * GET /opportunities
 * Ranked, filterable board of active opportunities.
 * Filters: market, timeframe, direction, setupType, riskLevel, minConfidence.
 */
export const listOpportunities = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (page - 1) * limit;

  const filter = { status: 'active', expiresAt: { $gt: new Date() } };
  if (req.query.market) filter.market = req.query.market;
  if (req.query.timeframe) filter.timeframe = req.query.timeframe;
  if (req.query.direction) filter.direction = req.query.direction;
  if (req.query.setupType) filter.setupType = req.query.setupType;
  if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
  if (req.query.minConfidence) filter.confidenceScore = { $gte: Number(req.query.minConfidence) };
  if (req.query.symbol) filter.symbol = new RegExp(req.query.symbol, 'i');

  const [items, total] = await Promise.all([
    Opportunity.find(filter).sort({ confidenceScore: -1, detectedAt: -1 }).skip(skip).limit(limit).lean(),
    Opportunity.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { opportunities: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /opportunities/meta
 * Filter option lists + universe stats for building the UI.
 */
export const getMeta = asyncHandler(async (req, res) => {
  const [total, byMarket] = await Promise.all([
    Opportunity.countDocuments({ status: 'active', expiresAt: { $gt: new Date() } }),
    Opportunity.aggregate([
      { $match: { status: 'active', expiresAt: { $gt: new Date() } } },
      { $group: { _id: '$market', count: { $sum: 1 } } },
    ]),
  ]);

  return sendSuccess(res, {
    data: {
      activeTotal: total,
      byMarket: byMarket.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {}),
      markets: ['forex', 'crypto', 'indices', 'commodities', 'synthetic'],
      timeframes: ['M15', 'H1', 'H4', 'D1'],
      setupTypes: ['order-block', 'fair-value-gap', 'breaker-block', 'liquidity-sweep', 'trend-continuation', 'reversal'],
      riskLevels: ['low', 'medium', 'high'],
      universeSize: SYMBOL_UNIVERSE.length,
    },
  });
});

/**
 * GET /opportunities/:id
 */
export const getOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.id).lean();
  if (!opportunity) throw ApiError.notFound('Opportunity not found.');
  return sendSuccess(res, { data: { opportunity } });
});

/**
 * POST /opportunities/scan
 * Trigger an immediate scan sweep on demand (optionally per-market).
 */
export const triggerScan = asyncHandler(async (req, res) => {
  const { market } = req.body || {};
  const result = await runScan({ market });
  return sendSuccess(res, {
    message: `Scan complete: ${result.created} new opportunities.`,
    data: result,
  });
});
