/**
 * Timeframe normalization for the market-data layer.
 *
 * The vision engine reads whatever label is printed on the chart, which varies
 * wildly by platform: "15m", "15min", "M15", "15", "H1", "1H", "60", "1h",
 * "Daily", "1D"… The market-data providers (Binance/TwelveData) only understand
 * a small canonical set (see their INTERVAL_MAP). This maps any of those raw
 * forms onto the canonical app timeframe, defaulting to H1 when unknown so the
 * pipeline always has a usable value.
 */

// Canonical timeframes the providers support.
export const CANONICAL_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

// Explicit aliases → canonical. Keys are lowercased and stripped of spaces.
const ALIASES = {
  // minutes
  '1m': 'M1', 'm1': 'M1', '1min': 'M1', '1minute': 'M1',
  '5m': 'M5', 'm5': 'M5', '5min': 'M5', '5minute': 'M5',
  '15m': 'M15', 'm15': 'M15', '15min': 'M15', '15minute': 'M15',
  '30m': 'M30', 'm30': 'M30', '30min': 'M30', '30minute': 'M30',
  // hours
  '1h': 'H1', 'h1': 'H1', '60': 'H1', '60min': 'H1', '1hour': 'H1', 'hourly': 'H1',
  '2h': 'H1', 'h2': 'H1', // no 2h feed → closest supported is H1
  '4h': 'H4', 'h4': 'H4', '240': 'H4', '4hour': 'H4',
  // days / weeks
  '1d': 'D1', 'd1': 'D1', 'daily': 'D1', 'day': 'D1', '1day': 'D1', '1440': 'D1',
  '1w': 'W1', 'w1': 'W1', 'weekly': 'W1', 'week': 'W1', '1week': 'W1',
};

/**
 * Normalize a raw timeframe label into a canonical timeframe.
 * @param {string} raw - the timeframe as detected/printed on the chart
 * @param {string} [fallback='H1']
 * @returns {string} one of CANONICAL_TIMEFRAMES
 */
export const normalizeTimeframe = (raw, fallback = 'H1') => {
  if (!raw) return fallback;
  const norm = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (!norm) return fallback;

  // Already canonical (case-insensitive): "M15", "h4", "d1"…
  const upper = norm.toUpperCase();
  if (CANONICAL_TIMEFRAMES.includes(upper)) return upper;

  // Explicit alias.
  if (ALIASES[norm]) return ALIASES[norm];

  // Pattern forms: "<n><unit>" e.g. "15min", "4h", "30m", "1d".
  const m = norm.match(/^(\d+)\s*(mois|mo|min|m|h|hr|hour|d|day|w|wk|week)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (/^(min|m)$/.test(unit)) {
      if (n <= 1) return 'M1';
      if (n <= 5) return 'M5';
      if (n <= 15) return 'M15';
      if (n <= 30) return 'M30';
      return 'H1';
    }
    if (/^(h|hr|hour)$/.test(unit)) return n >= 4 ? 'H4' : 'H1';
    if (/^(d|day)$/.test(unit)) return 'D1';
    if (/^(w|wk|week)$/.test(unit)) return 'W1';
  }

  // Bare number = minutes (TradingView style: "1", "5", "15", "60", "240").
  if (/^\d+$/.test(norm)) {
    const n = parseInt(norm, 10);
    if (n <= 1) return 'M1';
    if (n <= 5) return 'M5';
    if (n <= 15) return 'M15';
    if (n <= 30) return 'M30';
    if (n <= 60) return 'H1';
    if (n <= 240) return 'H4';
    return 'D1';
  }

  return fallback;
};

export default { normalizeTimeframe, CANONICAL_TIMEFRAMES };
