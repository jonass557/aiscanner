import { asyncHandler } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { calculatePositionSize } from '../services/financial/positionCalculator.js';
import { getInstrumentSpec, INSTRUMENT_SPECS, MARKET_DEFAULT_SPECS } from '../services/financial/instrumentSpecs.js';
import { SYMBOL_CATALOG } from '../services/marketData/symbolCatalog.js';

/**
 * POST /api/v1/calculator/position-size
 * Compute institutional position size and risk metrics.
 */
export const calculateSize = asyncHandler(async (req, res) => {
  const user = req.user;
  const body = req.body || {};

  const userRiskLimitPercent = user?.preferences?.riskPercent || 3.0;

  const result = calculatePositionSize({
    capital: body.capital,
    accountCurrency: body.accountCurrency || user?.preferences?.currency || 'USD',
    symbol: body.symbol,
    market: body.market,
    direction: body.direction,
    entryPrice: body.entryPrice,
    stopLossPrice: body.stopLossPrice,
    takeProfitPrice: body.takeProfitPrice,
    riskType: body.riskType || 'percent',
    riskValue: body.riskValue != null ? body.riskValue : 1.0,
    leverage: body.leverage,
    userRiskLimitPercent,
    customSpecs: body.customSpecs,
    exchangeRates: body.exchangeRates,
  });

  return sendSuccess(res, 200, result);
});

/**
 * GET /api/v1/calculator/specs/:symbol?
 * Retrieve contract specifications for a specific symbol or for the entire catalog.
 */
export const getSpecs = asyncHandler(async (req, res) => {
  const symbol = req.params.symbol;
  if (symbol) {
    const spec = getInstrumentSpec(symbol, req.query.market);
    return sendSuccess(res, 200, { spec });
  }

  // Return all known symbols with their specs
  const catalogWithSpecs = SYMBOL_CATALOG.map((item) => {
    const spec = getInstrumentSpec(item.symbol, item.market);
    return {
      symbol: item.symbol,
      label: item.label,
      market: item.market,
      base: item.base,
      ...spec,
    };
  });

  return sendSuccess(res, 200, {
    specs: catalogWithSpecs,
    marketDefaults: MARKET_DEFAULT_SPECS,
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'CHF', 'AUD', 'ZAR'],
  });
});
