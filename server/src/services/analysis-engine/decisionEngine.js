import { scoreConfluences } from './confluenceRules.js';

/**
 * Engine 3 — Decision.
 *
 * Hybrid + transparent:
 *  1. The candidate direction comes from the TechnicalReading (AI or derived).
 *  2. The confidence score is computed DETERMINISTICALLY by confluenceRules from
 *     the reading — reproducible and explainable.
 *  3. Hard guardrails (mirrored from services/ai/index.js) are enforced here:
 *       - confidence < MIN_CONFIDENCE (70)  => NO_TRADE
 *       - risk:reward  < MIN_RR (1.5)        => NO_TRADE
 *     On NO_TRADE the tradePlan is nulled out so the app never overpromises.
 *
 * The absolute business rule of the whole product lives here: never a trade
 * below 70% confidence.
 */

export const MIN_CONFIDENCE = 70;
export const MIN_RR = 1.5;

const nullPlan = () => ({
  entry: null, stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
  riskRewardRatio: null, estimatedDuration: null, estimatedProbability: null, tradeType: null,
});

/** Compute risk:reward from entry/stop/tp1; returns a number or null. */
const computeRR = (entry, stopLoss, tp1) => {
  if (entry == null || stopLoss == null || tp1 == null) return null;
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(tp1 - entry);
  if (risk <= 0) return null;
  return reward / risk;
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

/**
 * Decide from a reading + perception.
 * @param {Object} params
 * @param {Object} params.reading - parsed TechnicalReading
 * @param {Object} params.perception
 * @returns {{ decision: 'BUY'|'SELL'|'NO_TRADE', confidenceScore: number, tradePlan: Object,
 *            confluenceBreakdown: Array, riskZones: Array }}
 */
export const decide = ({ reading, perception }) => {
  const setup = reading?.candidateSetup || null;
  const direction = setup?.direction || null;

  const { score, matched } = scoreConfluences(reading, direction);

  // The confidence score IS the deterministic confluence score — reproducible
  // and fully explainable from `matched`. We deliberately do NOT blend in the
  // model's self-reported confidence: the whole point of the confluence table
  // is a transparent, non-opaque number the user can audit rule by rule. The
  // model's job is to propose the DIRECTION and the LEVELS, not the score.
  const confidenceScore = Math.min(100, Math.max(0, score));

  const rr = setup ? computeRR(setup.entry, setup.stopLoss, setup.takeProfit1) : null;

  // Guardrails → NO_TRADE.
  let decision = direction || 'NO_TRADE';
  if (!direction) decision = 'NO_TRADE';
  if (confidenceScore < MIN_CONFIDENCE) decision = 'NO_TRADE';
  if (rr != null && rr < MIN_RR) decision = 'NO_TRADE';

  const timeframe = perception?.context?.timeframe;
  const tradePlan =
    decision === 'NO_TRADE'
      ? nullPlan()
      : {
          entry: setup.entry,
          stopLoss: setup.stopLoss,
          takeProfit1: setup.takeProfit1,
          takeProfit2: setup.takeProfit2 ?? null,
          takeProfit3: setup.takeProfit3 ?? null,
          riskRewardRatio: rr ? `1:${rr.toFixed(1)}` : null,
          estimatedDuration: durationFor(timeframe),
          estimatedProbability: confidenceScore,
          tradeType: tradeTypeFor(timeframe),
        };

  // Risk zones = detractor rules that fired + explicit reading risks.
  const riskZones = matched
    .filter((m) => m.weight < 0)
    .map((m) => ({ label: m.reason, impact: m.weight }));

  return {
    decision,
    confidenceScore,
    tradePlan,
    confluenceBreakdown: matched,
    riskZones,
  };
};

export default { decide, MIN_CONFIDENCE, MIN_RR };
