import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import JournalEntry from '../models/JournalEntry.js';

/**
 * GET /journal
 * Get user trading journal entries with filters and stats.
 */
export const listJournalEntries = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.market) filter.market = req.query.market;
  if (req.query.direction) filter.direction = req.query.direction;
  if (req.query.symbol) filter.symbol = new RegExp(req.query.symbol, 'i');

  const [items, total] = await Promise.all([
    JournalEntry.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    JournalEntry.countDocuments(filter),
  ]);

  // Aggregate user journal statistics
  const statsAggregate = await JournalEntry.aggregate([
    { $match: { userId: req.user._id } },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$status', 'win'] }, 1, 0] } },
        losses: { $sum: { $cond: [{ $eq: ['$status', 'loss'] }, 1, 0] } },
        breakevens: { $sum: { $cond: [{ $eq: ['$status', 'breakeven'] }, 1, 0] } },
        open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        totalPnl: { $sum: '$pnl' },
      },
    },
  ]);

  const rawStats = statsAggregate[0] || {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    open: 0,
    totalPnl: 0,
  };

  const closedTrades = rawStats.wins + rawStats.losses + rawStats.breakevens;
  const winrate = closedTrades > 0 ? Math.round((rawStats.wins / closedTrades) * 100) : 0;

  return sendSuccess(res, {
    data: {
      entries: items,
      stats: {
        ...rawStats,
        winrate,
        closedTrades,
      },
    },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * POST /journal
 * Create a new trading journal entry.
 */
export const createJournalEntry = asyncHandler(async (req, res) => {
  const {
    symbol,
    market,
    timeframe,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    lotSize,
    pnl,
    pnlPips,
    riskRewardRatio,
    strategy,
    setupType,
    confluences,
    status,
    notes,
    lessonsLearned,
    emotion,
    chartScreenshot,
    entryDate,
    exitDate,
  } = req.body;

  if (!symbol || !direction || entryPrice == null) {
    throw ApiError.badRequest('Le symbole, la direction (BUY/SELL) et le prix d\'entrée sont requis.');
  }

  const entry = await JournalEntry.create({
    userId: req.user._id,
    symbol: String(symbol).trim().toUpperCase(),
    market: market || 'forex',
    timeframe: timeframe || 'H1',
    direction,
    status: status || 'open',
    entryPrice: Number(entryPrice),
    exitPrice: exitPrice != null ? Number(exitPrice) : null,
    stopLoss: stopLoss != null ? Number(stopLoss) : null,
    takeProfit: takeProfit != null ? Number(takeProfit) : null,
    lotSize: lotSize != null ? Number(lotSize) : 0.1,
    pnl: pnl != null ? Number(pnl) : 0,
    pnlPips: pnlPips != null ? Number(pnlPips) : 0,
    riskRewardRatio: riskRewardRatio || '1:2.5',
    strategy: strategy || 'SMC',
    setupType: setupType || 'Order Block',
    confluences: Array.isArray(confluences) ? confluences : [],
    notes: notes || '',
    lessonsLearned: lessonsLearned || '',
    emotion: emotion || 'disciplined',
    chartScreenshot: chartScreenshot || '',
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    exitDate: exitDate ? new Date(exitDate) : null,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Entrée enregistrée dans votre Journal de Trading.',
    data: { entry },
  });
});

/**
 * PATCH /journal/:id
 * Update an existing journal entry (e.g. closing a trade, updating PnL).
 */
export const updateJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user._id });
  if (!entry) throw ApiError.notFound('Entrée de journal non trouvée.');

  const fields = [
    'status',
    'exitPrice',
    'stopLoss',
    'takeProfit',
    'lotSize',
    'pnl',
    'pnlPips',
    'riskRewardRatio',
    'strategy',
    'setupType',
    'confluences',
    'notes',
    'lessonsLearned',
    'emotion',
    'chartScreenshot',
    'exitDate',
  ];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      entry[f] = req.body[f];
    }
  }

  await entry.save();
  return sendSuccess(res, { message: 'Entrée mise à jour.', data: { entry } });
});

/**
 * DELETE /journal/:id
 */
export const deleteJournalEntry = asyncHandler(async (req, res) => {
  const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user._id });
  if (!entry) throw ApiError.notFound('Entrée de journal non trouvée.');
  await entry.deleteOne();
  return sendSuccess(res, { message: 'Entrée supprimée du journal.' });
});
