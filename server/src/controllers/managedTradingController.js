import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import ManagedTradingConfig from '../models/ManagedTradingConfig.js';
import BrokerAccount from '../models/BrokerAccount.js';
import ManagedOrder from '../models/ManagedOrder.js';
import Opportunity from '../models/Opportunity.js';
import { executeManagedOrder, triggerEmergencyStop, resetEmergencyStop as serviceResetEmergency } from '../services/trading/orderExecutionService.js';
import { getBrokerAdapter } from '../services/trading/brokerAdapters/BrokerAdapterFactory.js';
import logger from '../config/logger.js';

/**
 * GET /api/v1/managed-trading/config
 */
export const getConfig = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let config = await ManagedTradingConfig.findOne({ userId }).populate('activeBrokerAccountId');
  if (!config) {
    config = await ManagedTradingConfig.create({ userId });
  }
  config.ensureDailyMetricsReset();
  await config.save();

  return sendSuccess(res, 200, { config });
});

/**
 * PUT /api/v1/managed-trading/config
 * Update risk limits & preferences.
 * Cannot enable 'automated' mode through simple PUT — requires /activate-automation.
 */
export const updateConfig = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const body = req.body || {};

  let config = await ManagedTradingConfig.findOne({ userId });
  if (!config) {
    config = await ManagedTradingConfig.create({ userId });
  }

  // Prevent activating automated mode via simple PUT
  if (body.operatingMode === 'automated' && config.operatingMode !== 'automated') {
    if (!config.explicitAuthorization?.confirmed) {
      throw ApiError.badRequest(
        'L\'activation du mode automatisé requiert une confirmation explicite via l\'écran d\'autorisation préalable.'
      );
    }
  }

  const allowedFields = [
    'activeBrokerAccountId',
    'operatingMode',
    'maxRiskPerTradePercent',
    'maxRiskPerTradeAmount',
    'maxDailyLossPercent',
    'maxDailyLossAmount',
    'maxDrawdownPercent',
    'maxOpenPositions',
    'maxOrdersPerDay',
    'maxAllowedSlippagePercent',
    'allowedMarkets',
    'allowedSymbols',
    'allowedStrategies',
    'minConfidenceScore',
    'minRiskReward',
    'tradingHours',
    'onDisconnectBehavior',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      config[field] = body[field];
    }
  }

  await config.save();
  return sendSuccess(res, 200, { config, message: 'Configuration mise à jour avec succès.' });
});

/**
 * POST /api/v1/managed-trading/activate-automation
 * Explicit Authorization Flow: Requires acknowledgement of risks and explicit confirmation.
 */
export const activateAutomation = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { acknowledgedRisks, brokerAccountId } = req.body || {};

  if (!acknowledgedRisks) {
    throw ApiError.badRequest(
      'Vous devez obligatoirement accepter et reconnaître les risques liés à l\'automatisation des ordres.'
    );
  }

  let config = await ManagedTradingConfig.findOne({ userId });
  if (!config) {
    config = await ManagedTradingConfig.create({ userId });
  }

  // Verify broker account is selected and has trade permission
  const accountId = brokerAccountId || config.activeBrokerAccountId;
  if (!accountId) {
    throw ApiError.badRequest('Veuillez sélectionner un compte broker valide avant d\'activer l\'automatisation.');
  }

  const brokerAccount = await BrokerAccount.findById(accountId);
  if (!brokerAccount) {
    throw ApiError.notFound('Compte broker introuvable.');
  }

  if (brokerAccount.accountType !== 'paper' && !brokerAccount.isTradeAuthorized) {
    throw ApiError.forbidden(
      'Ce compte broker ne dispose pas des droits de passage d\'ordres (permission "trade" manquante).'
    );
  }

  config.activeBrokerAccountId = brokerAccount._id;
  config.operatingMode = 'automated';
  config.isEmergencyStopped = false;
  config.emergencyStoppedAt = null;
  config.emergencyStopReason = '';
  config.explicitAuthorization = {
    confirmed: true,
    confirmedAt: new Date(),
    confirmedIp: req.ip || req.connection?.remoteAddress || '',
    acknowledgedRisks: true,
  };

  await config.save();

  logger.info(`AUTOMATED TRADING ACTIVATED for user ${userId} on account ${brokerAccount.accountName}`);
  return sendSuccess(res, 200, {
    config,
    message: 'Trading automatisé autorisé avec succès. Vos règles de gestion du risque sont actives.',
  });
});

