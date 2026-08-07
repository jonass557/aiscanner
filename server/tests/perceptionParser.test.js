import { parsePerceptionResponse, _internals } from '../src/services/vision/perceptionParser.js';

/**
 * Unit tests for the perception parser (Engine 1 contract boundary). Pure logic:
 * confidence clamping, bbox validation to 0-1, color normalization, defensive
 * extraction from noisy model output.
 */
describe('parsePerceptionResponse', () => {
  const base = {
    context: { symbol: 'EURUSD', market: 'forex', timeframe: 'H1', currentPrice: 1.0865, confidence: 80 },
    candles: [
      { bbox: { x: 0.2, y: 0.3, w: 0.05, h: 0.4 }, color: '#26a69a', direction: 'bullish', wickHigh: 1.09, wickLow: 1.08, confidence: 70 },
    ],
    indicators: [{ label: 'EMA 50', value: null, bbox: null, color: 'blue', confidence: 60 }],
    drawnObjects: [{ type: 'support', label: 'S', level: 1.083, confidence: 55 }],
    texts: [{ text: 'EURUSD', bbox: { x: 0, y: 0, w: 0.2, h: 0.05 }, confidence: 90 }],
    psychLevels: [{ level: 1.09, label: 'round', confidence: 50 }],
    volumeVisible: true,
    meta: { imageWidth: 1280, imageHeight: 720 },
  };

  it('parses a clean perception payload', () => {
    const r = parsePerceptionResponse(JSON.stringify(base));
    expect(r.context.symbol).toBe('EURUSD');
    expect(r.context.market).toBe('forex');
    expect(r.candles).toHaveLength(1);
    expect(r.candles[0].direction).toBe('bullish');
    expect(r.volumeVisible).toBe(true);
    expect(r.meta.imageWidth).toBe(1280);
  });

  it('strips markdown fences', () => {
    const raw = '```json\n' + JSON.stringify(base) + '\n```';
    expect(parsePerceptionResponse(raw).context.symbol).toBe('EURUSD');
  });

  it('clamps confidence into 0-100 and defaults to 50 when absent', () => {
    expect(_internals.conf(150)).toBe(100);
    expect(_internals.conf(-20)).toBe(0);
    expect(_internals.conf(undefined)).toBe(50);
    expect(_internals.conf('73')).toBe(73);
  });

  it('rejects invalid bboxes and clamps valid ones', () => {
    expect(_internals.normalizeBbox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
    expect(_internals.normalizeBbox({ x: 'a', y: 0.2, w: 0.3, h: 0.4 })).toBeNull();
    expect(_internals.normalizeBbox({ x: 2, y: -1, w: 0.3, h: 0.4 })).toEqual({ x: 1, y: 0, w: 0.3, h: 0.4 });
    expect(_internals.normalizeBbox(null)).toBeNull();
  });

  it('normalizes colors (hex passthrough, names, shorthand)', () => {
    expect(_internals.normalizeColor('#26a69a')).toBe('#26a69a');
    expect(_internals.normalizeColor('red')).toBe('#ef5350');
    expect(_internals.normalizeColor('#fff')).toBe('#ffffff');
    expect(_internals.normalizeColor('not-a-color')).toBeNull();
  });

  it('defaults unknown market to unknown', () => {
    const r = parsePerceptionResponse(JSON.stringify({ ...base, context: { ...base.context, market: 'stonks' } }));
    expect(r.context.market).toBe('unknown');
  });

  it('drops non-object elements from arrays', () => {
    const r = parsePerceptionResponse(JSON.stringify({ ...base, candles: [base.candles[0], 'garbage', null, 42] }));
    expect(r.candles).toHaveLength(1);
  });

  it('accepts the synthetic (Deriv) market', () => {
    const r = parsePerceptionResponse(JSON.stringify({ ...base, context: { ...base.context, market: 'synthetic' } }));
    expect(r.context.market).toBe('synthetic');
  });

  it('throws on empty / non-JSON input', () => {
    expect(() => parsePerceptionResponse('')).toThrow();
    expect(() => parsePerceptionResponse('nothing here')).toThrow();
  });
});
