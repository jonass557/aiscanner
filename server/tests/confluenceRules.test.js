import { scoreConfluences, BASE_SCORE } from '../src/services/analysis-engine/confluenceRules.js';

/**
 * Unit tests for the deterministic confluence scoring (Engine 3, part 1).
 * The whole point of this table is reproducibility, so we assert exact scores.
 */

// Minimal reading with all families empty; helpers fill in what a test needs.
const emptyFamilies = () => ({
  bos: [], choch: [], mss: [], higherHighs: [], higherLows: [], lowerHighs: [], lowerLows: [],
  orderBlocks: [], fairValueGaps: [], breakerBlocks: [], mitigationBlocks: [], inverseFvg: [],
  imbalances: [], displacement: [], premiumZones: [], discountZones: [], oteZones: [],
  liquidityZones: [], equalHighs: [], equalLows: [], liquiditySweeps: [], stopHunts: [],
  inducement: [], supportLevels: [], resistanceLevels: [], trendlines: [], channels: [],
  consolidations: [], breakouts: [], fakeBreakouts: [], retests: [], fibonacci: [],
  chartPatterns: [], candlePatterns: [],
});

const reading = (overrides = {}) => ({ bias: 'neutral', families: emptyFamilies(), ...overrides });
const det = (direction = 'neutral') => ({ label: 'x', direction, confidence: 60 });

describe('scoreConfluences', () => {
  it('returns 0 with no direction (nothing to trade)', () => {
    const { score, matched } = scoreConfluences(reading(), null);
    expect(score).toBe(0);
    expect(matched).toHaveLength(0);
  });

  it('is deterministic: same input → same score', () => {
    const r = reading({ families: { ...emptyFamilies(), bos: [det('bullish')], discountZones: [det('bullish')] } });
    const a = scoreConfluences(r, 'BUY');
    const b = scoreConfluences(r, 'BUY');
    expect(a.score).toBe(b.score);
    expect(a.matched.map((m) => m.id)).toEqual(b.matched.map((m) => m.id));
  });

  it('adds BOS aligned (+15) and discount-for-buy (+10) over the base', () => {
    const r = reading({ families: { ...emptyFamilies(), bos: [det('bullish')], discountZones: [det('bullish')] } });
    const { score, matched } = scoreConfluences(r, 'BUY');
    expect(score).toBe(BASE_SCORE + 15 + 10);
    expect(matched.map((m) => m.id)).toEqual(expect.arrayContaining(['bos-aligned', 'discount-for-buy']));
  });

  it('does not credit BOS when it points the other way', () => {
    const r = reading({ families: { ...emptyFamilies(), bos: [det('bearish')] } });
    const { score } = scoreConfluences(r, 'BUY');
    expect(score).toBe(BASE_SCORE); // no aligned rule fired
  });

  it('applies the counter-trend penalty (-10)', () => {
    const r = reading({ bias: 'bearish', families: { ...emptyFamilies(), orderBlocks: [det('bullish')] } });
    const { score, matched } = scoreConfluences(r, 'BUY');
    // +12 order-block aligned, -10 counter-trend → base + 2
    expect(score).toBe(BASE_SCORE + 12 - 10);
    expect(matched.map((m) => m.id)).toContain('counter-trend');
  });

  it('clamps the score to 0-100', () => {
    const many = { ...emptyFamilies() };
    ['bos', 'choch', 'mss', 'orderBlocks', 'discountZones', 'liquiditySweeps', 'displacement'].forEach((k) => {
      many[k] = [det('bullish')];
    });
    const { score } = scoreConfluences(reading({ bias: 'bullish', families: many }), 'BUY');
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
