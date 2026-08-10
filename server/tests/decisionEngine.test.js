import { decide, confidenceLabelFor } from '../src/services/analysis-engine/decisionEngine.js';

/**
 * Unit tests for the decision engine (Engine 3).
 *
 * New product rule: the scanner is ALWAYS directional — it returns BUY or SELL
 * with a complete trade plan, never WAIT or NO_TRADE. The confidence score is
 * informative (it no longer gates the verdict). Levels are anchored on the live
 * price when a market snapshot is provided, and synthesized from volatility
 * (ATR) otherwise.
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
const perception = { context: { timeframe: 'H1', currentPrice: 100 } };

const strongBuyReading = (setup = {}) => ({
  bias: 'bullish',
  modelConfidence: 90,
  families: { ...emptyFamilies(), bos: [det('bullish')], orderBlocks: [det('bullish')], discountZones: [det('bullish')] },
  candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106, ...setup },
});

describe('decisionEngine.decide', () => {
  it('returns a BUY with a complete plan when the setup is bullish', () => {
    const d = decide({ reading: strongBuyReading(), perception });
    expect(d.decision).toBe('BUY');
    expect(d.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.riskRewardRatio).toBe('1:3.0');
    expect(d.tradePlan.tradeType).toBe('intraday');
    expect(d.tradePlan.waitReason).toBeNull();
  });

  it('stays directional (BUY) with a full plan even on low confidence', () => {
    const weak = {
      bias: 'bullish', modelConfidence: 99, families: emptyFamilies(),
      candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106 },
    };
    const d = decide({ reading: weak, perception });
    expect(d.confidenceScore).toBeLessThan(70);
    expect(d.decision).toBe('BUY');
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.stopLoss).toBe(98);
    expect(d.tradePlan.takeProfit1).toBe(106);
    expect(d.tradePlan.waitReason).toBeNull();
  });

  it('keeps a low-RR setup directional (RR no longer gates)', () => {
    const d = decide({ reading: strongBuyReading({ takeProfit1: 100.5 }), perception });
    expect(d.decision).toBe('BUY');
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.riskRewardRatio).toBeTruthy();
  });

  it('derives a direction from bias when there is no candidate setup', () => {
    const d = decide({
      reading: { bias: 'bearish', families: emptyFamilies(), candidateSetup: null },
      perception,
    });
    expect(d.decision).toBe('SELL');
    expect(d.tradePlan.entry).toBe(100);
    expect(d.tradePlan.stopLoss).not.toBeNull();
    expect(d.tradePlan.takeProfit1).not.toBeNull();
  });

  it('derives a direction from live candles when bias is neutral', () => {
    const candles = [
      { open: 90, high: 91, low: 89, close: 90 },
      { open: 92, high: 96, low: 91, close: 95 },
      { open: 95, high: 99, low: 94, close: 98 },
    ];
    const d = decide({
      reading: { bias: 'neutral', families: emptyFamilies(), candidateSetup: null },
      perception: { context: { timeframe: 'H1' } },
      market: { quote: { price: 98 }, candles, isRealData: true, source: 'binance' },
    });
    expect(d.decision).toBe('BUY');
    expect(d.tradePlan.entry).toBe(98);
    expect(d.tradePlan.stopLoss).not.toBeNull();
  });

  it('NEVER returns WAIT or NO_TRADE (always BUY or SELL)', () => {
    const cases = [
      { bias: 'bullish', families: emptyFamilies(), candidateSetup: { direction: 'BUY', entry: 100, stopLoss: 98, takeProfit1: 106 } },
      { bias: 'neutral', families: emptyFamilies(), candidateSetup: null },
      { bias: 'bearish', families: emptyFamilies(), candidateSetup: null },
      { families: emptyFamilies(), candidateSetup: null },
    ];
    for (const reading of cases) {
      const d = decide({ reading, perception });
      expect(['BUY', 'SELL']).toContain(d.decision);
      expect(d.decision).not.toBe('WAIT');
      expect(d.decision).not.toBe('NO_TRADE');
    }
  });

  it('synthesizes SL/TP from ATR when the setup omits them', () => {
    const candles = Array.from({ length: 14 }, () => ({ open: 100, high: 102, low: 98, close: 100 }));
    const reading = {
      bias: 'bullish', families: emptyFamilies(),
      candidateSetup: { direction: 'BUY', entry: 100 },
    };
    const d = decide({
      reading, perception,
      market: { quote: { price: 100 }, candles, isRealData: true, source: 'binance' },
    });
    expect(d.decision).toBe('BUY');
    expect(d.tradePlan.stopLoss).toBeLessThan(100);
    expect(d.tradePlan.takeProfit1).toBeGreaterThan(100);
  });

  it('confidence is the pure confluence score and exposes a label', () => {
    const d = decide({ reading: strongBuyReading(), perception });
    expect(d.confidenceScore).toBe(87);
    expect(d.confidenceLabel).toBe('Élevée');
  });

  it('exposes the confluence breakdown and risk zones', () => {
    const withRisk = strongBuyReading();
    withRisk.families.fakeBreakouts = [det('bearish')];
    const d = decide({ reading: withRisk, perception });
    expect(d.confluenceBreakdown.length).toBeGreaterThan(0);
    expect(d.riskZones.some((r) => r.impact < 0)).toBe(true);
  });

  it('confidenceLabelFor maps score ranges', () => {
    expect(confidenceLabelFor(85)).toBe('Élevée');
    expect(confidenceLabelFor(60)).toBe('Moyenne');
    expect(confidenceLabelFor(30)).toBe('Faible');
  });
});
