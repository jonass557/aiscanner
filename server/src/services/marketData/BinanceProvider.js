import { BaseMarketProvider } from './BaseMarketProvider.js';

/**
 * Binance market-data provider (crypto only).
 *
 * Uses Binance's PUBLIC REST endpoints — no API key required, so this is real
 * live data with zero configuration. Only symbols with a `binance` mapping in
 * the catalog (e.g. BTCUSD → BTCUSDT) are supported here.
 */

const INTERVAL_MAP = {
  M1: '1m', '1m': '1m',
  M2: '1m', '2m': '1m',
  M3: '3m', '3m': '3m',
  M5: '5m', '5m': '5m',
  M15: '15m', '15m': '15m',
  M30: '30m', '30m': '30m',
  M45: '15m', '45m': '15m',
  H1: '1h', '1h': '1h',
  H2: '2h', '2h': '2h',
  H3: '2h', '3h': '2h',
  H4: '4h', '4h': '4h',
  D1: '1d', '1d': '1d',
  W1: '1w', '1w': '1w',
  MN: '1M', '1M': '1M', 'monthly': '1M',
  '3M': '1M',
  '6M': '1M',
  '12M': '1M',
};

export class BinanceProvider extends BaseMarketProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'binance';
    // Use data-api.binance.vision as primary (unrestricted public market data cluster)
    this.endpoints = [
      'https://data-api.binance.vision',
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api3.binance.com',
    ];
    if (config.baseUrl) this.endpoints.unshift(config.baseUrl);
  }

  isConfigured() {
    return true; // public endpoints, no key needed
  }

  /** This provider only handles crypto symbols that carry a binance mapping. */
  supports(entry) {
    return entry?.market === 'crypto' && Boolean(entry.binance);
  }

  async _fetch(path) {
    let lastErr = null;
    for (const base of this.endpoints) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Binance endpoints failed.');
  }

  async getQuote(entry) {
    const data = await this._fetch(`/api/v3/ticker/price?symbol=${entry.binance}`);
    return {
      symbol: entry.symbol,
      price: Number(data.price),
      timestamp: new Date().toISOString(),
      source: 'binance',
    };
  }

  async getCandles(entry, timeframe = 'H1', limit = 120) {
    const interval = INTERVAL_MAP[timeframe] || '1h';
    const rows = await this._fetch(
      `/api/v3/klines?symbol=${entry.binance}&interval=${interval}&limit=${Math.min(1000, limit)}`
    );
    // Binance kline: [openTime, open, high, low, close, volume, ...]
    return rows.map((k) => ({
      time: new Date(k[0]).toISOString(),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }
}
