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
export const CANONICAL_TIMEFRAMES = [
  'M1', 'M2', 'M3', 'M5', 'M15', 'M30', 'M45',
  'H1', 'H2', 'H3', 'H4',
  'D1', 'W1', 'MN', '3M', '6M', '12M'
];

// Explicit aliases → canonical. Keys are lowercased and stripped of spaces.
const ALIASES = {
  // minutes
  '1m': 'M1', 'm1': 'M1', '1min': 'M1', '1minute': 'M1',
  '2m': 'M2', 'm2': 'M2', '2min': 'M2',
  '3m': 'M3', 'm3': 'M3', '3min': 'M3',
  '5m': 'M5', 'm5': 'M5', '5min': 'M5', '5minute': 'M5',
  '15m': 'M15', 'm15': 'M15', '15min': 'M15', '15minute': 'M15',
  '30m': 'M30', 'm30': 'M30', '30min': 'M30', '30minute': 'M30',
  '45m': 'M45', 'm45': 'M45', '45min': 'M45',
  // hours
  '1h': 'H1', 'h1': 'H1', '60': 'H1', '60min': 'H1', '1hour': 'H1', 'hourly': 'H1',
  '2h': 'H2', 'h2': 'H2', '2hour': 'H2', '120': 'H2',
  '3h': 'H3', 'h3': 'H3', '3hour': 'H3', '180': 'H3',
  '4h': 'H4', 'h4': 'H4', '240': 'H4', '4hour': 'H4',
  // days / weeks / months
  '1d': 'D1', 'd1': 'D1', 'daily': 'D1', 'day': 'D1', '1day': 'D1', '1440': 'D1',
  '1w': 'W1', 'w1': 'W1', 'weekly': 'W1', 'week': 'W1', '1week': 'W1',
  '1m_month': 'MN', 'monthly': 'MN', 'month': 'MN', '1mo': 'MN', '1mth': 'MN', '1month': 'MN', 'mn': 'MN',
  '3m_month': '3M', '3mo': '3M', '3month': '3M', '3months': '3M', 'quarterly': '3M',
  '6mo': '6M', '6month': '6M', '6months': '6M',
  '12mo': '12M', '12month': '12M', '12months': '12M', '1y': '12M', 'yearly': '12M',
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
  const m = norm.match(/^(\d+)\s*(mois|mo|min|m|h|hr|hour|d|day|w|wk|week|y|year)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (/^(min|m)$/.test(unit)) {
      if (n <= 1) return 'M1';
      if (n <= 2) return 'M2';
      if (n <= 3) return 'M3';
      if (n <= 5) return 'M5';
      if (n <= 15) return 'M15';
      if (n <= 30) return 'M30';
      if (n <= 45) return 'M45';
      return 'H1';
    }
    if (/^(h|hr|hour)$/.test(unit)) {
      if (n <= 1) return 'H1';
      if (n === 2) return 'H2';
      if (n === 3) return 'H3';
      return 'H4';
    }
    if (/^(d|day)$/.test(unit)) return 'D1';
    if (/^(w|wk|week)$/.test(unit)) return 'W1';
    if (/^(mo|mois)$/.test(unit)) {
      if (n <= 1) return 'MN';
      if (n <= 3) return '3M';
      if (n <= 6) return '6M';
      return '12M';
    }
    if (/^(y|year)$/.test(unit)) return '12M';
  }

  // Bare number = minutes (TradingView style: "1", "5", "15", "60", "240").
  if (/^\d+$/.test(norm)) {
    const n = parseInt(norm, 10);
    if (n <= 1) return 'M1';
    if (n <= 2) return 'M2';
    if (n <= 3) return 'M3';
    if (n <= 5) return 'M5';
    if (n <= 15) return 'M15';
    if (n <= 30) return 'M30';
    if (n <= 45) return 'M45';
    if (n <= 60) return 'H1';
    if (n <= 120) return 'H2';
    if (n <= 180) return 'H3';
    if (n <= 240) return 'H4';
    return 'D1';
  }

  return fallback;
};

export default { normalizeTimeframe, CANONICAL_TIMEFRAMES };