/**
 * POST /api/v1/managed-trading/emergency-stop
 * Instant Emergency Kill Switch.
 */
export const emergencyStop = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const reason = req.body?.reason || 'Déclenchement manuel de l\'arrêt d\'urgence par l\'utilisateur';

  const updatedConfig = await triggerEmergencyStop(userId, reason);

  return sendSuccess(res, 200, {
    config: updatedConfig,
    message: 'ARRÊT D\'URGENCE ACTIVÉ : Tout passage d\'ordre automatique est immédiatement suspendu.',
  });
});

/**
 * POST /api/v1/managed-trading/emergency-stop/reset
 */
export const resetEmergency = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const updatedConfig = await serviceResetEmergency(userId);

  return sendSuccess(res, 200, {
    config: updatedConfig,
    message: 'Arrêt d\'urgence réinitialisé. Le système est en mode Analyse Uniquement.',
  });
});

/**
 * POST /api/v1/managed-trading/broker-accounts
 * Connect and validate a broker account.
 */
export const connectBrokerAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { broker, accountName, accountId, token, secret, accountType = 'demo' } = req.body || {};

  if (!broker || !accountName) {
    throw ApiError.badRequest('Le nom du broker et le libellé du compte sont obligatoires.');
  }

  const adapter = getBrokerAdapter(broker);

  // Validate credentials with the broker adapter
  const validation = await adapter.validatePermissions({
    accountId: accountId || 'DEFAULT',
    token,
    secret,
    accountType,
    currency: req.body?.currency || 'USD',
    balance: req.body?.balance || 10000,
  });

  if (!validation.success) {
    throw ApiError.badRequest(`Échec de validation auprès du courtier : ${validation.error}`);
  }

  // Create or update account
  let account = await BrokerAccount.findOne({ userId, broker, accountId: validation.accountId });
  if (!account) {
    account = new BrokerAccount({
      userId,
      broker,
      accountId: validation.accountId,
    });
  }

  account.accountName = accountName;
  account.accountType = validation.accountType || accountType;
  account.setToken(token || 'paper-sim');
  if (secret) account.setSecret(secret);
  account.permissions = validation.permissions || ['read'];
  account.isTradeAuthorized = Boolean(validation.canTrade);
  account.currency = validation.currency || 'USD';
  account.balance = validation.balance || 0;
  account.equity = validation.equity || validation.balance || 0;
  account.connectionStatus = 'connected';
  account.lastConnectedAt = new Date();
  account.lastError = '';

  await account.save();

  // Set newly connected account as the active one
  let config = await ManagedTradingConfig.findOne({ userId });
  if (!config) {
    config = await ManagedTradingConfig.create({ userId });
  }
  config.activeBrokerAccountId = account._id;
  await config.save();

  logger.info(`Broker account connected: ${broker} (${account.accountId}) for user ${userId}`);
  return sendSuccess(res, 201, {
    account,
    canTrade: account.isTradeAuthorized,
    message: account.isTradeAuthorized
      ? 'Compte courtier connecté avec autorisations de trading confirmées.'
      : 'Compte courtier connecté en LECTURE SEULE. Le trading est désactivé.',
  });
});

/**
 * GET /api/v1/managed-trading/broker-accounts
 */
export const getBrokerAccounts = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const accounts = await BrokerAccount.find({ userId }).sort({ createdAt: -1 });

  return sendSuccess(res, 200, { accounts });
});

