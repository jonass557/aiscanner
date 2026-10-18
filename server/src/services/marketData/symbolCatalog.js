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
  // Forex crosses (no USD leg). TwelveData supplies real quotes; mock fallback in dev.
  { symbol: 'EURAUD', market: 'forex', label: 'EUR/AUD', base: 1.636 },
  { symbol: 'EURGBP', market: 'forex', label: 'EUR/GBP', base: 0.855 },
  { symbol: 'EURJPY', market: 'forex', label: 'EUR/JPY', base: 169.7 },
  { symbol: 'GBPJPY', market: 'forex', label: 'GBP/JPY', base: 198.4 },
  { symbol: 'AUDJPY', market: 'forex', label: 'AUD/JPY', base: 103.7 },
  { symbol: 'EURCAD', market: 'forex', label: 'EUR/CAD', base: 1.486 },
  { symbol: 'GBPAUD', market: 'forex', label: 'GBP/AUD', base: 1.913 },
  { symbol: 'AUDNZD', market: 'forex', label: 'AUD/NZD', base: 1.088 },
  { symbol: 'CADJPY', market: 'forex', label: 'CAD/JPY', base: 114.2 },
  { symbol: 'CHFJPY', market: 'forex', label: 'CHF/JPY', base: 172.8 },
  // Commodities
  { symbol: 'XAUUSD', market: 'commodities', label: 'Gold (XAU/USD)', base: 2685.0 },
  { symbol: 'XAGUSD', market: 'commodities', label: 'Silver (XAG/USD)', base: 31.8 },
  { symbol: 'USOIL', market: 'commodities', label: 'WTI Crude Oil', base: 74.5 },
  { symbol: 'UKOIL', market: 'commodities', label: 'Brent Crude Oil', base: 78.2 },
  // Crypto (Binance pairs)
  { symbol: 'BTCUSD', market: 'crypto', label: 'Bitcoin', base: 68400, binance: 'BTCUSDT' },
  { symbol: 'ETHUSD', market: 'crypto', label: 'Ethereum', base: 2640, binance: 'ETHUSDT' },
  { symbol: 'SOLUSD', market: 'crypto', label: 'Solana', base: 158.0, binance: 'SOLUSDT' },
  { symbol: 'XRPUSD', market: 'crypto', label: 'XRP', base: 0.548, binance: 'XRPUSDT' },
  { symbol: 'BNBUSD', market: 'crypto', label: 'BNB', base: 595, binance: 'BNBUSDT' },
  // Indices (TwelveData / LiveMarket)
  { symbol: 'US30', market: 'indices', label: 'US 30 (Dow Jones)', base: 43250 },
  { symbol: 'NAS100', market: 'indices', label: 'NAS 100 (Nasdaq)', base: 20450 },
  { symbol: 'SPX500', market: 'indices', label: 'S&P 500', base: 5860 },
  { symbol: 'GER40', market: 'indices', label: 'GER 40 (DAX)', base: 19550 },
  // Deriv synthetics
  { symbol: 'Volatility 75 Index', market: 'synthetic', label: 'Volatility 75 Index', base: 325400 },
  { symbol: 'Volatility 100 Index', market: 'synthetic', label: 'Volatility 100 Index', base: 1840 },
  { symbol: 'Volatility 25 Index', market: 'synthetic', label: 'Volatility 25 Index', base: 2450 },
  { symbol: 'Volatility 50 Index', market: 'synthetic', label: 'Volatility 50 Index', base: 412.5 },
  { symbol: 'Boom 1000 Index', market: 'synthetic', label: 'Boom 1000 Index', base: 12500 },
  { symbol: 'Crash 1000 Index', market: 'synthetic', label: 'Crash 1000 Index', base: 6400 },
  { symbol: 'Boom 500 Index', market: 'synthetic', label: 'Boom 500 Index', base: 4820 },
  { symbol: 'Crash 500 Index', market: 'synthetic', label: 'Crash 500 Index', base: 3910 },
  { symbol: 'Step Index', market: 'synthetic', label: 'Step Index', base: 8420 },
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
  euraud: 'EURAUD', 'eur/aud': 'EURAUD',
  eurgbp: 'EURGBP', 'eur/gbp': 'EURGBP',
  eurjpy: 'EURJPY', 'eur/jpy': 'EURJPY',
  gbpjpy: 'GBPJPY', 'gbp/jpy': 'GBPJPY', guppy: 'GBPJPY',
  audjpy: 'AUDJPY', 'aud/jpy': 'AUDJPY',
  eurcad: 'EURCAD', 'eur/cad': 'EURCAD',
  gbpaud: 'GBPAUD', 'gbp/aud': 'GBPAUD',
  audnzd: 'AUDNZD', 'aud/nzd': 'AUDNZD',
  cadjpy: 'CADJPY', 'cad/jpy': 'CADJPY',
  chfjpy: 'CHFJPY', 'chf/jpy': 'CHFJPY',
  xauusd: 'XAUUSD', 'xau/usd': 'XAUUSD', or: 'XAUUSD', gold: 'XAUUSD', 'gold/usd': 'XAUUSD',
  xagusd: 'XAGUSD', 'xag/usd': 'XAGUSD', argent: 'XAGUSD', silver: 'XAGUSD',
  usoil: 'USOIL', wti: 'USOIL', oil: 'USOIL', petrole: 'USOIL', 'us oil': 'USOIL',
  ukoil: 'UKOIL', brent: 'UKOIL',
  btcusd: 'BTCUSD', btc: 'BTCUSD', bitcoin: 'BTCUSD', 'btc/usd': 'BTCUSD', btcusdt: 'BTCUSD',
  ethusd: 'ETHUSD', eth: 'ETHUSD', ethereum: 'ETHUSD', 'eth/usd': 'ETHUSD', ethusdt: 'ETHUSD',
  solusd: 'SOLUSD', sol: 'SOLUSD', solana: 'SOLUSD', 'sol/usd': 'SOLUSD', solusdt: 'SOLUSD',
  xrpusd: 'XRPUSD', xrp: 'XRPUSD', 'xrp/usd': 'XRPUSD', xrpusdt: 'XRPUSD',
  bnbusd: 'BNBUSD', bnb: 'BNBUSD', 'bnb/usd': 'BNBUSD', bnbusdt: 'BNBUSD',
  us30: 'US30', 'us 30': 'US30', dow: 'US30', 'dow jones': 'US30', dji: 'US30',
  nas100: 'NAS100', us100: 'NAS100', 'us 100': 'NAS100', nasdaq: 'NAS100', 'nas 100': 'NAS100', ustec: 'NAS100',
  spx500: 'SPX500', us500: 'SPX500', 'us 500': 'SPX500', 'spx 500': 'SPX500', sp500: 'SPX500', 's&p': 'SPX500',
  ger40: 'GER40', 'ger 40': 'GER40', dax: 'GER40', dax40: 'GER40', de40: 'GER40',
  'volatility 75': 'Volatility 75 Index', 'vol 75': 'Volatility 75 Index', v75: 'Volatility 75 Index', vol75: 'Volatility 75 Index',
  'volatility 100': 'Volatility 100 Index', 'vol 100': 'Volatility 100 Index', v100: 'Volatility 100 Index', vol100: 'Volatility 100 Index',
  'volatility 25': 'Volatility 25 Index', 'vol 25': 'Volatility 25 Index', v25: 'Volatility 25 Index', vol25: 'Volatility 25 Index',
  'volatility 50': 'Volatility 50 Index', 'vol 50': 'Volatility 50 Index', v50: 'Volatility 50 Index', vol50: 'Volatility 50 Index',
  'boom 1000': 'Boom 1000 Index', boom1000: 'Boom 1000 Index', boom: 'Boom 1000 Index', 'boom & crash': 'Boom 1000 Index',
  'crash 1000': 'Crash 1000 Index', crash1000: 'Crash 1000 Index', crash: 'Crash 1000 Index',
  'boom 500': 'Boom 500 Index', boom500: 'Boom 500 Index',
  'crash 500': 'Crash 500 Index', crash500: 'Crash 500 Index',
  step: 'Step Index', 'step index': 'Step Index', stepindex: 'Step Index',
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
