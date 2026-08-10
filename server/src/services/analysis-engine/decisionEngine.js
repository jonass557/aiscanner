import { scoreConfluences } from './confluenceRules.js';

/**
 * Engine 3 — Decision.
 *
 * The scanner ALWAYS returns an actionable direction: BUY or SELL. There is no
 * WAIT / NO_TRADE. A professional read always tells the user which side has the
 * edge right now, where to enter, where the stop goes and where to target —
 * anchored on the REAL live price when a market snapshot is available.
 *
 * Hybrid + transparent:
 *  1. The direction comes from (in order): the AI candidateSetup, else the
 *     technical bias, else the live price action (last close vs a short SMA).
 *  2. The confidence score is computed DETERMINISTICALLY by confluenceRules from
 *     the reading — reproducible and explainable. It NO LONGER gates the verdict;
 *     it only informs the user (confidenceLabel) how strong the confluence is.
 *  3. The trade plan is always complete. If the model supplied SL/TP we keep them
 *     (anchored to the live entry); otherwise we synthesize them from live
 *     volatility (ATR) with fixed reward multiples.
 */

// Kept for backward compatibility / reference; no longer used to gate a verdict.
export const MIN_CONFIDENCE = 70;
export const MIN_RR = 1.5;

// Reward multiples (× risk) used when synthesizing targets.
const RR_TARGETS = [1.5, 2.5, 4];
// Stop distance as a multiple of ATR when synthesizing a stop.
const ATR_STOP_MULT = 1.5;
// Fallback stop distance as a fraction of price when there is no live data.
const PCT_STOP = 0.005; // 0.5%

/** Round to a sensible number of decimals based on the price magnitude. */
const roundPrice = (v) => {
  if (v == null || !Number.isFinite(v)) return null;
  const abs = Math.abs(v);
  const decimals = abs >= 1000 ? 2 : abs >= 100 ? 3 : abs >= 1 ? 4 : 6;
  return Number(v.toFixed(decimals));
};

/** Average True Range (approx: mean high-low range) over the last n candles. */
const computeAtr = (candles, n = 14) => {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const slice = candles.slice(-n);
  const ranges = slice
    .map((c) => (c.high != null && c.low != null ? Math.abs(c.high - c.low) : null))
    .filter((r) => r != null && Number.isFinite(r) && r > 0);
  if (!ranges.length) return null;
  return ranges.reduce((s, r) => s + r, 0) / ranges.length;
};

/** Simple moving average of closes over the last n candles. */
const smaClose = (candles, n = 20) => {
  if (!Array.isArray(candles) || candles.length === 0) return null;
  const slice = candles.slice(-n).map((c) => c.close).filter((c) => c != null);
  if (!slice.length) return null;
  return slice.reduce((s, c) => s + c, 0) / slice.length;
};

/**
 * Derive a direction from live candles: last close vs short SMA. Falls back to
 * the last candle body direction, then to BUY (never null — the scanner must
 * always take a side).
 */
const directionFromLive = (candles) => {
  if (Array.isArray(candles) && candles.length) {
    const last = candles[candles.length - 1];
    const sma = smaClose(candles, Math.min(20, candles.length));
    if (last?.close != null && sma != null) {
      if (last.close > sma) return 'BUY';
      if (last.close < sma) return 'SELL';
    }
    if (last?.close != null && last?.open != null) {
      return last.close >= last.open ? 'BUY' : 'SELL';
    }
  }
  return null;
};

/** Rough time horizon label from the perceived timeframe. */
const durationFor = (timeframe) => {
  const tf = String(timeframe || '').toUpperCase();
  if (['M1', 'M5', 'M15'].includes(tf)) return '1-4 hours';
  if (['M30', 'H1'].includes(tf)) return '4-12 hours';
  if (['H4'].includes(tf)) return '12-48 hours';
  return '1-3 days';
};

const tradeTypeFor = (timeframe) => {
  const tf = String(timeframe || '').toUpperCase();
  if (['M1', 'M5', 'M15'].includes(tf)) return 'scalp';
  if (['M30', 'H1', 'H4'].includes(tf)) return 'intraday';
  return 'swing';
};

/** Human label for the deterministic confluence score. */
export const confidenceLabelFor = (score) => {
  if (score >= 70) return 'Élevée';
  if (score >= 50) return 'Moyenne';
  return 'Faible';
};

/** Compute risk:reward from entry/stop/tp1; returns a number or null. */
const computeRR = (entry, stopLoss, tp1) => {
  if (entry == null || stopLoss == null || tp1 == null) return null;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(tp1 - entry);
  if (risk <= 0) return null;
  return reward / risk;
};