/**
 * POST /api/v1/managed-trading/broker-accounts/:id/select
 */
export const selectBrokerAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const account = await BrokerAccount.findOne({ _id: id, userId });
  if (!account) {
    throw ApiError.notFound('Compte courtier introuvable.');
  }

  let config = await ManagedTradingConfig.findOne({ userId });
  if (!config) {
    config = await ManagedTradingConfig.create({ userId });
  }
  config.activeBrokerAccountId = account._id;
  await config.save();

  return sendSuccess(res, 200, {
    config,
    activeAccount: account,
    message: `Compte ${account.accountName} activé avec succès.`,
  });
});

/**
 * DELETE /api/v1/managed-trading/broker-accounts/:id
 */
export const deleteBrokerAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const account = await BrokerAccount.findOneAndDelete({ _id: req.params.id, userId });
  if (!account) {
    throw ApiError.notFound('Compte courtier introuvable.');
  }

  // If deleted account was active, clear it from config
  await ManagedTradingConfig.updateOne(
    { userId, activeBrokerAccountId: account._id },
    { $set: { activeBrokerAccountId: null, operatingMode: 'analysis_only' } }
  );

  return sendSuccess(res, 200, { message: 'Compte courtier supprimé avec succès.' });
});

/**
 * POST /api/v1/managed-trading/orders/execute-manual
 * Mode 2: Explicit single-click confirmation of a prepared trade.
 */
export const executeManualOrder = asyncHandler(async (req, res) => {
  const user = req.user;
  const { opportunityId, brokerAccountId, directParams } = req.body || {};

  let opportunity = null;
  if (opportunityId) {
    opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      throw ApiError.notFound('Opportunité de trading introuvable ou expirée.');
    }
  }

  let account = null;
  if (brokerAccountId) {
    account = await BrokerAccount.findOne({ _id: brokerAccountId, userId: user._id });
  }

  const result = await executeManagedOrder({
    user,
    account,
    opportunity,
    executionMode: 'manual_confirmation',
    directParams,
  });

  if (!result.success) {
    throw ApiError.badRequest(result.rejectionReason || 'Ordre rejeté par le moteur de gestion des risques.');
  }

  return sendSuccess(res, 200, {
    order: result.order,
    message: `Ordre ${result.order.symbol} exécuté avec succès au prix de ${result.order.executionPrice}.`,
  });
});

/**
 * GET /api/v1/managed-trading/orders
 */
export const getOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { status, limit = 50, page = 1 } = req.query;

  const query = { userId };
  if (status) query.status = status;

  const orders = await ManagedOrder.find(query)
    .populate('brokerAccountId', 'accountName broker accountType currency')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await ManagedOrder.countDocuments(query);

  return sendSuccess(res, 200, { orders, total, page: Number(page) });
});

/**
 * GET /api/v1/managed-trading/positions
 */
export const getPositions = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const openPositions = await ManagedOrder.find({
    userId,
    status: { $in: ['FILLED', 'ACCEPTED', 'SUBMITTED'] },
  }).populate('brokerAccountId', 'accountName broker accountType currency');

  return sendSuccess(res, 200, { positions: openPositions });
});

/**
 * POST /api/v1/managed-trading/positions/:id/close
 */
export const closePosition = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const order = await ManagedOrder.findOne({ _id: req.params.id, userId });
  if (!order) {
    throw ApiError.notFound('Position introuvable.');
  }

  const account = await BrokerAccount.findById(order.brokerAccountId);
  if (account) {
    const adapter = getBrokerAdapter(account.broker);
    try {
      await adapter.closePosition(account, order.brokerPositionId || order.brokerOrderId);
    } catch (err) {
      logger.warn(`Could not close on broker side: ${err.message}`);
    }
  }

  order.status = 'CLOSED';
  order.closedAt = new Date();
  order.closeReason = 'manual_close';
  await order.save();

  return sendSuccess(res, 200, { order, message: 'Position fermée avec succès.' });
});
