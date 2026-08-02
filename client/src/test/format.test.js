import { describe, it, expect } from 'vitest';
import { decisionMeta, confidenceTone, formatPrice, marketLabel } from '../utils/format.js';

/** Unit tests for display-formatting helpers. */
describe('format utils', () => {
  it('maps decisions to labels and tones', () => {
    expect(decisionMeta('BUY').label).toBe('BUY');
    expect(decisionMeta('BUY').tone).toBe('green');
    expect(decisionMeta('SELL').tone).toBe('red');
    expect(decisionMeta('NO_TRADE').label).toBe('NO TRADE');
  });

  it('maps confidence scores to tones', () => {
    expect(confidenceTone(90)).toBe('green');
    expect(confidenceTone(72)).toBe('blue');
    expect(confidenceTone(60)).toBe('yellow');
    expect(confidenceTone(30)).toBe('red');
  });

  it('formats prices and handles null', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(1.0865)).toBe('1.0865');
  });

  it('labels markets', () => {
    expect(marketLabel('forex')).toBe('Forex');
    expect(marketLabel('synthetic')).toBe('Synthetic');
  });
});
