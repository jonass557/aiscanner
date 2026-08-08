import { scoreConfluences } from './confluenceRules.js';

/**
 * Engine 3 — Decision.
 *
 * Hybrid + transparent:
 *  1. The candidate direction comes from the TechnicalReading (AI or derived).
 *  2. The confidence score is computed DETERMINISTICALLY by confluenceRules from
 *     the reading — reproducible and explainable.
 *  3. Hard guardrails (mirrored from services/ai/index.js) are enforced here:
 *       - confidence < MIN_CONFIDENCE (70)  => WAIT
 *       - risk:reward  < MIN_RR (1.5)        => WAIT
 *       - no clear direction                 => WAIT
 *     On WAIT the entry is kept as the SUGGESTED zone (so the user knows where
 *     to wait for), stop/targets are nulled, and a `waitReason` explains why the
 *     current price is unfavorable and where/why to wait instead.
 *
 * We deliberately never emit NO_TRADE: a professional read always tells the user
 * where the good zone is and why, rather than a dead-end "no trade". The absolute
 * business rule still holds — never a live entry below 70% confidence.
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
 * Build a professional, pedagogical explanation of why we WAIT and where the
 * user should wait for price. Deterministic — from the reading + why it failed.
 * @param {Object} params
 * @param {Object} params.setup - candidateSetup (may be null)
 * @param {number} params.confidenceScore
 * @param {number|null} params.rr
 * @param {Array} params.negatives - detractor rules that fired
 * @returns {string}
 */
const buildWaitReason = ({ setup, confidenceScore, rr, negatives }) => {
  if (!setup?.direction) {
    return `Aucune zone d'entrée claire pour l'instant : la structure est indécise ` +
      `(confiance ${confidenceScore}%). Attendre qu'un déséquilibre net se forme ` +
      `(order block, FVG, balayage de liquidité) avant d'envisager une position.`;
  }

  const side = setup.direction === 'BUY' ? 'achat' : 'vente';
  const zone = setup.entry != null ? `${setup.entry}` : 'la zone institutionnelle la plus proche';
  const causes = [];
  if (confidenceScore < MIN_CONFIDENCE) {
    causes.push(`la confiance (${confidenceScore}%) est sous le seuil de ${MIN_CONFIDENCE}%`);
  }
  if (rr != null && rr < MIN_RR) {
    causes.push(`le ratio risque/rendement (1:${rr.toFixed(1)}) est sous le minimum de 1:${MIN_RR}`);
  }
  if (negatives.length) {
    causes.push(`facteurs défavorables : ${negatives.map((n) => n.reason).join(' ; ')}`);
  }
  const why = causes.length ? causes.join(' ; ') : 'les confluences ne sont pas encore suffisantes';

  return `Ne pas entrer maintenant en ${side} : ${why}. ` +
    `Attendre que le prix atteigne/confirme la zone ${zone} ` +
    `(retest + réaction), puis réévaluer avant d'exécuter le ${side}.`;
};

/**
 * Decide from a reading + perception.
 * @param {Object} params
 * @param {Object} params.reading - parsed TechnicalReading
 * @param {Object} params.perception
 * @returns {{ decision: 'BUY'|'SELL'|'WAIT', confidenceScore: number, tradePlan: Object,
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

  // A live BUY/SELL requires: a direction, confidence ≥ 70, and RR ≥ 1.5.
  // Anything short of that becomes WAIT (never NO_TRADE) with a suggested zone.
  const tradable =
    Boolean(direction) &&
    confidenceScore >= MIN_CONFIDENCE &&
    (rr == null || rr >= MIN_RR);
  const decision = tradable ? direction : 'WAIT';

  const negatives = matched.filter((m) => m.weight < 0);
  const timeframe = perception?.context?.timeframe;

  const tradePlan = tradable
    ? {
        entry: setup.entry,
        stopLoss: setup.stopLoss,
        takeProfit1: setup.takeProfit1,
        takeProfit2: setup.takeProfit2 ?? null,
        takeProfit3: setup.takeProfit3 ?? null,
        riskRewardRatio: rr ? `1:${rr.toFixed(1)}` : null,
        estimatedDuration: durationFor(timeframe),
        estimatedProbability: confidenceScore,
        tradeType: tradeTypeFor(timeframe),
        waitReason: null,
      }
    : {
        // WAIT: keep `entry` as the SUGGESTED zone (where to wait for), null the
        // rest — the user is not entering yet.
        ...nullPlan(),
        entry: setup?.entry ?? null,
        estimatedProbability: confidenceScore,
        waitReason: buildWaitReason({ setup, confidenceScore, rr, negatives }),
      };

  // Risk zones = detractor rules that fired + explicit reading risks.
  const riskZones = negatives.map((m) => ({ label: m.reason, impact: m.weight }));

  return {
    decision,
    confidenceScore,
    tradePlan,
    confluenceBreakdown: matched,
    riskZones,
  };
};

export default { decide, MIN_CONFIDENCE, MIN_RR };
