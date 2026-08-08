import { jest } from '@jest/globals';
import { parseAnalysisResponse } from '../src/services/ai/responseParser.js';

/**
 * Unit tests for the AI response parser. This is pure logic (no DB, no network)
 * and encodes the critical business rule: confidence < 70 => WAIT (never a live
 * BUY/SELL), with the suggested zone kept as `entry`.
 */
describe('parseAnalysisResponse', () => {
  const validPayload = {
    symbol: 'EURUSD',
    market: 'forex',
    timeframe: 'H1',
    broker: 'Unknown',
    currentPrice: 1.0865,
    technicalAnalysis: { marketStructure: 'bullish', momentum: 'strong', volatility: 'medium' },
    decision: 'BUY',
    confidenceScore: 82,
    tradePlan: { entry: 1.084, stopLoss: 1.082, takeProfit1: 1.089 },
    report: { summary: 'ok', confluences: ['a', 'b'] },
  };

  it('parses a clean JSON payload', () => {
    const result = parseAnalysisResponse(JSON.stringify(validPayload));
    expect(result.symbol).toBe('EURUSD');
    expect(result.decision).toBe('BUY');
    expect(result.confidenceScore).toBe(82);
    expect(result.tradePlan.entry).toBe(1.084);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n' + JSON.stringify(validPayload) + '\n```';
    const result = parseAnalysisResponse(raw);
    expect(result.symbol).toBe('EURUSD');
  });

  it('extracts JSON embedded in prose', () => {
    const raw = `Here is the analysis you requested:\n${JSON.stringify(validPayload)}\nHope it helps!`;
    const result = parseAnalysisResponse(raw);
    expect(result.decision).toBe('BUY');
  });

  it('forces WAIT (keeping the suggested zone) when confidence < 70', () => {
    const low = { ...validPayload, decision: 'BUY', confidenceScore: 55 };
    const result = parseAnalysisResponse(JSON.stringify(low));
    expect(result.decision).toBe('WAIT');
    // Suggested zone preserved; live levels nulled.
    expect(result.tradePlan.entry).toBe(1.084);
    expect(result.tradePlan.stopLoss).toBeNull();
    expect(result.tradePlan.riskRewardRatio).toBeNull();
  });

  it('normalizes a legacy NO_TRADE from the model to WAIT', () => {
    const legacy = { ...validPayload, decision: 'NO_TRADE', confidenceScore: 80 };
    const result = parseAnalysisResponse(JSON.stringify(legacy));
    expect(result.decision).toBe('WAIT');
  });

  it('clamps confidence into 0-100', () => {
    const result = parseAnalysisResponse(JSON.stringify({ ...validPayload, confidenceScore: 150 }));
    expect(result.confidenceScore).toBe(100);
  });

  it('defaults invalid market to unknown', () => {
    const result = parseAnalysisResponse(JSON.stringify({ ...validPayload, market: 'stonks' }));
    expect(result.market).toBe('unknown');
  });

  it('normalizes technical-analysis element arrays', () => {
    const payload = {
      ...validPayload,
      technicalAnalysis: {
        ...validPayload.technicalAnalysis,
        orderBlocks: [{ label: 'OB', level: 1.083, note: 'demand', type: 'bullish' }, 'garbage', null],
      },
    };
    const result = parseAnalysisResponse(JSON.stringify(payload));
    expect(result.technicalAnalysis.orderBlocks).toHaveLength(1);
    expect(result.technicalAnalysis.orderBlocks[0].label).toBe('OB');
  });

  it('throws on empty input', () => {
    expect(() => parseAnalysisResponse('')).toThrow();
  });

  it('throws when no JSON present', () => {
    expect(() => parseAnalysisResponse('no json here at all')).toThrow();
  });
});
