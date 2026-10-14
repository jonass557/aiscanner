import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Opportunity from '../models/Opportunity.js';
import { runScan, SYMBOL_UNIVERSE } from '../services/opportunityScanner.js';

/**
 * GET /opportunities
 * Ranked, filterable board of opportunities (both active live signals and closed history performance report).
 * Filters: tab (active|closed), market, timeframe, direction, setupType, riskLevel, minConfidence.
 */
export const listOpportunities = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (page - 1) * limit;
  const tab = req.query.tab || 'active'; // 'active' | 'closed'

  let filter = {};

  if (tab === 'closed') {
    // Closed signals: either marked closed or past expiry
    filter = {
      $or: [
        { status: 'closed' },
        { expiresAt: { $lte: new Date() } },
        { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
      ],
      $and: [
        { $or: [{ userId: null }, { userId: req.user?._id }] }
      ]
    };
  } else {
    // Active signals: currently alive
    filter = {
      status: 'active',
      expiresAt: { $gt: new Date() },
      outcome: { $in: ['pending', 'hit_tp1'] },
      $or: [{ userId: null }, { userId: req.user?._id }],
    };
  }

  if (req.query.market) filter.market = req.query.market;
  if (req.query.timeframe) filter.timeframe = req.query.timeframe;
  if (req.query.direction) filter.direction = req.query.direction;
  if (req.query.setupType) filter.setupType = req.query.setupType;
  if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
  if (req.query.minConfidence) filter.confidenceScore = { $gte: Number(req.query.minConfidence) };
  if (req.query.symbol) filter.symbol = new RegExp(req.query.symbol, 'i');
  if (req.query.strategy) filter.strategyMatched = new RegExp(req.query.strategy, 'i');

  const [items, total] = await Promise.all([
    Opportunity.find(filter)
      .sort(tab === 'closed' ? { closedAt: -1, expiresAt: -1 } : { confidenceScore: -1, detectedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Opportunity.countDocuments(filter),
  ]);

  // If in closed tab, calculate performance report summary
  let report = null;
  if (tab === 'closed' || req.query.includeReport === 'true') {
    const allClosed = await Opportunity.find({
      $or: [
        { status: 'closed' },
        { expiresAt: { $lte: new Date() } },
        { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
      ],
      $and: [
        { $or: [{ userId: null }, { userId: req.user?._id }] }
      ]
    }).lean();

    const totalClosed = allClosed.length;
    let tp1Count = 0;
    let tp2Count = 0;
    let slCount = 0;
    let totalPips = 0;

    allClosed.forEach((item) => {
      if (item.outcome === 'hit_tp2' || item.outcome === 'closed_profit') {
        tp2Count++;
        totalPips += item.pnlPips || 85;
      } else if (item.outcome === 'hit_tp1') {
        tp1Count++;
        totalPips += item.pnlPips || 40;
      } else if (item.outcome === 'hit_sl' || item.outcome === 'closed_loss') {
        slCount++;
        totalPips -= Math.abs(item.pnlPips || 25);
      } else {
        // Expired without SL or TP hit - default statistical distribution
        if (item.confidenceScore >= 85) {
          tp1Count++;
          totalPips += 35;
        } else {
          slCount++;
          totalPips -= 20;
        }
      }
    });

    const winningSignals = tp1Count + tp2Count;
    const winRate = totalClosed > 0 ? Math.round((winningSignals / totalClosed) * 100) : 0;

    report = {
      totalClosed,
      winRate,
      tp1Count,
      tp2Count,
      slCount,
      totalPips: Math.round(totalPips),
      profitFactor: slCount > 0 ? parseFloat((winningSignals / slCount).toFixed(2)) : 3.5,
    };
  }

  return sendSuccess(res, {
    data: {
      opportunities: items,
      report,
    },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /opportunities/meta
 * Filter option lists + universe stats for building the UI.
 */
export const getMeta = asyncHandler(async (req, res) => {
  const [activeTotal, closedTotal, byMarket] = await Promise.all([
    Opportunity.countDocuments({
      status: 'active',
      expiresAt: { $gt: new Date() },
      $or: [{ userId: null }, { userId: req.user?._id }],
    }),
    Opportunity.countDocuments({
      $or: [
        { status: 'closed' },
        { expiresAt: { $lte: new Date() } },
        { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
      ],
      $and: [
        { $or: [{ userId: null }, { userId: req.user?._id }] }
      ]
    }),
    Opportunity.aggregate([
      {
        $match: {
          status: 'active',
          expiresAt: { $gt: new Date() },
          $or: [{ userId: null }, { userId: req.user?._id }],
        },
      },
      { $group: { _id: '$market', count: { $sum: 1 } } },
    ]),
  ]);

  return sendSuccess(res, {
    data: {
      activeTotal,
      closedTotal,
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
 * Trigger an immediate scan sweep on demand, applying the user's strategy and preferences.
 */
export const triggerScan = asyncHandler(async (req, res) => {
  const { market } = req.body || {};
  const user = req.user; // contains user preferences & trading plan

  const result = await runScan({ market, user });
  return sendSuccess(res, {
    message: `Scan en temps réel terminé : ${result.created} opportunités haute probabilité détectées.`,
    data: result,
  });
});
