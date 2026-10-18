import { BaseMarketProvider } from './BaseMarketProvider.js';

/**
 * Deterministic institutional market-data generator — used for Deriv Synthetics
 * (Volatility 75, Boom 1000, Crash 1000, Step Index) and zero-config fallback.
 *
 * Produces clean, full-bodied candlesticks with multi-wave market structure
 * (impulses, retracements, supply/demand zones) and realistic proportional wicks.
 */
export class MockMarketProvider extends BaseMarketProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'mock';
  }

  isConfigured() {
    return true; // always available
  }

  get isRealData() {
    return false;
  }

  _seed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  _rng(seed) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _decimals(price) {
    return price < 10 ? 5 : price < 1000 ? 2 : 1;
  }

  _generate(entry, timeframe, limit) {
    const base = entry.base || 100;
    const day = new Date().toISOString().slice(0, 10);
    const rand = this._rng(this._seed(`${entry.symbol}|${timeframe}|${day}`));
    const dp = this._decimals(base);

    const vol =
      {
        M1: 0.0008,
        M5: 0.0014,
        M15: 0.0022,
        M30: 0.0032,
        H1: 0.0045,
        H4: 0.0085,
        D1: 0.014,
        W1: 0.025,
      }[timeframe] || 0.0045;

    const candles = [];
    let price = base * (0.985 + rand() * 0.03);
    const now = Date.now();
    const tfMinutes =
      { M1: 1, M2: 2, M3: 3, M5: 5, M15: 15, M30: 30, M45: 45, H1: 60, H2: 120, H3: 180, H4: 240, D1: 1440, W1: 10080 }[timeframe] || 60;
    const tfMs = tfMinutes * 60 * 1000;

    let localTrend = 0;
    for (let i = limit - 1; i >= 0; i -= 1) {
      if (i % 20 === 0) {
        localTrend = (rand() - 0.5) * vol * 1.5;
      }
      const noise = (rand() - 0.5) * vol * 2.2;
      const returnPct = localTrend + noise;

      const open = price;
      const close = Math.max(base * 0.2, open * (1 + returnPct));
      const body = Math.abs(close - open);

      // Proportional, realistic wicks
      const upperWick = (rand() * 0.7 + 0.15) * (body + open * vol * 0.4);
      const lowerWick = (rand() * 0.7 + 0.15) * (body + open * vol * 0.4);
      const high = Math.max(open, close) + upperWick;
      const low = Math.max(0.00001, Math.min(open, close) - lowerWick);

      candles.push({
        time: new Date(now - i * tfMs).toISOString(),
        open: Number(open.toFixed(dp)),
        high: Number(high.toFixed(dp)),
        low: Number(low.toFixed(dp)),
        close: Number(close.toFixed(dp)),
        volume: Math.round(1200 + rand() * 8800),
      });
      price = close;
    }
    return candles;
  }

  async getCandles(entry, timeframe = 'H1', limit = 120) {
    const effectiveLimit = Math.max(30, Math.min(Number(limit) || 120, 5000));
    return this._generate(entry, timeframe, effectiveLimit);
  }

  async getQuote(entry) {
    const candles = this._generate(entry, 'H1', 30);
    const last = candles[candles.length - 1];
    return {
      symbol: entry.symbol,
      price: last.close,
      timestamp: last.time,
      source: 'mock',
    };
  }
}
