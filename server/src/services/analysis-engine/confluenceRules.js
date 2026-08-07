/**
 * Deterministic confluence scoring (Engine 3, part 1).
 *
 * The decision engine is HYBRID: the AI proposes levels and a direction, but
 * the confidence score is computed here from a reproducible weighted table over
 * the TechnicalReading. Same reading in → same score out, every time. This is
 * what makes the decision explainable ("+15 BOS aligned, +10 FVG in discount,
 * -20 conflicting signals") instead of an opaque model number.
 *
 * Each rule inspects the reading and, if its condition holds, contributes a
 * signed weight plus a human-readable reason. Weights are intentionally modest
 * so no single factor dominates; the sum is clamped to 0-100.
 */

const has = (family) => Array.isArray(family) && family.length > 0;
const count = (family) => (Array.isArray(family) ? family.length : 0);

/**
 * Whether a family contains a detection whose direction matches the candidate
 * setup direction ('BUY' → 'bullish', 'SELL' → 'bearish').
 */
const alignsWith = (family, direction) => {
  if (!Array.isArray(family) || !direction) return false;
  const want = direction === 'BUY' ? 'bullish' : 'bearish';
  return family.some((d) => d.direction === want);
};

/**
 * The weighted rule table. Order is irrelevant (sum is commutative); each entry
 * is { id, when(reading, dir) → bool, weight, reason }.
 *
 * Positive weights = confluences supporting a trade; negative = detractors that
 * lower confidence (and can push it under the 70 NO_TRADE threshold).
 */
export const RULES = [
  // --- Structure confluences ------------------------------------------------
  {
    id: 'bos-aligned',
    when: (r, dir) => alignsWith(r.families.bos, dir),
    weight: 15,
    reason: 'Break of Structure aligned with the trade direction',
  },
  {
    id: 'choch-aligned',
    when: (r, dir) => alignsWith(r.families.choch, dir),
    weight: 12,
    reason: 'Change of Character confirms a shift in the trade direction',
  },
  {
    id: 'mss-aligned',
    when: (r, dir) => alignsWith(r.families.mss, dir),
    weight: 10,
    reason: 'Market Structure Shift supports the direction',
  },
  {
    id: 'displacement',
    when: (r) => has(r.families.displacement),
    weight: 8,
    reason: 'Displacement (strong impulsive move) present',
  },

  // --- Institutional zones --------------------------------------------------
  {
    id: 'order-block',
    when: (r, dir) => alignsWith(r.families.orderBlocks, dir),
    weight: 12,
    reason: 'Entry aligned with an order block in the trade direction',
  },
  {
    id: 'fvg',
    when: (r) => has(r.families.fairValueGaps) || has(r.families.inverseFvg),
    weight: 8,
    reason: 'Fair Value Gap / imbalance offers a clean entry region',
  },
  {
    id: 'breaker',
    when: (r) => has(r.families.breakerBlocks) || has(r.families.mitigationBlocks),
    weight: 6,
    reason: 'Breaker / mitigation block reinforces the zone',
  },

  // --- Premium / discount ---------------------------------------------------
  {
    id: 'discount-for-buy',
    when: (r, dir) => dir === 'BUY' && has(r.families.discountZones),
    weight: 10,
    reason: 'Buy entry located in a discount zone (favorable pricing)',
  },
  {
    id: 'premium-for-sell',
    when: (r, dir) => dir === 'SELL' && has(r.families.premiumZones),
    weight: 10,
    reason: 'Sell entry located in a premium zone (favorable pricing)',
  },
  {
    id: 'ote',
    when: (r) => has(r.families.oteZones),
    weight: 6,
    reason: 'Price within the Optimal Trade Entry (0.62–0.79) zone',
  },

  // --- Liquidity ------------------------------------------------------------
  {
    id: 'liquidity-sweep',
    when: (r) => has(r.families.liquiditySweeps) || has(r.families.stopHunts),
    weight: 10,
    reason: 'Liquidity sweep / stop hunt preceded the setup',
  },
  {
    id: 'liquidity-target',
    when: (r) => has(r.families.liquidityZones) || has(r.families.equalHighs) || has(r.families.equalLows),
    weight: 6,
    reason: 'Clear liquidity pool available as a logical target',
  },
  {
    id: 'inducement',
    when: (r) => has(r.families.inducement),
    weight: 4,
    reason: 'Inducement identified before the point of interest',
  },

  // --- Classic confirmations ------------------------------------------------
  {
    id: 'sr-confluence',
    when: (r) => has(r.families.supportLevels) || has(r.families.resistanceLevels),
    weight: 5,
    reason: 'Support/resistance confluence at the level',
  },
  {
    id: 'pattern',
    when: (r) => has(r.families.chartPatterns) || has(r.families.candlePatterns),
    weight: 5,
    reason: 'Chart / candlestick pattern supports the setup',
  },
  {
    id: 'retest',
    when: (r) => has(r.families.retests),
    weight: 4,
    reason: 'Level was retested and held',
  },

  // --- Detractors -----------------------------------------------------------
  {
    id: 'fake-breakout',
    when: (r) => has(r.families.fakeBreakouts),
    weight: -12,
    reason: 'Fake breakout detected — momentum unreliable',
  },
  {
    id: 'consolidation',
    when: (r) => has(r.families.consolidations) && !has(r.families.breakouts),
    weight: -8,
    reason: 'Price is consolidating without a breakout — low momentum',
  },
  {
    id: 'counter-trend',
    when: (r, dir) =>
      (dir === 'BUY' && r.bias === 'bearish') || (dir === 'SELL' && r.bias === 'bullish'),
    weight: -20,
    reason: 'Setup is counter to the dominant market bias',
  },
  {
    id: 'conflicting-signals',
    when: (r) =>
      (has(r.families.bos) && has(r.families.choch)) &&
      count(r.families.fakeBreakouts) > 0,
    weight: -10,
    reason: 'Conflicting structure signals reduce reliability',
  },
];

/** Base score every setup starts from before confluences are applied. */
export const BASE_SCORE = 40;

/**
 * Compute a deterministic confluence score for a reading + candidate direction.
 * @param {Object} reading - a parsed TechnicalReading
 * @param {'BUY'|'SELL'|null} direction
 * @returns {{ score: number, matched: Array<{id,weight,reason}>, direction: string|null }}
 */
export const scoreConfluences = (reading, direction) => {
  if (!direction) {
    return { score: 0, matched: [], direction: null };
  }
  let score = BASE_SCORE;
  const matched = [];
  for (const rule of RULES) {
    let ok = false;
    try {
      ok = Boolean(rule.when(reading, direction));
    } catch {
      ok = false;
    }
    if (ok) {
      score += rule.weight;
      matched.push({ id: rule.id, weight: rule.weight, reason: rule.reason });
    }
  }
  score = Math.min(100, Math.max(0, Math.round(score)));
  return { score, matched, direction };
};

export default { RULES, BASE_SCORE, scoreConfluences };
