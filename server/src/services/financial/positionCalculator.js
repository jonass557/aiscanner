import { getInstrumentSpec } from './instrumentSpecs.js';
import { getConversionRate } from './currencyConverter.js';

/**
 * Helper to determine the number of decimal places for a number or step.
 */
export const getDecimals = (num) => {
  if (!num || Number.isInteger(num)) return 0;
  const s = String(num);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
};

/**
 * Strictly floor a number to a specific step to guarantee that risk is NEVER exceeded.
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
export const floorToStep = (value, step) => {
  if (!step || step <= 0) return value;
  const decimals = Math.max(getDecimals(step), 2);
  const factor = 1 / step;
  const floored = Math.floor((value + 1e-9) * factor) / factor;
  return Number(floored.toFixed(decimals));
};

/**
 * Pure institutional position sizing and risk validation calculation engine.
 * Single source of truth used across AI Capital Manager, Opportunities, Scanner, Assistant, and API.
 *
 * @param {Object} params
 * @param {number} params.capital - Account capital or reference equity (> 0)
 * @param {string} [params.accountCurrency='USD'] - Account denomination (USD, EUR, GBP, JPY, etc.)
 * @param {string} params.symbol - Trading symbol (e.g. 'EURUSD', 'XAUUSD', 'Boom 1000 Index', 'BTCUSD')
 * @param {string} [params.market] - Optional market category ('forex', 'commodities', 'crypto', 'indices', 'synthetic')
 * @param {string} params.direction - 'BUY' or 'SELL'
 * @param {number} params.entryPrice - Planned entry price
 * @param {number} params.stopLossPrice - Planned stop loss price
 * @param {number} [params.takeProfitPrice] - Planned take profit price (optional)
 * @param {string} [params.riskType='percent'] - 'percent' | 'amount'
 * @param {number} [params.riskValue=1.0] - Risk value (e.g. 1.0 for 1% or 100 for $100)
 * @param {number} [params.leverage] - Optional leverage override (e.g. 100)
 * @param {number} [params.userRiskLimitPercent] - Optional user risk policy threshold (e.g. 2.0%)
 * @param {Object} [params.customSpecs] - Optional overrides for contract specs
 * @param {Object} [params.exchangeRates] - Optional custom exchange rates
 * @returns {Object} Comprehensive calculation results, margins, and compliance status
 */
