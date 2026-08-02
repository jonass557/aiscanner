/**
 * Abstract base for a market-data provider.
 *
 * Every provider returns data in the same normalized shape so the analysis
 * engine never knows (or cares) whether prices came from Binance, TwelveData,
 * or the deterministic mock. Swapping/adding a feed touches only a subclass.
 */
export class BaseMarketProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  /** @returns {boolean} whether this provider can serve real data. */
  isConfigured() {
    return false;
  }

  /** @returns {boolean} whether the data it returns is real (vs simulated). */
  get isRealData() {
    return true;
  }

  /**
   * Latest quote for a symbol.
   * @param {Object} entry - catalog entry { symbol, market, base, binance? }
   * @returns {Promise<{ symbol, price, timestamp, source }>}
   */
  // eslint-disable-next-line no-unused-vars
  async getQuote(entry) {
    throw new Error('getQuote() must be implemented by the provider');
  }

  /**
   * Recent OHLC candles, oldest → newest.
   * @param {Object} entry
   * @param {string} timeframe - e.g. 'H1'
   * @param {number} limit
   * @returns {Promise<Array<{ time, open, high, low, close, volume }>>}
   */
  // eslint-disable-next-line no-unused-vars
  async getCandles(entry, timeframe, limit) {
    throw new Error('getCandles() must be implemented by the provider');
  }
}
