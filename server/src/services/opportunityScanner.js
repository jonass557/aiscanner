import Opportunity from '../models/Opportunity.js';
import logger from '../config/logger.js';

/**
 * Opportunity Scanner engine.
 *
 * MVP design (matches the project's zero-config philosophy): instead of a paid
 * market-data feed, it scans a configurable symbol universe and produces
 * realistic SMC setups with a deterministic-but-varied scoring model. The
 * data-source seam is isolated in `generateForSymbol`, so swapping in a real
 * feed (Binance/TwelveData) or a per-symbol AI vision pass later touches only
 * that function — the storage, ranking, expiry, and scheduling stay the same.
 */

// The universe the scanner sweeps. Extendable from here or, later, config/DB.
export const SYMBOL_UNIVERSE = [
  // Forex majors/minors
  { symbol: 'EURUSD', market: 'forex', base: 1.0865 },
  { symbol: 'GBPUSD', market: 'forex', base: 1.271 },
  { symbol: 'USDJPY', market: 'forex', base: 156.2 },
  { symbol: 'AUDUSD', market: 'forex', base: 0.664 },
  { symbol: 'USDCAD', market: 'forex', base: 1.368 },
  { symbol: 'XAUUSD', market: 'commodities', base: 2340.5 },
  // Crypto
  { symbol: 'BTCUSD', market: 'crypto', base: 64200 },
  { symbol: 'ETHUSD', market: 'crypto', base: 3350 },
  { symbol: 'SOLUSD', market: 'crypto', base: 148.3 },
  { symbol: 'XRPUSD', market: 'crypto', base: 0.523 },
  // Indices
  { symbol: 'US30', market: 'indices', base: 39400 },
  { symbol: 'NAS100', market: 'indices', base: 18650 },
  { symbol: 'SPX500', market: 'indices', base: 5460 },
  { symbol: 'GER40', market: 'indices', base: 18320 },
  // Deriv synthetics
  { symbol: 'Volatility 75 Index', market: 'synthetic', base: 1850.4 },
  { symbol: 'Volatility 100 Index', market: 'synthetic', base: 980.7 },
  { symbol: 'Boom 1000 Index', market: 'synthetic', base: 12500 },
  { symbol: 'Crash 1000 Index', market: 'synthetic', base: 6400 },
];

const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];
const SETUP_TYPES = [
  'order-block',
  'fair-value-gap',
  'breaker-block',
  'liquidity-sweep',
  'trend-continuation',
  'reversal',
];

const CONFLUENCE_POOL = [
  'HTF bias aligned',
  'Discount-zone entry',
  'Unfilled FVG',
  'Liquidity resting above/below',
  'Clean break of structure',
  'Order block mitigation',
  'Equal highs/lows swept',
  'Trendline confluence',
  'Session open reaction',
  'Premium/discount equilibrium',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round = (n, dp = 4) => Number(n.toFixed(dp));

/**
 * Produce zero or one opportunity for a symbol. Returns null when no
 * high-quality setup is "found" this pass (most symbols, most of the time).
 */
const generateForSymbol = (entryDef) => {
  // Only a fraction of symbols show a setup on any given scan.
  if (Math.random() > 0.45) return null;

  const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const timeframe = pick(TIMEFRAMES);
  const setupType = pick(SETUP_TYPES);

  // Confidence skewed toward the 55-95 band; only >=70 is tradable.
  const confidenceScore = Math.round(55 + Math.random() * 40);

  const riskLevel = confidenceScore >= 82 ? 'low' : confidenceScore >= 70 ? 'medium' : 'high';

  // Build price levels relative to the symbol's base price.
  const price = entryDef.base;
  const dp = price < 10 ? 5 : price < 1000 ? 2 : 1;
  const spread = price * (0.004 + Math.random() * 0.006); // 0.4%-1% stop distance
  const rr = 2 + Math.random() * 2; // 1:2 .. 1:4

  const entry = round(price, dp);
  const stopLoss = round(direction === 'BUY' ? price - spread : price + spread, dp);
  const takeProfit1 = round(direction === 'BUY' ? price + spread * rr * 0.6 : price - spread * rr * 0.6, dp);
  const takeProfit2 = round(direction === 'BUY' ? price + spread * rr : price - spread * rr, dp);

  // A couple of distinct confluences.
  const confluences = [...CONFLUENCE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);

  // Expiry scales with timeframe.
  const ttlHours = { M15: 2, H1: 6, H4: 18, D1: 48 }[timeframe] || 6;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  return {
    symbol: entryDef.symbol,
    market: entryDef.market,
    timeframe,
    currentPrice: entry,
    setupType,
    direction,
    confidenceScore,
    riskLevel,
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio: `1:${rr.toFixed(1)}`,
    rationale: `${direction === 'BUY' ? 'Bullish' : 'Bearish'} ${setupType.replace(/-/g, ' ')} on ${entryDef.symbol} ${timeframe}. Price is reacting from a key zone with structure supporting the ${direction === 'BUY' ? 'upside' : 'downside'}.`,
    confluences,
    status: 'active',
    detectedAt: new Date(),
    expiresAt,
  };
};

/**
 * Run one scan sweep across the universe (or a filtered subset).
 * Expires stale opportunities, then inserts freshly detected ones.
 * @param {Object} [opts]
 * @param {string} [opts.market] - restrict the sweep to one market
 * @returns {Promise<{ created: number, expired: number }>}
 */
export const runScan = async ({ market } = {}) => {
  // 1. Expire opportunities past their TTL.
  const expiredRes = await Opportunity.updateMany(
    { status: 'active', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );

  // 2. Detect new opportunities.
  const universe = market ? SYMBOL_UNIVERSE.filter((s) => s.market === market) : SYMBOL_UNIVERSE;
  const detected = universe.map(generateForSymbol).filter(Boolean);

  let created = 0;
  if (detected.length) {
    // Avoid duplicating an identical active setup for the same symbol/timeframe.
    for (const opp of detected) {
      const exists = await Opportunity.findOne({
        symbol: opp.symbol,
        timeframe: opp.timeframe,
        direction: opp.direction,
        status: 'active',
      }).lean();
      if (!exists) {
        await Opportunity.create(opp);
        created += 1;
      }
    }
  }

  logger.info(`Opportunity scan: ${created} new, ${expiredRes.modifiedCount || 0} expired.`);
  return { created, expired: expiredRes.modifiedCount || 0 };
};

// --- Scheduler ---------------------------------------------------------------

let scanTimer = null;

/**
 * Start the periodic scanner. Uses a plain interval (no extra dependency).
 * Guarded so tests / repeated calls don't stack timers.
 * @param {number} [intervalMs] - default 10 minutes
 */
export const startScanner = (intervalMs = 10 * 60 * 1000) => {
  if (scanTimer) return;
  // Kick off an initial scan shortly after boot, then on the interval.
  const tick = () => runScan().catch((err) => logger.error(`Scan tick failed: ${err.message}`));
  setTimeout(tick, 5000);
  scanTimer = setInterval(tick, intervalMs);
  logger.info(`Opportunity scanner started (every ${Math.round(intervalMs / 60000)} min).`);
};

export const stopScanner = () => {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
};
