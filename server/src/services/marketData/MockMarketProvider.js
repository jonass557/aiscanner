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
      { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440, W1: 10080 }[timeframe] || 60;
    const tfMs = tfMinutes * 60 * 1000;

    // Multi-wave structure so candles form clear trends, pullbacks, and supply/demand zones
    let momentum = (rand() - 0.48) * 0.5;
    for (let i = limit - 1; i >= 0; i -= 1) {
      const idx = limit - 1 - i;
      const macroWave = Math.sin(idx / 18) * 0.45 + Math.cos(idx / 9) * 0.35;
      momentum = momentum * 0.65 + (rand() - 0.49 + macroWave * 0.35) * 0.35;

      // Ensure every candle has a clear, visible body (never a flat aligned doji)
      const sign = momentum >= 0 ? 1 : -1;
      const bodyMagnitude = (0.35 + rand() * 0.85) * vol * price;
      const delta = sign * bodyMagnitude + momentum * vol * price * 0.4;

      const open = price;
      const close = Math.max(base * 0.2, open + delta);
      const body = Math.abs(close - open);

      // Proportional, realistic wicks (20% to 85% of body size)
      const upperWick = body * (0.18 + rand() * 0.65);
      const lowerWick = body * (0.18 + rand() * 0.65);
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
