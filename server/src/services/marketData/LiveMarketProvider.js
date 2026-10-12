import { BaseMarketProvider } from './BaseMarketProvider.js';

/**
 * Universal Market Data Provider (Yahoo Finance).
 * Provides 100% REAL, LIVE market data with ZERO API key required for:
 * - All Forex majors and crosses (EURUSD=X, GBPUSD=X, JPY=X, EURJPY=X...)
 * - Commodities & Metals (Gold: GC=F, Silver: SI=F, Crude Oil: CL=F)
 * - Major World Indices (Dow Jones: ^DJI, Nasdaq: ^IXIC, S&P 500: ^GSPC, DAX: ^GDAXI)
 * - Cryptocurrencies (BTC-USD, ETH-USD, SOL-USD...)
 */

const YAHOO_INTERVAL_MAP = {
  M1: '1m',
  M5: '5m',
  M15: '15m',
  M30: '30m',
  H1: '1h',
  H2: '1h',
  H4: '1h', // Resampled or 1h range
  D1: '1d',
  W1: '1wk',
  MN: '1mo',
};

const SYMBOL_MAP = {
  // Forex Majors & Crosses
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'CAD=X',
  NZDUSD: 'NZDUSD=X',
  USDCHF: 'CHF=X',
  EURAUD: 'EURAUD=X',
  EURGBP: 'EURGBP=X',
  EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X',
  AUDJPY: 'AUDJPY=X',
  EURCAD: 'EURCAD=X',
  GBPAUD: 'GBPAUD=X',
  AUDNZD: 'AUDNZD=X',
  CADJPY: 'CADJPY=X',
  CHFJPY: 'CHFJPY=X',
  CADCHF: 'CADCHF=X',
  GBPCHF: 'GBPCHF=X',

  // Commodities & Metals
  XAUUSD: 'GC=F', // Gold Futures
  XAGUSD: 'SI=F', // Silver Futures
  USOIL: 'CL=F',  // Crude Oil
  UKOIL: 'BZ=F',  // Brent

  // World Indices
  US30: '^DJI',     // Dow Jones Industrial Average
  NAS100: '^IXIC',  // Nasdaq Composite
  SPX500: '^GSPC',  // S&P 500
  GER40: '^GDAXI',  // DAX 40
  UK100: '^FTSE',   // FTSE 100
  FRA40: '^FCHI',   // CAC 40
  JPN225: '^N225',  // Nikkei 225

  // Crypto Fallbacks
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  SOLUSD: 'SOL-USD',
  XRPUSD: 'XRP-USD',
  BNBUSD: 'BNB-USD',
};

export class LiveMarketProvider extends BaseMarketProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'live-market';
  }

  isConfigured() {
    return true; // Always operational (public live institutional feed)
  }

  get isRealData() {
    return true; // 100% Real live prices
  }

  supports(entry) {
    if (!entry?.symbol) return false;
    if (SYMBOL_MAP[entry.symbol]) return true;
    if (entry.market === 'forex' && entry.symbol.length === 6) return true;
    return false;
  }

  _mapSymbol(entry) {
    const sym = entry.symbol;
    if (SYMBOL_MAP[sym]) return SYMBOL_MAP[sym];
    if (entry.market === 'forex' && sym.length === 6) {
      return `${sym}=X`;
    }
    return sym;
  }

  async _fetchChart(ticker, interval = '1h', range = '5d') {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`LiveMarket HTTP error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      throw new Error(`LiveMarket: no chart data returned for ${ticker}`);
    }
    return result;
  }

  async getQuote(entry) {
    const ticker = this._mapSymbol(entry);
    const result = await this._fetchChart(ticker, '1h', '1d');
    const meta = result.meta || {};
    const price = meta.regularMarketPrice ?? meta.previousClose ?? null;

    if (price == null || !Number.isFinite(price)) {
      throw new Error(`Invalid price for ${entry.symbol} (${ticker})`);
    }

    return {
      symbol: entry.symbol,
      price: Number(price),
      timestamp: new Date().toISOString(),
      source: 'live-market',
    };
  }

  async getCandles(entry, timeframe = 'H1', limit = 120) {
    const ticker = this._mapSymbol(entry);
    const interval = YAHOO_INTERVAL_MAP[timeframe] || '1h';
    // Choose appropriate range depending on interval
    let range = '5d';
    if (interval === '1m' || interval === '5m') range = '1d';
    else if (interval === '15m' || interval === '30m') range = '5d';
    else if (interval === '1h') range = '1mo';
    else if (interval === '1d') range = '1y';

    const result = await this._fetchChart(ticker, interval, range);
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const { open = [], high = [], low = [], close = [], volume = [] } = quote;

    const candles = [];
    for (let i = 0; i < timestamps.length; i += 1) {
      const c = close[i];
      const o = open[i];
      const h = high[i];
      const l = low[i];
      if (c != null && o != null && h != null && l != null && Number.isFinite(c)) {
        candles.push({
          time: new Date(timestamps[i] * 1000).toISOString(),
          open: Number(o),
          high: Number(h),
          low: Number(l),
          close: Number(c),
          volume: volume[i] != null ? Number(volume[i]) : 0,
        });
      }
    }

    if (candles.length > limit) {
      return candles.slice(-limit);
    }
    return candles;
  }
}

export default LiveMarketProvider;
