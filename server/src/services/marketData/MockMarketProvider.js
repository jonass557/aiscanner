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

    const baseVol =
      {
        M1: 0.0012,
        M2: 0.0016,
        M3: 0.0020,
        M5: 0.0025,
        M15: 0.0035,
        M30: 0.0045,
        M45: 0.0052,
        H1: 0.0065,
        H2: 0.0085,
        H3: 0.0100,
        H4: 0.0125,
        D1: 0.0220,
        W1: 0.0450,
      }[timeframe] || 0.0065;

    const candles = [];
    const now = Date.now();
    const tfMinutes =
      { M1: 1, M2: 2, M3: 3, M5: 5, M15: 15, M30: 30, M45: 45, H1: 60, H2: 120, H3: 180, H4: 240, D1: 1440, W1: 10080 }[timeframe] || 60;
    const tfMs = tfMinutes * 60 * 1000;

    let price = base * (0.97 + rand() * 0.06);
    let regime = 0; // -1: bear, 0: range, 1: bull
    let regimeDuration = 0;

    for (let i = limit - 1; i >= 0; i -= 1) {
      if (regimeDuration <= 0) {
        const r = rand();
        regime = r < 0.38 ? -1 : r < 0.74 ? 1 : 0;
        regimeDuration = Math.floor(12 + rand() * 28);
      }
      regimeDuration -= 1;

      // Drift is moderate so bull/bear pullbacks are naturally mixed (not solid single-color runs)
      const drift = regime === 1 ? baseVol * 0.35 : regime === -1 ? -baseVol * 0.35 : 0;

      // Box-Muller standard normal noise
      const u1 = Math.max(1e-6, rand());
      const u2 = rand();
      const normalNoise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      // Volatility clustering: 80% normal, 15% medium, 5% high breakout
      const volPicker = rand();
      const barVol = volPicker > 0.94 ? baseVol * 2.2 : volPicker > 0.75 ? baseVol * 1.4 : baseVol * (0.7 + rand() * 0.6);

      // Guarantee clear, healthy candle body (no flat 1-pixel barcode ticks)
      const rawMove = drift + normalNoise * barVol;
      const dir = rawMove >= 0 ? 1 : -1;
      const minBodyPct = barVol * (0.40 + rand() * 0.35);
      const returnPct = dir * Math.max(minBodyPct, Math.abs(rawMove));

      const open = price;
      const close = Math.max(base * 0.15, open * (1 + returnPct));
      const body = Math.abs(close - open);

      // Diverse candlestick forms (clean bodies dominate wicks)
      const shapeType = rand();
      let upperWick, lowerWick;

      if (shapeType < 0.06) {
        // Pinbar / shooting star
        upperWick = body * (1.4 + rand() * 1.6);
        lowerWick = body * (0.1 + rand() * 0.25);
      } else if (shapeType < 0.12) {
        // Hammer / rejection low
        lowerWick = body * (1.4 + rand() * 1.6);
        upperWick = body * (0.1 + rand() * 0.25);
      } else if (shapeType < 0.22) {
        // Spinning top (healthy body, modest wicks)
        upperWick = body * (0.45 + rand() * 0.55);
        lowerWick = body * (0.45 + rand() * 0.55);
      } else {
        // Standard institutional trading candle
        upperWick = body * (0.15 + rand() * 0.30);
        lowerWick = body * (0.15 + rand() * 0.30);
      }

      const high = Math.max(open, close) + upperWick;
      const low = Math.max(0.00001, Math.min(open, close) - lowerWick);

      candles.push({
        time: new Date(now - i * tfMs).toISOString(),
        open: Number(open.toFixed(dp)),
        high: Number(high.toFixed(dp)),
        low: Number(low.toFixed(dp)),
        close: Number(close.toFixed(dp)),
        volume: Math.round(1500 + rand() * 9500),
      });
      price = close;
    }
    return candles;
  }

  async getCandles(entry, timeframe = 'H1', limit = 120) {
    const effectiveLimit = Math.max(30, Math.min(Number(limit) || 120, 15000));
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
