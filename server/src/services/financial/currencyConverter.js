import { getQuote } from '../marketData/index.js';

/**
 * Standard baseline exchange rates vs USD (from SYMBOL_CATALOG base values).
 * Used as reliable fallback when live provider is offline or in test environments.
 */
export const BASE_FX_RATES_VS_USD = {
  USD: 1.0,
  EUR: 1.0865, // 1 EUR = 1.0865 USD
  GBP: 1.2710, // 1 GBP = 1.2710 USD
  AUD: 0.6640, // 1 AUD = 0.6640 USD
  NZD: 0.6100, // 1 NZD = 0.6100 USD
  CAD: 1 / 1.3680, // 1 CAD = 0.73099 USD (USDCAD = 1.3680)
  CHF: 1 / 0.9040, // 1 CHF = 1.10619 USD (USDCHF = 0.9040)
  JPY: 1 / 156.20, // 1 JPY = 0.00640 USD (USDJPY = 156.20)
  ZAR: 1 / 18.250, // 1 ZAR = 0.05479 USD (USDZAR = 18.25)
};

/**
 * Convert an amount from fromCurrency to toCurrency.
 * Supports direct FX quotes, inverted quotes, and USD triangulation.
 *
 * @param {string} fromCurrency - e.g. 'USD', 'EUR', 'GBP', 'JPY'
 * @param {string} toCurrency - e.g. 'USD', 'EUR', 'GBP', 'JPY'
 * @param {Object} [overrideRates] - Optional custom or live exchange rates dictionary
 * @returns {number} Exchange rate multiplier (1 unit of fromCurrency = X units of toCurrency)
 */
export const getConversionRate = (fromCurrency, toCurrency, overrideRates = {}) => {
  const from = String(fromCurrency || 'USD').toUpperCase();
  const to = String(toCurrency || 'USD').toUpperCase();

  if (from === to) return 1.0;

  const rates = { ...BASE_FX_RATES_VS_USD, ...overrideRates };

  const fromInUsd = rates[from] != null ? rates[from] : 1.0;
  const toInUsd = rates[to] != null ? rates[to] : 1.0;

  if (toInUsd <= 0) return 1.0;

  // Rate: (1 unit of from in USD) / (1 unit of to in USD)
  return fromInUsd / toInUsd;
};

/**
 * Asynchronously fetch live rate between two currencies using marketData.
 * Falls back safely to getConversionRate.
 *
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @returns {Promise<number>}
 */
export const getLiveConversionRate = async (fromCurrency, toCurrency) => {
  const from = String(fromCurrency || 'USD').toUpperCase();
  const to = String(toCurrency || 'USD').toUpperCase();

  if (from === to) return 1.0;

  try {
    // Try direct pair
    const directSymbol = `${from}${to}`;
    const directQuote = await getQuote(directSymbol);
    if (directQuote?.price && Number.isFinite(directQuote.price)) {
      return directQuote.price;
    }

    // Try inverted pair
    const inverseSymbol = `${to}${from}`;
    const inverseQuote = await getQuote(inverseSymbol);
    if (inverseQuote?.price && Number.isFinite(inverseQuote.price) && inverseQuote.price > 0) {
      return 1 / inverseQuote.price;
    }
  } catch {
    // Fall back to catalog triangulation
  }

  return getConversionRate(from, to);
};
