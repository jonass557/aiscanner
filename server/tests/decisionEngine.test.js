import { decide, MIN_CONFIDENCE, MIN_RR } from '../src/services/analysis-engine/decisionEngine.js';

/**
 * Unit tests for the decision engine (Engine 3). Encodes the product's absolute
 * business rule: confidence < 70 => NO_TRADE, plus the RR guardrail, plus the
 * tradePlan being nulled on NO_TRADE.
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

// A strong bullish reading (score 40 + 15 + 12 + 10 = 77 ≥ 70) with a healthy RR.
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
  });

  it('forces NO_TRADE when confidence < 70 (no confluences)', () => {
    const weak = {
      bias: 'bullish', modelConfidence: 99, families: emptyFamilies(),
      candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106 },
    };
    const d = decide({ reading: weak, perception });
    expect(d.confidenceScore).toBeLessThan(MIN_CONFIDENCE);
    expect(d.decision).toBe('NO_TRADE');
    expect(d.tradePlan.entry).toBeNull();
    expect(d.tradePlan.riskRewardRatio).toBeNull();
  });

  it('forces NO_TRADE when RR is below the minimum even if confidence is high', () => {
    // tp1 barely above entry → RR ≈ 0.25 < MIN_RR
    const d = decide({ reading: strongBuyReading({ takeProfit1: 100.5 }), perception });
    expect(d.confidenceScore).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    expect(d.decision).toBe('NO_TRADE');
    expect(d.tradePlan.entry).toBeNull();
  });

  it('returns NO_TRADE when there is no candidate setup', () => {
    const d = decide({
      reading: { bias: 'neutral', families: emptyFamilies(), candidateSetup: null },
      perception,
    });
    expect(d.decision).toBe('NO_TRADE');
    expect(d.confidenceScore).toBe(0);
  });

  it('confidence is the pure confluence score (no model blend)', () => {
    // modelConfidence is deliberately ignored; score = 40+15+12+10 = 77.
    const d = decide({ reading: strongBuyReading(), perception });
    expect(d.confidenceScore).toBe(77);
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
