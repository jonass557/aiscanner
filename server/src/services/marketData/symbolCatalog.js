/**
 * Canonical symbol catalog for the market-data layer.
 *
 * `resolveSymbol()` maps whatever the user typed ("EURUSD", "or", "Boom & Crash")
 * to a canonical symbol + market + (optional) Binance/TwelveData mapping.
 *
 * Base prices are used ONLY by the mock provider (deterministic fallback) so the
 * app works zero-config in development. Real providers override with live data.
 */

export const SYMBOL_CATALOG = [
  // Forex
  { symbol: 'EURUSD', market: 'forex', label: 'EUR/USD', base: 1.0865 },
  { symbol: 'GBPUSD', market: 'forex', label: 'GBP/USD', base: 1.271 },
  { symbol: 'USDJPY', market: 'forex', label: 'USD/JPY', base: 156.2 },
  { symbol: 'AUDUSD', market: 'forex', label: 'AUD/USD', base: 0.664 },
  { symbol: 'USDCAD', market: 'forex', label: 'USD/CAD', base: 1.368 },
  { symbol: 'NZDUSD', market: 'forex', label: 'NZD/USD', base: 0.61 },
  { symbol: 'USDCHF', market: 'forex', label: 'USD/CHF', base: 0.904 },
  // Commodities
  { symbol: 'XAUUSD', market: 'commodities', label: 'Gold', base: 2340.5 },
  { symbol: 'XAGUSD', market: 'commodities', label: 'Silver', base: 28.9 },
  // Crypto (Binance pairs)
  { symbol: 'BTCUSD', market: 'crypto', label: 'Bitcoin', base: 64200, binance: 'BTCUSDT' },
  { symbol: 'ETHUSD', market: 'crypto', label: 'Ethereum', base: 3350, binance: 'ETHUSDT' },
  { symbol: 'SOLUSD', market: 'crypto', label: 'Solana', base: 148.3, binance: 'SOLUSDT' },
  { symbol: 'XRPUSD', market: 'crypto', label: 'XRP', base: 0.523, binance: 'XRPUSDT' },
  { symbol: 'BNBUSD', market: 'crypto', label: 'BNB', base: 585, binance: 'BNBUSDT' },
  // Indices (TwelveData; mock fallback in dev)
  { symbol: 'US30', market: 'indices', label: 'US 30', base: 39400 },
  { symbol: 'NAS100', market: 'indices', label: 'NAS 100', base: 18650 },
  { symbol: 'SPX500', market: 'indices', label: 'S&P 500', base: 5460 },
  { symbol: 'GER40', market: 'indices', label: 'GER 40', base: 18320 },
  // Deriv synthetics (mock only — no public real-time feed)
  { symbol: 'Volatility 75 Index', market: 'synthetic', label: 'Volatility 75', base: 1850.4 },
  { symbol: 'Volatility 100 Index', market: 'synthetic', label: 'Volatility 100', base: 980.7 },
  { symbol: 'Boom 1000 Index', market: 'synthetic', label: 'Boom 1000', base: 12500 },
  { symbol: 'Crash 1000 Index', market: 'synthetic', label: 'Crash 1000', base: 6400 },
];

