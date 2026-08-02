import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { BinanceProvider } from './BinanceProvider.js';
import { TwelveDataProvider } from './TwelveDataProvider.js';
import { MockMarketProvider } from './MockMarketProvider.js';
import { resolveSymbol, inferMarket, SYMBOL_CATALOG, MARKET_LABELS } from './symbolCatalog.js';

/**
 * Market-data factory + orchestrator — the single seam the assistant talks to.
 *
 * Routing:
 *  - crypto  → Binance (public, real, zero-config)
 *  - forex/indices/commodities → TwelveData if a key is set, else mock
 *  - synthetic (Deriv) → mock only (no public real-time feed)
 *  - anything unconfigured/failing → mock, clearly flagged isRealData:false
 *
 * The golden rule ("never invent prices") is enforced here: every snapshot
 * carries `source` + `isRealData`, and a real-provider failure falls back to
 * mock WITH the flag flipped — the caller must surface that to the user rather
 * than pass simulated data off as live.
 */

const binance = new BinanceProvider(config.marketData?.binance || {});
const twelveData = new TwelveDataProvider(config.marketData?.twelveData || {});
const mock = new MockMarketProvider();

/**
 * Pick the best provider for a catalog entry. Returns null → use mock.
 */
const pickProvider = (entry) => {
  if (binance.supports(entry) && binance.isConfigured()) return binance;
  if (twelveData.supports(entry) && twelveData.isConfigured()) return twelveData;
  return null; // mock
};

/**
 * Fetch a full snapshot (quote + candles) for one symbol/timeframe.
 * Never throws for data-availability reasons: on real-provider failure it
 * degrades to mock and flags the data as simulated so the assistant can be
 * honest with the user.
 *
 * @param {string} symbolText - raw user mention or canonical symbol
 * @param {string} [timeframe='H1']
 * @param {number} [candleLimit=120]
 * @returns {Promise<{ symbol, market, marketLabel, timeframe, quote, candles, source, isRealData, note? }|null>}
 *          null only when the symbol itself can't be resolved.
 */
export const getMarketSnapshot = async (symbolText, timeframe = 'H1', candleLimit = 120) => {
  const entry = typeof symbolText === 'object' ? symbolText : resolveSymbol(symbolText);
  if (!entry) return null;

  const provider = pickProvider(entry);
  const base = {
    symbol: entry.symbol,
    market: entry.market,
    marketLabel: MARKET_LABELS[entry.market] || entry.market,
    timeframe,
  };

  if (provider) {
    try {
      const [quote, candles] = await Promise.all([
        provider.getQuote(entry),
        provider.getCandles(entry, timeframe, candleLimit),
      ]);
      if (candles?.length) {
        return { ...base, quote, candles, source: provider.name, isRealData: true };
      }
      logger.warn(`Market data: ${provider.name} returned no candles for ${entry.symbol}; using mock.`);
    } catch (err) {
      logger.warn(`Market data: ${provider.name} failed for ${entry.symbol} (${err.message}); using mock.`);
    }
  }

  // Fallback: deterministic mock, clearly flagged.
  const [quote, candles] = await Promise.all([
    mock.getQuote(entry),
    mock.getCandles(entry, timeframe, candleLimit),
  ]);
  return {
    ...base,
    quote,
    candles,
    source: 'mock',
    isRealData: false,
    note:
      entry.market === 'synthetic'
        ? 'Données simulées (pas de flux temps réel public pour les indices synthétiques Deriv).'
        : 'Données simulées — ajoutez une clé de données de marché pour le temps réel.',
  };
};

/**
 * Lightweight quote-only fetch (used for "best markets" scans over the universe).
 */
export const getQuote = async (symbolText) => {
  const entry = typeof symbolText === 'object' ? symbolText : resolveSymbol(symbolText);
  if (!entry) return null;
  const provider = pickProvider(entry);
  if (provider) {
    try {
      return { ...(await provider.getQuote(entry)), isRealData: true };
    } catch (err) {
      logger.warn(`Quote: ${provider.name} failed for ${entry.symbol} (${err.message}); using mock.`);
    }
  }
  return { ...(await mock.getQuote(entry)), isRealData: false };
};

export { resolveSymbol, inferMarket, SYMBOL_CATALOG, MARKET_LABELS };
