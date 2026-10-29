import crypto from 'crypto';
import ManagedOrder from '../../models/ManagedOrder.js';
import ManagedTradingConfig from '../../models/ManagedTradingConfig.js';
import BrokerAccount from '../../models/BrokerAccount.js';
import { validateOrderPreFlight } from './orderValidationEngine.js';
import { getBrokerAdapter } from './brokerAdapters/BrokerAdapterFactory.js';
import { getQuote } from '../marketData/index.js';
import logger from '../../config/logger.js';

/**
 * Execute an order through the institutional risk-checked pipeline.
 *
 * @param {Object} params
 * @param {Object} params.user - User document
 * @param {Object} [params.account] - BrokerAccount document (optional, defaults to active account)
 * @param {Object} [params.opportunity] - Opportunity / Signal document
 * @param {string} params.executionMode - 'manual_confirmation' | 'automated' | 'paper'
 * @param {Object} [params.directParams] - Manual trade parameters if not from opportunity
 * @returns {Promise<{ success: boolean, order?: Object, rejectionReason?: string, checklist?: Object }>}
 */
export const executeManagedOrder = async ({
  user,
  account = null,
  opportunity = null,
  executionMode = 'manual_confirmation',
  directParams = null,
}) => {
  // 1. Resolve Config & Account
  let config = await ManagedTradingConfig.findOne({ userId: user._id });
  if (!config) {
    config = await ManagedTradingConfig.create({ userId: user._id });
  }

  let brokerAccount = account;
  if (!brokerAccount) {
    if (config.activeBrokerAccountId) {
      brokerAccount = await BrokerAccount.findById(config.activeBrokerAccountId);
    }
  }

  // If no live broker account connected and mode is paper, create or resolve paper account
  if (!brokerAccount && executionMode === 'paper') {
    brokerAccount = await BrokerAccount.findOne({ userId: user._id, broker: 'paper' });
    if (!brokerAccount) {
      brokerAccount = await BrokerAccount.create({
        userId: user._id,
        broker: 'paper',
        accountName: 'Portefeuille Virtuel (Simulation)',
        accountId: `PAPER-${user._id.toString().slice(-6).toUpperCase()}`,
        accountType: 'paper',
        encryptedToken: 'enc:v1:paper-sim',
        isTradeAuthorized: true,
        permissions: ['read', 'trade'],
        balance: 10000,
        equity: 10000,
        currency: 'USD',
        connectionStatus: 'connected',
      });
    }
  }

  if (!brokerAccount) {
    return {
      success: false,
      rejectionReason: 'Aucun compte de courtage connecté. Veuillez connecter un compte Deriv, Binance ou activer le mode Simulation.',
    };
  }

  // 2. Fetch Fresh Market Quote
  const targetSymbol = opportunity?.symbol || directParams?.symbol;
  const quote = await getQuote(targetSymbol);

  // 3. Generate Unique Idempotency Key
  const rawHash = `${user._id}_${brokerAccount._id}_${targetSymbol}_${opportunity?._id || directParams?.entry}_${Date.now()}`;
  const idempotencyKey = crypto.createHash('sha256').update(rawHash).digest('hex');

  // Build normalized opportunity object if direct params passed
  const opp = opportunity || {
    symbol: directParams.symbol,
    market: directParams.market || 'forex',
    direction: directParams.direction,
    entry: directParams.entry,
    stopLoss: directParams.stopLoss,
    takeProfit1: directParams.takeProfit,
    status: 'active',
  };

  // 4. Run Strict 13-Point Pre-Flight Validation
  const validation = await validateOrderPreFlight({
    user,
    config,
    account: brokerAccount,
    opportunity: opp,
    liveQuote: quote,
    executionMode,
    idempotencyKey,
  });

  // If any pre-flight check fails: Record Rejected Order in database for full transparency
  if (!validation.pass) {
    const rejectedOrder = await ManagedOrder.create({
      userId: user._id,
      brokerAccountId: brokerAccount._id,
      opportunityId: opportunity?._id || null,
      idempotencyKey,
      executionMode,
      symbol: opp.symbol,
      market: opp.market || 'forex',
      direction: opp.direction,
      volume: 0,
      signalPrice: opp.entry || quote?.price || 0,
      requestedPrice: quote?.price || opp.entry || 0,
      stopLoss: opp.stopLoss || 0,
      takeProfit: opp.takeProfit1 || null,
      riskAmount: 0,
      riskPercent: 0,
      status: 'REJECTED',
      rejectionReason: validation.rejectionReason,
      preFlightChecklist: validation.checklist,
    });

    logger.warn(`Managed Trade REJECTED for user ${user._id}: ${validation.rejectionReason}`);
    return {
      success: false,
      rejectionReason: validation.rejectionReason,
      checklist: validation.checklist,
      order: rejectedOrder,
    };
  }

  const sizing = validation.sizing;

  // 5. Create Order in REQUESTED Status
  const managedOrder = await ManagedOrder.create({
    userId: user._id,
    brokerAccountId: brokerAccount._id,
    opportunityId: opportunity?._id || null,
    idempotencyKey,
    executionMode,
    symbol: opp.symbol,
    market: opp.market || 'forex',
    direction: opp.direction,
    volume: sizing.executableVolume,
    signalPrice: opp.entry,
    requestedPrice: quote?.price || opp.entry,
    stopLoss: opp.stopLoss,
    takeProfit: opp.takeProfit1 || null,
    riskAmount: sizing.actualLossAtSL,
    riskPercent: sizing.actualRiskPercent,
    marginRequired: sizing.marginRequired,
    status: 'REQUESTED',
    preFlightChecklist: validation.checklist,
  });

  // 6. Dispatch Order to Broker Adapter
  const adapter = getBrokerAdapter(brokerAccount.broker);

  try {
    managedOrder.status = 'SUBMITTED';
    managedOrder.submittedAt = new Date();
    await managedOrder.save();

    const brokerResult = await adapter.executeOrder(brokerAccount, {
      symbol: opp.symbol,
      market: opp.market,
      direction: opp.direction,
      volume: sizing.executableVolume,
      orderType: 'MARKET',
      requestedPrice: managedOrder.requestedPrice,
      stopLoss: managedOrder.stopLoss,
      takeProfit: managedOrder.takeProfit,
      idempotencyKey,
    });

    if (!brokerResult.success) {
      managedOrder.status = 'REJECTED';
      managedOrder.rejectionReason = brokerResult.error || 'Ordre rejeté par le courtier';
      await managedOrder.save();

      return {
        success: false,
        rejectionReason: managedOrder.rejectionReason,
        order: managedOrder,
      };
    }

    // 7. Order Confirmed by Broker
    managedOrder.status = 'FILLED';
    managedOrder.filledAt = new Date();
    managedOrder.brokerOrderId = brokerResult.brokerOrderId;
    managedOrder.brokerPositionId = brokerResult.brokerPositionId;
    managedOrder.executionPrice = brokerResult.executionPrice;
    managedOrder.slippage = brokerResult.slippage || 0;
    managedOrder.slippagePercent =
      managedOrder.requestedPrice > 0
        ? Number(((brokerResult.slippage / managedOrder.requestedPrice) * 100).toFixed(3))
        : 0;
    managedOrder.commission = brokerResult.fees || sizing.totalCommission || 0;
    managedOrder.brokerRawResponse = brokerResult.rawResponse || null;
    managedOrder.isBrokerSideSlTpAccepted = adapter.supportsBrokerSideSlTp(opp.symbol);
    await managedOrder.save();

    // 8. Update Daily Metrics on User Config
    config.ensureDailyMetricsReset();
    config.dailyMetrics.ordersExecutedToday += 1;
    await config.save();

    logger.info(
      `Order ${managedOrder.brokerOrderId} FILLED for ${managedOrder.symbol} at ${managedOrder.executionPrice} (vol: ${managedOrder.volume})`
    );

    return {
      success: true,
      order: managedOrder,
    };
  } catch (err) {
    managedOrder.status = 'REJECTED';
    managedOrder.rejectionReason = err.message || 'Erreur inattendue lors de l\'exécution';
    await managedOrder.save();

    logger.error(`Execution error for order ${managedOrder._id}: ${err.message}`);
    return {
      success: false,
      rejectionReason: managedOrder.rejectionReason,
      order: managedOrder,
    };
  }
};

/**
 * Trigger immediate emergency stop (Kill Switch).
 * Halts automated execution immediately.
 */
export const triggerEmergencyStop = async (userId, reason = 'Déclenchement manuel de l\'arrêt d\'urgence') => {
  const config = await ManagedTradingConfig.findOne({ userId });
  if (!config) return null;

  config.isEmergencyStopped = true;
  config.operatingMode = 'analysis_only'; // Fall back immediately to Mode 1
  config.emergencyStoppedAt = new Date();
  config.emergencyStopReason = String(reason);
  await config.save();

  logger.warn(`EMERGENCY KILL SWITCH ACTIVATED for user ${userId}: ${reason}`);
  return config;
};

/**
 * Reset emergency stop.
 */
export const resetEmergencyStop = async (userId) => {
  const config = await ManagedTradingConfig.findOne({ userId });
  if (!config) return null;

  config.isEmergencyStopped = false;
  config.emergencyStoppedAt = null;
  config.emergencyStopReason = '';
  await config.save();

  logger.info(`Emergency stop reset for user ${userId}`);
  return config;
};
