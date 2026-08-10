import { normalizeTimeframe, CANONICAL_TIMEFRAMES } from '../src/services/marketData/timeframe.js';

/**
 * Unit tests for timeframe normalization. The vision engine reads whatever label
 * is printed on the chart; this maps all those variants onto the canonical set
 * the market-data providers understand.
 */
describe('normalizeTimeframe', () => {
  it('passes through canonical values (case-insensitive)', () => {
    expect(normalizeTimeframe('M15')).toBe('M15');
    expect(normalizeTimeframe('h4')).toBe('H4');
    expect(normalizeTimeframe('d1')).toBe('D1');
  });

  it('maps common minute variants', () => {
    expect(normalizeTimeframe('15m')).toBe('M15');
    expect(normalizeTimeframe('15min')).toBe('M15');
    expect(normalizeTimeframe('15 min')).toBe('M15');
    expect(normalizeTimeframe('5m')).toBe('M5');
    expect(normalizeTimeframe('30m')).toBe('M30');
  });

  it('maps hour and day variants', () => {
    expect(normalizeTimeframe('1H')).toBe('H1');
    expect(normalizeTimeframe('1h')).toBe('H1');
    expect(normalizeTimeframe('4h')).toBe('H4');
    expect(normalizeTimeframe('4H')).toBe('H4');
    expect(normalizeTimeframe('Daily')).toBe('D1');
    expect(normalizeTimeframe('1d')).toBe('D1');
    expect(normalizeTimeframe('Weekly')).toBe('W1');
  });

  it('maps bare-number (TradingView) minute codes', () => {
    expect(normalizeTimeframe('1')).toBe('M1');
    expect(normalizeTimeframe('5')).toBe('M5');
    expect(normalizeTimeframe('15')).toBe('M15');
    expect(normalizeTimeframe('60')).toBe('H1');
    expect(normalizeTimeframe('240')).toBe('H4');
  });

  it('defaults to H1 on empty/unknown input', () => {
    expect(normalizeTimeframe(null)).toBe('H1');
    expect(normalizeTimeframe('')).toBe('H1');
    expect(normalizeTimeframe('   ')).toBe('H1');
    expect(normalizeTimeframe('gibberish')).toBe('H1');
  });

  it('honors a custom fallback', () => {
    expect(normalizeTimeframe(undefined, 'M5')).toBe('M5');
  });

  it('always returns a canonical value', () => {
    for (const raw of ['15m', '1H', 'Daily', '60', 'weird', '', '3m', '2h']) {
      expect(CANONICAL_TIMEFRAMES).toContain(normalizeTimeframe(raw));
    }
  });
});
