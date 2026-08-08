import { decide, MIN_CONFIDENCE, MIN_RR } from '../src/services/analysis-engine/decisionEngine.js';

/**
 * Unit tests for the decision engine (Engine 3). Encodes the product's absolute
 * business rule: no LIVE entry below 70 confidence (or below the RR floor) — but
 * instead of a dead-end NO_TRADE we emit WAIT with a suggested zone + reason.
 */

const emptyFamilies = () => ({
  bos: [], choch: [], mss: [], higherHighs: [], higherLows: [], lowerHighs: [], lowerLows: [],
  orderBlocks: [], fairValueGaps: [], breakerBlocks: [], mitigationBlocks: [], inverseFvg: [],
  imbalances: [], displacement: [], premiumZones: [], discountZones: [], oteZones: [],
  liquidityZones: [], equalHighs: [], equalLows: [], liquiditySweeps: [], stopHunts: [],
  inducement: [], supportLevels: [], resistanceLevels: [], trendlines: [], channels: [],
  consolidations: [], breakouts: [], fakeBreakouts: [], retests: [], fibonacci: [],
  chartPatterns: [], candlePatterns: [],
});

const det = (direction) => ({ label: 'x', direction, confidence: 60 });
const perception = { context: { timeframe: 'H1' } };

// A strong bullish reading (base 50 + 15 BOS + 12 OB + 10 discount = 87 ≥ 70)
// with a healthy RR.
const strongBuyReading = (setup = {}) => ({
  bias: 'bullish',
  modelConfidence: 90,
  families: { ...emptyFamilies(), bos: [det('bullish')], orderBlocks: [det('bullish')], discountZones: [det('bullish')] },
  candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106, ...setup },
});

describe('decisionEngine.decide', () => {
  it('returns a BUY with a plan when confidence ≥ 70 and RR ok', () => {
    const d = decide({ reading: strongBuyReading(), perception });
    expect(d.decision).toBe('BUY');
    expect(d.confidenceScore).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.riskRewardRatio).toBe('1:3.0');
    expect(d.tradePlan.tradeType).toBe('intraday');
    expect(d.tradePlan.waitReason).toBeNull();
  });

  it('forces WAIT (keeping the suggested zone) when confidence < 70', () => {
    const weak = {
      bias: 'bullish', modelConfidence: 99, families: emptyFamilies(),
      candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106 },
    };
    const d = decide({ reading: weak, perception });
    expect(d.confidenceScore).toBeLessThan(MIN_CONFIDENCE);
    expect(d.decision).toBe('WAIT');
    // WAIT keeps entry as the SUGGESTED zone; live levels are nulled.
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.stopLoss).toBeNull();
    expect(d.tradePlan.riskRewardRatio).toBeNull();
    expect(d.tradePlan.waitReason).toBeTruthy();
  });

  it('forces WAIT when RR is below the minimum even if confidence is high', () => {
    // tp1 barely above entry → RR ≈ 0.25 < MIN_RR
    const d = decide({ reading: strongBuyReading({ takeProfit1: 100.5 }), perception });
    expect(d.confidenceScore).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    expect(d.decision).toBe('WAIT');
    expect(d.tradePlan.entry).toBe(100); // suggested zone preserved
    expect(d.tradePlan.waitReason).toMatch(/risque\/rendement|R:R/i);
  });

  it('returns WAIT with no zone when there is no candidate setup', () => {
    const d = decide({
      reading: { bias: 'neutral', families: emptyFamilies(), candidateSetup: null },
      perception,
    });
    expect(d.decision).toBe('WAIT');
    expect(d.confidenceScore).toBe(0);
    expect(d.tradePlan.entry).toBeNull();
    expect(d.tradePlan.waitReason).toBeTruthy();
  });

  it('never returns NO_TRADE (WAIT replaces it)', () => {
    const weak = { bias: 'bullish', families: emptyFamilies(), candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106 } };
    expect(decide({ reading: weak, perception }).decision).not.toBe('NO_TRADE');
    expect(decide({ reading: { families: emptyFamilies(), candidateSetup: null }, perception }).decision).not.toBe('NO_TRADE');
  });

  it('confidence is the pure confluence score (no model blend)', () => {
    // modelConfidence is deliberately ignored; score = 50+15+12+10 = 87.
    const d = decide({ reading: strongBuyReading(), perception });
    expect(d.confidenceScore).toBe(87);
  });

  it('exposes the confluence breakdown and risk zones', () => {
    const withRisk = strongBuyReading();
    withRisk.families.fakeBreakouts = [det('bearish')]; // -12 detractor
    const d = decide({ reading: withRisk, perception });
    expect(d.confluenceBreakdown.length).toBeGreaterThan(0);
    expect(d.riskZones.some((r) => r.impact < 0)).toBe(true);
  });

  it('exposes MIN_CONFIDENCE = 70', () => {
    expect(MIN_CONFIDENCE).toBe(70);
    expect(MIN_RR).toBeLessThanOrEqual(2);
  });
});