// Aliases so natural-language mentions resolve ("or", "gold", "btc", "booms").
const ALIASES = {
  eurusd: 'EURUSD', 'eur/usd': 'EURUSD', euro: 'EURUSD',
  gbpusd: 'GBPUSD', 'gbp/usd': 'GBPUSD', cable: 'GBPUSD', livre: 'GBPUSD',
  usdjpy: 'USDJPY', 'usd/jpy': 'USDJPY',
  audusd: 'AUDUSD', 'aud/usd': 'AUDUSD',
  usdcad: 'USDCAD', 'usd/cad': 'USDCAD',
  nzdusd: 'NZDUSD', 'nzd/usd': 'NZDUSD',
  usdchf: 'USDCHF', 'usd/chf': 'USDCHF',
  xauusd: 'XAUUSD', 'xau/usd': 'XAUUSD', or: 'XAUUSD', gold: 'XAUUSD', 'gold/usd': 'XAUUSD',
  xagusd: 'XAGUSD', argent: 'XAGUSD', silver: 'XAGUSD',
  btcusd: 'BTCUSD', btc: 'BTCUSD', bitcoin: 'BTCUSD', 'btc/usd': 'BTCUSD',
  ethusd: 'ETHUSD', eth: 'ETHUSD', ethereum: 'ETHUSD',
  solusd: 'SOLUSD', sol: 'SOLUSD', solana: 'SOLUSD',
  xrpusd: 'XRPUSD', xrp: 'XRPUSD',
  bnbusd: 'BNBUSD', bnb: 'BNBUSD',
  us30: 'US30', 'us 30': 'US30', dow: 'US30', 'dow jones': 'US30',
  nas100: 'NAS100', nasdaq: 'NAS100', 'nas 100': 'NAS100',
  spx500: 'SPX500', 'spx 500': 'SPX500', sp500: 'SPX500', 's&p': 'SPX500',
  ger40: 'GER40', 'ger 40': 'GER40', dax: 'GER40',
  'volatility 75': 'Volatility 75 Index', 'vol 75': 'Volatility 75 Index', v75: 'Volatility 75 Index',
  'volatility 100': 'Volatility 100 Index', 'vol 100': 'Volatility 100 Index', v100: 'Volatility 100 Index',
  'boom 1000': 'Boom 1000 Index', boom: 'Boom 1000 Index', 'boom & crash': 'Boom 1000 Index',
  'crash 1000': 'Crash 1000 Index', crash: 'Crash 1000 Index',
};

// Market filters from the prompt: "indices synthétiques Deriv", "Boom & Crash", "crypto"…
export const MARKET_KEYWORDS = {
  synthetic: ['synthetique', 'synthetic', 'deriv', 'boom', 'crash', 'volatility', 'vol 75', 'vol 100'],
  crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp'],
  forex: ['forex', 'eur', 'gbp', 'usd', 'devises'],
  indices: ['indice', 'indices', 'index', 'bourse', 'us30', 'nasdaq', 'sp500'],
  commodities: ['commoditie', 'or', 'gold', 'argent', 'silver', 'petrole', 'oil'],
};

/**
 * Canonicalize a raw user mention into a catalog entry (or null).
 * @param {string} text
 * @param {Object} [opts]
 * @param {boolean} [opts.fuzzy=true] - allow substring matching (off for short tokens)
 * @returns {Object|null} { symbol, market, label, base, binance? }
 */
export const resolveSymbol = (text, { fuzzy = true } = {}) => {
  if (!text) return null;
  const norm = String(text).trim().toLowerCase().replace(/[^\w\s/.-]/g, '');
  if (!norm) return null;
  // Exact catalog symbol first.
  const direct = SYMBOL_CATALOG.find((s) => s.symbol.toLowerCase() === norm);
  if (direct) return direct;
  // Alias lookup (exact).
  const viaAlias = ALIASES[norm];
  if (viaAlias) return SYMBOL_CATALOG.find((s) => s.symbol === viaAlias) || null;
  // Fuzzy substring — only for tokens long enough to be unambiguous (avoids
  // "et" matching "ethusd"). Requires 4+ chars.
  if (fuzzy && norm.length >= 4) {
    const f = SYMBOL_CATALOG.find(
      (s) => s.symbol.toLowerCase().includes(norm) || norm.includes(s.symbol.toLowerCase())
    );
    if (f) return f;
  }
  return null;
};

/** Infer a market filter from text ("analyse uniquement les indices synthétiques Deriv"). */
export const inferMarket = (text) => {
  const norm = String(text || '').toLowerCase();
  for (const [market, keywords] of Object.entries(MARKET_KEYWORDS)) {
    if (keywords.some((k) => norm.includes(k))) return market;
  }
  return null;
};

export const MARKET_LABELS = {
  forex: 'Forex',
  crypto: 'Crypto',
  indices: 'Indices',
  commodities: 'Commodities',
  synthetic: 'Deriv Synthétiques',
  unknown: 'Inconnu',
};
