import mongoose from 'mongoose';
import { calculatePositionSize } from '../financial/positionCalculator.js';
import ManagedOrder from '../../models/ManagedOrder.js';

/**
 * Institutional 13-Point Pre-Order Validation Engine.
 *
 * Runs before any order submission to ensure 100% compliance with user risk boundaries,
 * broker permissions, market freshness, and execution safety.
 *
 * @param {Object} params
 * @param {Object} params.user - User document
 * @param {Object} params.config - ManagedTradingConfig document
 * @param {Object} params.account - BrokerAccount document
 * @param {Object} params.opportunity - Opportunity / Signal document
 * @param {Object} params.liveQuote - Latest quote { price, timestamp }
 * @param {string} params.executionMode - 'manual_confirmation' | 'automated' | 'paper'
 * @param {string} params.idempotencyKey - Unique submission key
 * @returns {Promise<{ pass: boolean, checklist: Object, rejectionReason?: string, sizing?: Object }>}
 */
export const validateOrderPreFlight = async ({
  user,
  config,
  account,
  opportunity,
  liveQuote,
  executionMode,
  idempotencyKey,
}) => {
  const checklist = {
    userAuth: false,
    modeActive: false,
    connectionValid: false,
    freshData: false,
    notExpired: false,
    notDuplicate: false,
    symbolAllowed: false,
    riskWithinLimit: false,
    sizeCorrect: false,
    slTpValid: false,
    dailyLimitsOk: false,
    slippageOk: false,
    brokerConstraintsOk: false,
  };

  // 1. User Authenticated & Authorized
  if (!user || !user._id) {
    return { pass: false, checklist, rejectionReason: 'Utilisateur non authentifié.' };
  }
  checklist.userAuth = true;

  // 2. Mode Active & Emergency Switch Check
  if (config.isEmergencyStopped) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Arrêt d'urgence actif (${config.emergencyStopReason || 'Arrêt manuel déclenché'}).`,
    };
  }

  if (executionMode === 'automated') {
    if (config.operatingMode !== 'automated') {
      return {
        pass: false,
        checklist,
        rejectionReason: 'Le mode de trading automatisé est actuellement désactivé.',
      };
    }
    if (!config.explicitAuthorization?.confirmed) {
      return {
        pass: false,
        checklist,
        rejectionReason: 'L\'autorisation explicite des risques d\'automatisation n\'a pas été validée.',
      };
    }
    if (!config.isWithinTradingHours()) {
      return {
        pass: false,
        checklist,
        rejectionReason: 'En dehors des plages horaires de trading configurées.',
      };
    }
  }
  checklist.modeActive = true;

  // 3. Broker Connection & Trade Permission Valid
  if (!account || !account._id) {
    return { pass: false, checklist, rejectionReason: 'Aucun compte broker valide sélectionné.' };
  }
  if (account.connectionStatus !== 'connected' && account.accountType !== 'paper') {
    return {
      pass: false,
      checklist,
      rejectionReason: `Compte broker non connecté (Statut: ${account.connectionStatus}).`,
    };
  }
  if (!account.isTradeAuthorized && account.accountType !== 'paper') {
    return {
      pass: false,
      checklist,
      rejectionReason:
        'Le compte broker connecté ne dispose pas des droits de passage d\'ordres (permission "trade" manquante).',
    };
  }
  checklist.connectionValid = true;

  // 4. Market Data Freshness
  const now = Date.now();
  const quoteTime = liveQuote?.timestamp ? new Date(liveQuote.timestamp).getTime() : now;
  // If quote is older than 5 minutes, consider it stale
  if (now - quoteTime > 5 * 60 * 1000) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Données de marché périmées (cotation datant de plus de 5 minutes).',
    };
  }
  checklist.freshData = true;

  // 5. Signal Freshness & Expiration
  if (opportunity) {
    if (opportunity.status !== 'active') {
      return {
        pass: false,
        checklist,
        rejectionReason: `Le signal n'est plus actif (Statut: ${opportunity.status}).`,
      };
    }
    if (opportunity.expiresAt && new Date(opportunity.expiresAt) <= new Date()) {
      return { pass: false, checklist, rejectionReason: 'Le signal a expiré.' };
    }
  }
  checklist.notExpired = true;

  // 6. Deduplication & Idempotency Key
  let existingOrder = null;
  if (mongoose.connection?.readyState === 1) {
    existingOrder = await ManagedOrder.findOne({
      $or: [{ idempotencyKey }, { opportunityId: opportunity?._id, status: { $in: ['FILLED', 'ACCEPTED', 'SUBMITTED'] } }],
    });
  }
  if (existingOrder) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Ordre dupliqué : ce signal ou cette référence a déjà été envoyé au marché.',
    };
  }
  checklist.notDuplicate = true;

  // 7. Instrument & Market Allowed
  const symbol = String(opportunity?.symbol || liveQuote?.symbol || '').toUpperCase();
  const market = String(opportunity?.market || 'forex').toLowerCase();

  if (config.allowedMarkets?.length > 0 && !config.allowedMarkets.includes(market)) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Le marché "${market}" n'est pas autorisé dans vos paramètres de gestion.`,
    };
  }
  if (config.allowedSymbols?.length > 0 && !config.allowedSymbols.includes(symbol)) {
    return {
      pass: false,
      checklist,
      rejectionReason: `L'instrument "${symbol}" n'est pas dans votre liste d'actifs autorisés.`,
    };
  }
  checklist.symbolAllowed = true;

  // 8 & 9 & 10. Position Sizing, Stop-Loss, and Risk Compliance
  const entryPrice = Number(opportunity?.entry || liveQuote?.price);
  const stopLoss = Number(opportunity?.stopLoss);
  const takeProfit = opportunity?.takeProfit1 ? Number(opportunity.takeProfit1) : null;
  const direction = String(opportunity?.direction || 'BUY').toUpperCase();
  const accountEquity = Number(account.equity || account.balance || 10000);

  if (!entryPrice || !stopLoss) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Prix d\'entrée ou Stop-Loss manquant dans le signal.',
    };
  }

  // Calculate position sizing strictly via positionCalculator
  const sizing = calculatePositionSize({
    capital: accountEquity,
    accountCurrency: account.currency || 'USD',
    symbol,
    market,
    direction,
    entryPrice,
    stopLossPrice: stopLoss,
    takeProfitPrice: takeProfit,
    riskType: 'percent',
    riskValue: config.maxRiskPerTradePercent || 1.0,
    userRiskLimitPercent: config.maxRiskPerTradePercent || 1.0,
  });

  if (!sizing.success) {
    return {
      pass: false,
      checklist,
      rejectionReason: sizing.errors?.join(' ') || 'Paramètres de trade invalides.',
    };
  }

  // Check Stop-Loss direction validity
  if (direction === 'BUY' && stopLoss >= entryPrice) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Stop-Loss invalide pour un ordre BUY (doit être inférieur au prix d\'entrée).',
    };
  }
  if (direction === 'SELL' && stopLoss <= entryPrice) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Stop-Loss invalide pour un ordre SELL (doit être supérieur au prix d\'entrée).',
    };
  }
  checklist.slTpValid = true;

  // CRITICAL RISK OVERFLOW CHECK: Minimum lot size cannot exceed target risk!
  if (sizing.isRiskTooHighForMinLot || sizing.status === 'REJECTED_MIN_LOT_RISK_EXCEEDED') {
    return {
      pass: false,
      checklist,
      rejectionReason: `RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL : À ${sizing.minLot} lot(s), la perte (${sizing.lossAtMinLot} ${account.currency}) dépasse votre risque toléré (${sizing.targetRiskAmount} ${account.currency}).`,
    };
  }

  if (sizing.executableVolume <= 0) {
    return {
      pass: false,
      checklist,
      rejectionReason: 'Volume calculé nul ou inférieur au pas minimal du broker.',
    };
  }
  checklist.sizeCorrect = true;

  // Check risk amount against absolute config limit
  if (config.maxRiskPerTradeAmount && sizing.actualLossAtSL > config.maxRiskPerTradeAmount) {
    return {
      pass: false,
      checklist,
      rejectionReason: `La perte au SL (${sizing.actualLossAtSL} ${account.currency}) dépasse votre montant maximal par ordre (${config.maxRiskPerTradeAmount} ${account.currency}).`,
    };
  }
  checklist.riskWithinLimit = true;

  // 11. Daily Limits & Max Open Positions
  config.ensureDailyMetricsReset();

  if (
    config.maxDailyLossAmount &&
    config.dailyMetrics.realizedLossToday + sizing.actualLossAtSL > config.maxDailyLossAmount
  ) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Limite de perte quotidienne atteinte (${config.dailyMetrics.realizedLossToday.toFixed(2)} + ${sizing.actualLossAtSL.toFixed(2)} > ${config.maxDailyLossAmount} ${account.currency}).`,
    };
  }

  if (config.maxOrdersPerDay && config.dailyMetrics.ordersExecutedToday >= config.maxOrdersPerDay) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Nombre maximal d'ordres par jour atteint (${config.maxOrdersPerDay} ordres).`,
    };
  }

  let openPositionsCount = 0;
  if (mongoose.connection?.readyState === 1) {
    openPositionsCount = await ManagedOrder.countDocuments({
      userId: user._id,
      brokerAccountId: account._id,
      status: { $in: ['FILLED', 'ACCEPTED', 'SUBMITTED'] },
    });
  } else if (config._mockOpenPositionsCount !== undefined) {
    openPositionsCount = config._mockOpenPositionsCount;
  }

  if (config.maxOpenPositions && openPositionsCount >= config.maxOpenPositions) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Nombre maximal de positions ouvertes simultanées atteint (${openPositionsCount} / ${config.maxOpenPositions}).`,
    };
  }
  checklist.dailyLimitsOk = true;

  // 12. Price Slippage Drift Check
  const currentLivePrice = Number(liveQuote?.price || entryPrice);
  const priceDrift = Math.abs(currentLivePrice - entryPrice);
  const driftPercent = (priceDrift / entryPrice) * 100;
  const maxAllowedSlippage = config.maxAllowedSlippagePercent || 0.20;

  if (driftPercent > maxAllowedSlippage) {
    return {
      pass: false,
      checklist,
      rejectionReason: `Le prix de marché (${currentLivePrice}) a trop dérivé du prix du signal (${entryPrice}) : écart de ${driftPercent.toFixed(2)}% > tolérance max de ${maxAllowedSlippage}%.`,
    };
  }
  checklist.slippageOk = true;

  // 13. Broker Constraints & Margin Requirements
  if (sizing.insufficientMargin) {
    return {
      pass: false,
      checklist,
      rejectionReason: `MARGE INSUFFISANTE : La marge requise (${sizing.marginRequired} ${account.currency}) dépasse le capital disponible.`,
    };
  }
  checklist.brokerConstraintsOk = true;

  // All 13 checks passed!
  return {
    pass: true,
    checklist,
    sizing,
  };
};
