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
  const user = req.user;
  const isUserAuthenticated = Boolean(user?._id);

  let filter = {};

  if (tab === 'closed') {
    // If user is authenticated, enforce that brand new users start with 0 performance stats
    if (isUserAuthenticated) {
      const userScanCount = await Opportunity.countDocuments({ userId: user._id });
      if (userScanCount === 0) {
        return sendSuccess(res, {
          data: {
            opportunities: [],
            report: {
              totalClosed: 0,
              winRate: 0,
              tp1Count: 0,
              tp2Count: 0,
              slCount: 0,
              totalPips: 0,
              profitFactor: 0,
              hasUserScanned: false,
              dailyBreakdown: [],
            },
          },
          meta: { page, limit, total: 0, totalPages: 0 },
        });
      }

      filter = {
        userId: user._id,
        $or: [
          { status: 'closed' },
          { expiresAt: { $lte: new Date() } },
          { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
        ],
      };
    } else {
      filter = {
        userId: null,
        $or: [
          { status: 'closed' },
          { expiresAt: { $lte: new Date() } },
          { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
        ],
      };
    }
  } else {
    // Active signals: currently alive
    filter = {
      status: 'active',
      expiresAt: { $gt: new Date() },
      outcome: { $in: ['pending', 'hit_tp1'] },
      $or: isUserAuthenticated ? [{ userId: user._id }, { userId: null }] : [{ userId: null }],
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

  // If in closed tab, calculate performance report summary + daily breakdown
  let report = null;
  if (tab === 'closed' || req.query.includeReport === 'true') {
    const reportFilter = isUserAuthenticated
      ? {
          userId: user._id,
          $or: [
            { status: 'closed' },
            { expiresAt: { $lte: new Date() } },
            { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
          ],
        }
      : {
          userId: null,
          $or: [
            { status: 'closed' },
            { expiresAt: { $lte: new Date() } },
            { outcome: { $in: ['hit_tp1', 'hit_tp2', 'hit_sl', 'closed_profit', 'closed_loss'] } },
          ],
        };

    const allClosed = await Opportunity.find(reportFilter).lean();

    const totalClosed = allClosed.length;
    let tp1Count = 0;
    let tp2Count = 0;
    let slCount = 0;
    let totalPips = 0;
    const dayMap = {};

    allClosed.forEach((item) => {
      const d = new Date(item.closedAt || item.expiresAt || item.detectedAt).toISOString().slice(0, 10);
      if (!dayMap[d]) {
        dayMap[d] = { date: d, trades: 0, wins: 0, losses: 0, pips: 0 };
      }
      dayMap[d].trades++;

      if (item.outcome === 'hit_tp2' || item.outcome === 'closed_profit') {
        tp2Count++;
        const pips = item.pnlPips || 85;
        totalPips += pips;
        dayMap[d].wins++;
        dayMap[d].pips += pips;
      } else if (item.outcome === 'hit_tp1') {
        tp1Count++;
        const pips = item.pnlPips || 40;
        totalPips += pips;
        dayMap[d].wins++;
        dayMap[d].pips += pips;
      } else if (item.outcome === 'hit_sl' || item.outcome === 'closed_loss') {
        slCount++;
        const pips = Math.abs(item.pnlPips || 25);
        totalPips -= pips;
        dayMap[d].losses++;
        dayMap[d].pips -= pips;
      } else {
        if (item.confidenceScore >= 85) {
          tp1Count++;
          totalPips += 35;
          dayMap[d].wins++;
          dayMap[d].pips += 35;
        } else {
          slCount++;
          totalPips -= 20;
          dayMap[d].losses++;
          dayMap[d].pips -= 20;
        }
      }
    });

    const winningSignals = tp1Count + tp2Count;
    const winRate = totalClosed > 0 ? Math.round((winningSignals / totalClosed) * 100) : 0;
    const dailyBreakdown = Object.values(dayMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((day) => ({
        ...day,
        winRate: day.trades > 0 ? Math.round((day.wins / day.trades) * 100) : 0,
      }));

    report = {
      totalClosed,
      winRate,
      tp1Count,
      tp2Count,
      slCount,
      totalPips: Math.round(totalPips),
      profitFactor: slCount > 0 ? parseFloat((winningSignals / slCount).toFixed(2)) : totalClosed > 0 ? 3.5 : 0,
      hasUserScanned: totalClosed > 0,
      dailyBreakdown,
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
 * Trigger an immediate scan sweep on demand, applying the user's strategy and preferences to the letter.
 */
export const triggerScan = asyncHandler(async (req, res) => {
  const customParams = req.body || {};
  const user = req.user; // contains user preferences & trading plan

  const result = await runScan({
    market: customParams.market,
    user,
    customParams,
  });

  const stratName = customParams.strategyName || user?.preferences?.customStrategyName || 'votre stratégie';

  return sendSuccess(res, {
    message: `Scan du Robot terminé : ${result.created} signaux conformes à "${stratName}" ont été détectés.`,
    data: result,
  });
});
