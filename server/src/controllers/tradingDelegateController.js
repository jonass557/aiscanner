import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import TradingDelegateConfig from '../models/TradingDelegateConfig.js';
import Opportunity from '../models/Opportunity.js';
import InAppNotification from '../models/InAppNotification.js';
import { runDelegateSweep } from '../services/tradingDelegateService.js';
import logger from '../config/logger.js';

/**
 * GET /api/v1/delegate/config
 * Retrieve or initialize user's Trading Delegate configuration.
 */
export const getConfig = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let config = await TradingDelegateConfig.findOne({ userId });
  if (!config) {
    config = await TradingDelegateConfig.create({ userId });
  }
  config.ensureDailyReset();
  await config.save();

  return sendSuccess(res, 200, { config });
});

/**
 * PUT /api/v1/delegate/config
 * Update user's surveillance preferences and risk boundaries.
 */
export const updateConfig = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const body = req.body || {};

  let config = await TradingDelegateConfig.findOne({ userId });
  if (!config) {
    config = await TradingDelegateConfig.create({ userId });
  }

  const allowedFields = [
    'isEnabled',
    'isPassiveMode',
    'isConfigured',
    'customStrategy',
    'markets',
    'symbols',
    'timeframes',
    'strategies',
    'sessions',
    'minConfidenceScore',
    'minRiskReward',
    'maxRiskPerTradePercent',
    'operatingHours',
    'activeDays',
    'maxSignalsPerDay',
    'notifications',
    'invalidationRules',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      config[field] = body[field];
    }
  }

  config.ensureDailyReset();
  await config.save();

  return sendSuccess(res, 200, {
    config,
    message: 'Configuration de surveillance mise à jour avec succès.',
  });
});

/**
 * POST /api/v1/delegate/toggle
 * Start or pause the surveillance delegation.
 */
export const toggleDelegate = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let config = await TradingDelegateConfig.findOne({ userId });
  if (!config) {
    config = await TradingDelegateConfig.create({ userId, isConfigured: true });
  }

  config.isEnabled = !config.isEnabled;
  config.serverStatus = config.isEnabled ? 'active' : 'paused';
  config.isConfigured = true;
  config.ensureDailyReset();
  await config.save();

  logger.info(`Trading Delegate ${config.isEnabled ? 'ACTIVATED' : 'PAUSED'} for user ${userId}`);

  return sendSuccess(res, 200, {
    config,
    message: config.isEnabled
      ? 'Délégation de surveillance activée côté serveur avec succès.'
      : 'Délégation de surveillance mise en pause.',
  });
});

/**
 * POST /api/v1/delegate/passive-mode
 * One-click toggle for "Mode Je n'ai pas le temps de trader".
 */
export const togglePassiveMode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let config = await TradingDelegateConfig.findOne({ userId });
  if (!config) {
    config = await TradingDelegateConfig.create({ userId });
  }

  const activate = req.body?.activate !== undefined ? Boolean(req.body.activate) : !config.isPassiveMode;

  config.isPassiveMode = activate;
  if (activate) {
    config.isEnabled = true;
    config.serverStatus = 'active';
    // Optimize for passive hands-free trading: high confidence, alerts via email & in-app
    config.minConfidenceScore = Math.max(config.minConfidenceScore, 78);
    config.minRiskReward = Math.max(config.minRiskReward, 2.0);
    config.notifications = {
      ...config.notifications,
      inApp: true,
      email: true,
    };
  }

  await config.save();

  return sendSuccess(res, 200, {
    config,
    message: activate
      ? 'Mode "Je n\'ai pas le temps de trader" activé ! Le serveur surveille vos marchés et vous alertera uniquement sur les setups majeurs.'
      : 'Mode "Je n\'ai pas le temps de trader" désactivé.',
  });
});

/**
 * GET /api/v1/delegate/opportunities
 * Stream of curated opportunities for this user with lifecycle filter.
 */
export const getOpportunities = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, market, limit = 40, page = 1 } = req.query;

  const query = {
    $or: [{ userId }, { userId: null }],
  };

  if (status) {
    query.status = status;
  }
  if (market) {
    query.market = market;
  }

  const items = await Opportunity.find(query)
    .sort({ detectedAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Opportunity.countDocuments(query);

  return sendSuccess(res, 200, { opportunities: items, total, page: Number(page) });
});

/**
 * GET /api/v1/delegate/opportunities/:id
 * Detailed Opportunity Sheet ("Fiche d'Opportunité").
 */
export const getOpportunityDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const opportunity = await Opportunity.findById(id);
  if (!opportunity) {
    throw ApiError.notFound('Opportunité introuvable.');
  }

  return sendSuccess(res, 200, { opportunity });
});

/**
 * GET /api/v1/delegate/notifications
 * In-App notifications feed with unread counter.
 */
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 30 } = req.query;

  const notifications = await InAppNotification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  const unreadCount = await InAppNotification.countDocuments({ userId, isRead: false });

  return sendSuccess(res, 200, { notifications, unreadCount });
});

/**
 * PATCH /api/v1/delegate/notifications/:id/read
 */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notif = await InAppNotification.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  return sendSuccess(res, 200, { notification: notif });
});

/**
 * POST /api/v1/delegate/notifications/read-all
 */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await InAppNotification.updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });

  return sendSuccess(res, 200, { message: 'Toutes les notifications ont été marquées comme lues.' });
});

/**
 * POST /api/v1/delegate/sweep
 * Trigger an immediate surveillance sweep.
 */
export const triggerSweep = asyncHandler(async (req, res) => {
  const sweepResult = await runDelegateSweep();
  return sendSuccess(res, 200, {
    result: sweepResult,
    message: 'Balayage de surveillance terminé.',
  });
});