/**
 * Build a complete trade plan for a forced direction, anchoring the entry on the
 * live price when available and synthesizing any missing SL/TP from volatility.
 * @param {Object} params
 * @param {'BUY'|'SELL'} params.direction
 * @param {Object} params.setup - candidateSetup (may be null / partial)
 * @param {Object} params.market - market snapshot { quote, candles } (may be null)
 * @param {Object} params.perception
 * @returns {Object} tradePlan
 */
const buildTradePlan = ({ direction, setup, market, perception }) => {
  const livePrice = market?.quote?.price ?? null;
  const candles = market?.candles || [];

  // Entry: prefer the model's proposed entry, else the live price, else the
  // perceived current price.
  const entry =
    setup?.entry ?? livePrice ?? perception?.context?.currentPrice ?? null;

  // Volatility unit for synthesizing levels: ATR from live candles, else a % of
  // the entry price.
  const atr = computeAtr(candles) ?? (entry != null ? entry * PCT_STOP : null);
  const stopDist = atr != null ? atr * ATR_STOP_MULT : null;

  const sign = direction === 'BUY' ? 1 : -1;

  // Stop: keep the model's stop if present, else synthesize from volatility.
  let stopLoss = setup?.stopLoss ?? null;
  if (stopLoss == null && entry != null && stopDist != null) {
    stopLoss = entry - sign * stopDist;
  }

  // Risk distance drives the synthesized targets.
  const risk =
    entry != null && stopLoss != null ? Math.abs(entry - stopLoss) : stopDist;

  const synthTp = (mult) =>
    entry != null && risk != null ? entry + sign * risk * mult : null;

  const takeProfit1 = setup?.takeProfit1 ?? synthTp(RR_TARGETS[0]);
  const takeProfit2 = setup?.takeProfit2 ?? synthTp(RR_TARGETS[1]);
  const takeProfit3 = setup?.takeProfit3 ?? synthTp(RR_TARGETS[2]);

  const rr = computeRR(entry, stopLoss, takeProfit1);
  const timeframe = perception?.context?.timeframe;

  return {
    entry: roundPrice(entry),
    stopLoss: roundPrice(stopLoss),
    takeProfit1: roundPrice(takeProfit1),
    takeProfit2: roundPrice(takeProfit2),
    takeProfit3: roundPrice(takeProfit3),
    riskRewardRatio: rr ? `1:${rr.toFixed(1)}` : null,
    estimatedDuration: durationFor(timeframe),
    estimatedProbability: null, // set by decide() to the confidence score
    tradeType: tradeTypeFor(timeframe),
    waitReason: null, // scanner never waits
  };
};

/**
 * Decide from a reading + perception (+ optional live market snapshot).
 * ALWAYS returns a BUY or SELL with a complete trade plan.
 * @param {Object} params
 * @param {Object} params.reading - parsed TechnicalReading
 * @param {Object} params.perception
 * @param {Object} [params.market] - live snapshot { quote, candles, isRealData }
 * @returns {{ decision: 'BUY'|'SELL', confidenceScore: number, confidenceLabel: string,
 *            tradePlan: Object, confluenceBreakdown: Array, riskZones: Array }}
 */
export const decide = ({ reading, perception, market = null }) => {
  const setup = reading?.candidateSetup || null;

  // 1. Force a direction. Priority: model setup → technical bias → live price
  //    action → last resort BUY (the scanner must always take a side).
  let direction = setup?.direction || null;
  if (!direction) {
    if (reading?.bias === 'bullish') direction = 'BUY';
    else if (reading?.bias === 'bearish') direction = 'SELL';
  }
  if (!direction) direction = directionFromLive(market?.candles);
  if (!direction) direction = 'BUY';

  // 2. Deterministic, explainable confluence score (informative only now).
  const { score, matched } = scoreConfluences(reading, direction);
  const confidenceScore = Math.min(100, Math.max(0, score));
  const confidenceLabel = confidenceLabelFor(confidenceScore);

  // 3. Always-complete trade plan, anchored on the live price when available.
  const tradePlan = buildTradePlan({ direction, setup, market, perception });
  tradePlan.estimatedProbability = confidenceScore;

  const negatives = matched.filter((m) => m.weight < 0);
  const riskZones = negatives.map((m) => ({ label: m.reason, impact: m.weight }));

  return {
    decision: direction,
    confidenceScore,
    confidenceLabel,
    tradePlan,
    confluenceBreakdown: matched,
    riskZones,
  };
};

export default { decide, confidenceLabelFor, MIN_CONFIDENCE, MIN_RR };
