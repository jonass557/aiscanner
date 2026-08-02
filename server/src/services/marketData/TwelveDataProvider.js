import { BaseMarketProvider } from './BaseMarketProvider.js';

/**
 * TwelveData provider — forex, indices, commodities (and crypto as a backup).
 *
 * Requires TWELVEDATA_API_KEY. The free tier is rate-limited, so this is best
 * for on-demand assistant analyses rather than a high-frequency background job.
 * Falls back to the mock provider (in index.js) when no key is configured.
 */

const INTERVAL_MAP = {
  M5: '5min', M15: '15min', M30: '30min', H1: '1h', H4: '4h', D1: '1day',
};

// App symbol → TwelveData symbol (forex uses slashes; indices use their tickers).
const SYMBOL_MAP = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD', NZDUSD: 'NZD/USD', USDCHF: 'USD/CHF',
  XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD',
  US30: 'DJI', NAS100: 'IXIC', SPX500: 'SPX', GER40: 'DAX',
};

export class TwelveDataProvider extends BaseMarketProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'twelvedata';
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.twelvedata.com';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  /** Anything with a known mapping (forex/indices/commodities). */
  supports(entry) {
    return Boolean(SYMBOL_MAP[entry?.symbol]);
  }

  _map(entry) {
    return SYMBOL_MAP[entry.symbol] || entry.symbol;
  }

  async _fetch(path) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${this.baseUrl}${path}${sep}apikey=${this.apiKey}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`TwelveData API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    // TwelveData signals errors in the body with status: 'error'.
    if (data.status === 'error') throw new Error(`TwelveData: ${data.message || 'request failed'}`);
    return data;
  }

  async getQuote(entry) {
    const data = await this._fetch(`/price?symbol=${encodeURIComponent(this._map(entry))}`);
    return {
      symbol: entry.symbol,
      price: Number(data.price),
      timestamp: new Date().toISOString(),
      source: 'twelvedata',
    };
  }

  async getCandles(entry, timeframe = 'H1', limit = 120) {
    const interval = INTERVAL_MAP[timeframe] || '1h';
    const data = await this._fetch(
      `/time_series?symbol=${encodeURIComponent(this._map(entry))}&interval=${interval}&outputsize=${Math.min(5000, limit)}`
    );
    // values are newest → oldest; reverse to oldest → newest for consistency.
    const values = Array.isArray(data.values) ? [...data.values].reverse() : [];
    return values.map((v) => ({
      time: new Date(v.datetime).toISOString(),
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume ? Number(v.volume) : 0,
    }));
  }
}