export const calculatePositionSize = (params) => {
  const {
    capital,
    accountCurrency = 'USD',
    symbol,
    market,
    direction,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    riskType = 'percent',
    riskValue = 1.0,
    leverage,
    userRiskLimitPercent,
    customSpecs = {},
    exchangeRates = {},
  } = params || {};

  const errors = [];
  const warnings = [];

  // 1. Basic validation
  const numCapital = Number(capital);
  if (!Number.isFinite(numCapital) || numCapital <= 0) {
    errors.push('Le capital ou équité de référence doit être strictement supérieur à 0.');
  }

  const numEntry = Number(entryPrice);
  const numSL = Number(stopLossPrice);
  const numTP = takeProfitPrice != null && takeProfitPrice !== '' ? Number(takeProfitPrice) : null;

  if (!Number.isFinite(numEntry) || numEntry <= 0) {
    errors.push("Le prix d'entrée doit être un nombre strictement positif.");
  }
  if (!Number.isFinite(numSL) || numSL <= 0) {
    errors.push('Le prix du Stop-Loss doit être un nombre strictement positif.');
  }

  const cleanDir = String(direction || '').toUpperCase();
  if (cleanDir !== 'BUY' && cleanDir !== 'SELL') {
    errors.push("La direction de l'ordre doit être soit BUY (Achat) soit SELL (Vente).");
  }

  if (Number.isFinite(numEntry) && Number.isFinite(numSL)) {
    if (numEntry === numSL) {
      errors.push("Le Stop-Loss ne peut pas être égal au prix d'entrée (distance de risque nulle).");
    } else if (cleanDir === 'BUY' && numSL >= numEntry) {
      errors.push("Pour un ordre BUY (Achat), le Stop-Loss doit être strictement inférieur au prix d'entrée.");
    } else if (cleanDir === 'SELL' && numSL <= numEntry) {
      errors.push("Pour un ordre SELL (Vente), le Stop-Loss doit être strictement supérieur au prix d'entrée.");
    }
  }

  if (numTP !== null) {
    if (!Number.isFinite(numTP) || numTP <= 0) {
      errors.push('Le prix du Take-Profit doit être supérieur à 0.');
    } else if (cleanDir === 'BUY' && numTP <= numEntry) {
      warnings.push("Pour un ordre BUY, le Take-Profit devrait être supérieur au prix d'entrée.");
    } else if (cleanDir === 'SELL' && numTP >= numEntry) {
      warnings.push("Pour un ordre SELL, le Take-Profit devrait être inférieur au prix d'entrée.");
    }
  }

  const numRiskVal = Number(riskValue);
  if (!Number.isFinite(numRiskVal) || numRiskVal <= 0) {
    errors.push('La valeur du risque accepté doit être strictement positive.');
  }

  // Instrument specifications
  const baseSpec = getInstrumentSpec(symbol, market);
  const spec = {
    ...baseSpec,
    ...customSpecs,
  };

  const effectiveLeverage = Number(leverage) > 0 ? Number(leverage) : spec.defaultLeverage || 100;

  if (errors.length > 0) {
    return {
      success: false,
      status: 'INVALID_INPUT',
      complianceTone: 'danger',
      errors,
      warnings,
      spec,
      capital: numCapital || 0,
      accountCurrency,
      symbol: spec.symbol,
    };
  }

  // 2. Risk Targets
  let targetRiskAmount = 0;
  let targetRiskPercent = 0;

  if (riskType === 'percent') {
    targetRiskPercent = numRiskVal;
    targetRiskAmount = numCapital * (numRiskVal / 100);
  } else {
    targetRiskAmount = numRiskVal;
    targetRiskPercent = (numRiskVal / numCapital) * 100;
  }

  // Policy threshold check
  if (userRiskLimitPercent && targetRiskPercent > userRiskLimitPercent) {
    warnings.push(
      `Le risque sélectionné (${targetRiskPercent.toFixed(1)}%) dépasse la limite maximale recommandée de votre profil (${userRiskLimitPercent}%).`
    );
  }

  // 3. Price Distances
  const priceDistance = Math.abs(numEntry - numSL);
  const distancePercent = (priceDistance / numEntry) * 100;
  const pips = priceDistance / spec.pipSize;

  // 4. Pip / Point Value Calculation in Account Currency
  const pipValueInQuote = spec.pipSize * spec.contractSize * (spec.pointValueMultiplier || 1.0);
  const quoteToAccountRate = getConversionRate(spec.quoteCurrency, accountCurrency, exchangeRates);
  const accountPipValuePerLot = pipValueInQuote * quoteToAccountRate;

  // 5. Raw Volume Calculation (including estimated commission)
  const commissionPerLot = Number(spec.commissionPerLot) || 0;
  const lossPerLot = pips * accountPipValuePerLot + commissionPerLot;
  const rawVolume = lossPerLot > 0 ? targetRiskAmount / lossPerLot : 0;

  // 6. Strict Step Flooring (Never round up to prevent risk overshoot)
  const flooredVolume = floorToStep(rawVolume, spec.lotStep);

  // 7. Broker Minimum & Maximum Lot Constraints
  const minLot = Number(spec.minLot) || 0.01;
  const maxLot = Number(spec.maxLot) || 100.0;

  // Real loss incurred if executed at the broker's minimum lot
  const lossAtMinLot = pips * accountPipValuePerLot * minLot + commissionPerLot * minLot;
  const riskPercentAtMinLot = (lossAtMinLot / numCapital) * 100;

  let isRiskTooHighForMinLot = false;
  let executableVolume = 0;
  let complianceStatus = 'COMPLIANT';
  let complianceTone = 'success';
  let complianceMessage = 'Position conforme à vos règles de gestion du risque.';

  if (flooredVolume < minLot) {
    if (lossAtMinLot > targetRiskAmount) {
      // CRITICAL COMPLIANCE FLAG: Min lot exceeds accepted risk
      isRiskTooHighForMinLot = true;
      complianceStatus = 'REJECTED_MIN_LOT_RISK_EXCEEDED';
      complianceTone = 'danger';
      complianceMessage = 'RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL';
      executableVolume = 0; // Not recommended for execution
      warnings.push(
        `RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL : Le volume requis (${rawVolume.toFixed(4)}) est inférieur au minimum broker (${minLot}). À ${minLot} lot(s), la perte au SL serait de ${lossAtMinLot.toFixed(2)} ${accountCurrency} (${riskPercentAtMinLot.toFixed(2)}%), ce qui dépasse votre risque toléré de ${targetRiskAmount.toFixed(2)} ${accountCurrency} (${targetRiskPercent.toFixed(2)}%).`
      );
    } else {
      // Floored was below min lot due to discretization step, but min lot is still <= targetRiskAmount
      executableVolume = minLot;
    }
  } else if (flooredVolume > maxLot) {
    executableVolume = maxLot;
    warnings.push(
      `Le volume calculé (${flooredVolume}) dépasse le volume maximal autorisé par le broker (${maxLot} lots). Volume plafonné à ${maxLot}.`
    );
    complianceStatus = 'WARNING_MAX_LOT_REACHED';
    complianceTone = 'warning';
  } else {
    executableVolume = flooredVolume;
  }

  // 8. Financials at Executable Volume
  const actualLossAtSL =
    executableVolume > 0
      ? pips * accountPipValuePerLot * executableVolume + commissionPerLot * executableVolume
      : 0;
  const actualRiskPercent = numCapital > 0 ? (actualLossAtSL / numCapital) * 100 : 0;
  const pipValueAtVolume = accountPipValuePerLot * executableVolume;
  const totalCommission = commissionPerLot * executableVolume;

  // 9. Take-Profit & Risk/Reward Calculations
  let tpDistance = null;
  let tpPips = null;
  let tpDistancePercent = null;
  let actualGainAtTP = null;
  let actualGainPercent = null;
  let riskRewardRatio = null;

  if (numTP !== null) {
    tpDistance = Math.abs(numTP - numEntry);
    tpDistancePercent = (tpDistance / numEntry) * 100;
    tpPips = tpDistance / spec.pipSize;
    actualGainAtTP =
      executableVolume > 0
        ? tpPips * accountPipValuePerLot * executableVolume - totalCommission
        : 0;
    actualGainPercent = numCapital > 0 ? (actualGainAtTP / numCapital) * 100 : 0;
    riskRewardRatio = priceDistance > 0 ? Number((tpDistance / priceDistance).toFixed(2)) : null;

    if (riskRewardRatio !== null && riskRewardRatio < 1.0) {
      warnings.push(
        `Le ratio Risque/Rendement (1:${riskRewardRatio}) est inférieur à 1:1. Trade défavorable.`
      );
      if (complianceTone === 'success') {
        complianceStatus = 'WARNING_LOW_RR';
        complianceTone = 'warning';
      }
    }
  }

  // 10. Margin Requirements and Leverage
  // Notional value in quote currency = volume * contractSize * entryPrice
  const notionalQuote = executableVolume * spec.contractSize * numEntry;
  const notionalAccount = notionalQuote * quoteToAccountRate;
  const marginRequired = effectiveLeverage > 0 ? notionalAccount / effectiveLeverage : notionalAccount;
  const marginPercentOfCapital = numCapital > 0 ? (marginRequired / numCapital) * 100 : 0;
  const freeMarginAfterTrade = numCapital - marginRequired;

  let insufficientMargin = false;
  if (marginRequired > numCapital && executableVolume > 0) {
    insufficientMargin = true;
    complianceStatus = 'REJECTED_INSUFFICIENT_MARGIN';
    complianceTone = 'danger';
    complianceMessage = 'MARGE INSUFFISANTE';
    warnings.push(
      `MARGE INSUFFISANTE : La marge requise (${marginRequired.toFixed(2)} ${accountCurrency}) dépasse votre capital (${numCapital.toFixed(2)} ${accountCurrency}) au levier 1:${effectiveLeverage}.`
    );
  } else if (marginPercentOfCapital > 50 && executableVolume > 0 && complianceTone === 'success') {
    complianceStatus = 'WARNING_HIGH_MARGIN';
    complianceTone = 'warning';
    complianceMessage = 'Marge requise élevée (> 50% du capital).';
    warnings.push(
      `Attention : Cette position mobilise ${marginPercentOfCapital.toFixed(1)}% de votre capital disponible en marge.`
    );
  }

  return {
    success: true,
    symbol: spec.symbol,
    label: spec.label,
    market: spec.market,
    direction: cleanDir,
    capital: numCapital,
    accountCurrency,
    entryPrice: numEntry,
    stopLossPrice: numSL,
    takeProfitPrice: numTP,
    leverage: effectiveLeverage,

    // Compliance & Health
    status: complianceStatus,
    complianceTone,
    complianceMessage,
    isRiskTooHighForMinLot,
    insufficientMargin,
    errors,
    warnings,

    // Volumes
    rawVolume: Number(rawVolume.toFixed(5)),
    executableVolume,
    minLot,
    maxLot,
    lotStep: spec.lotStep,

    // Target vs Realized Risk
    targetRiskAmount: Number(targetRiskAmount.toFixed(2)),
    targetRiskPercent: Number(targetRiskPercent.toFixed(2)),
    actualLossAtSL: Number(actualLossAtSL.toFixed(2)),
    actualRiskPercent: Number(actualRiskPercent.toFixed(2)),

    // Loss if forced to execute at minimum lot (crucial for Deriv/Indices)
    lossAtMinLot: Number(lossAtMinLot.toFixed(2)),
    riskPercentAtMinLot: Number(riskPercentAtMinLot.toFixed(2)),

    // SL Metrics
    priceDistance: Number(priceDistance.toFixed(spec.pricePrecision)),
    distancePercent: Number(distancePercent.toFixed(2)),
    slPips: Number(pips.toFixed(1)),

    // TP & Profit Metrics (if supplied)
    tpDistance: tpDistance !== null ? Number(tpDistance.toFixed(spec.pricePrecision)) : null,
    tpDistancePercent: tpDistancePercent !== null ? Number(tpDistancePercent.toFixed(2)) : null,
    tpPips: tpPips !== null ? Number(tpPips.toFixed(1)) : null,
    actualGainAtTP: actualGainAtTP !== null ? Number(actualGainAtTP.toFixed(2)) : null,
    actualGainPercent: actualGainPercent !== null ? Number(actualGainPercent.toFixed(2)) : null,
    riskRewardRatio,

    // Financial Values
    accountPipValuePerLot: Number(accountPipValuePerLot.toFixed(4)),
    pipValueAtVolume: Number(pipValueAtVolume.toFixed(4)),
    totalCommission: Number(totalCommission.toFixed(2)),
    quoteToAccountRate: Number(quoteToAccountRate.toFixed(5)),

    // Margin & Leverage
    notionalAccount: Number(notionalAccount.toFixed(2)),
    marginRequired: Number(marginRequired.toFixed(2)),
    marginPercentOfCapital: Number(marginPercentOfCapital.toFixed(2)),
    freeMarginAfterTrade: Number(freeMarginAfterTrade.toFixed(2)),

    // Specifications
    spec,
  };
};
