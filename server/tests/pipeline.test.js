import { run, ENGINE_VERSION } from '../src/services/analysis-engine/pipeline.js';
import config from '../src/config/index.js';

/**
 * Integration test: the full CV pipeline (perception → technical → decision →
 * explanation + overlay) with the deterministic mock, exercising the offline
 * path end-to-end. The mock is designed to produce NO_TRADE with weak
 * confluences OR a BUY/SELL when rectangles are present; this test verifies
 * both paths and asserts determinism (same URL → same result).
 */

// Force mock by clearing keys (config is live, not env).
const clearKeys = () => {
  config.ai.openai.apiKey = null;
  config.ai.claude.apiKey = null;
  config.ai.gemini.apiKey = null;
  config.ai.nvidia.apiKey = null;
  config.vision.provider = 'mock';
  config.ai.provider = 'mock';
};

describe('CV pipeline integration (offline mock)', () => {
  beforeEach(() => clearKeys());

  it('runs perception → technical → decision → explanation + overlay', async () => {
    const { analysis, meta } = await run({ imageUrl: 'https://example.com/chart-a.png' });

    // Provenance
    expect(meta.visionProvider).toBe('mock-vision');
    expect(meta.aiProvider).toBe('mock');
    expect(analysis.source).toBe('vision');
    expect(analysis.engineVersion).toBe(ENGINE_VERSION);

    // Header from perception
    expect(analysis.symbol).toBeTruthy();
    expect(['forex', 'crypto', 'unknown']).toContain(analysis.market);
    expect(analysis.timeframe).toBeTruthy();

    // Decision (may be NO_TRADE or BUY/SELL depending on seed)
    expect(['BUY', 'SELL', 'NO_TRADE']).toContain(analysis.decision);
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(analysis.confidenceScore).toBeLessThanOrEqual(100);

    // TradePlan: if NO_TRADE, nulled; else populated.
    if (analysis.decision === 'NO_TRADE') {
      expect(analysis.tradePlan.entry).toBeNull();
    } else {
      expect(analysis.tradePlan.entry).not.toBeNull();
      expect(analysis.tradePlan.riskRewardRatio).toBeTruthy();
    }

    // Report
    expect(analysis.report.summary).toBeTruthy();
    expect(Array.isArray(analysis.report.reasoning)).toBe(true);
    expect(analysis.report.reasoning.length).toBeGreaterThan(0);

    // Perception
    expect(analysis.perception).toBeTruthy();
    expect(Array.isArray(analysis.perception.candles)).toBe(true);

    // Annotations (overlay)
    expect(Array.isArray(analysis.annotations)).toBe(true);
    // At minimum: support/resistance/liquidity from mock perception.
    expect(analysis.annotations.length).toBeGreaterThan(0);
  }, 15000);

  it('is deterministic: same URL → same result', async () => {
    const url = 'https://example.com/determinism-test.png';
    const a = await run({ imageUrl: url });
    const b = await run({ imageUrl: url });

    expect(a.analysis.decision).toBe(b.analysis.decision);
    expect(a.analysis.confidenceScore).toBe(b.analysis.confidenceScore);
    expect(a.analysis.symbol).toBe(b.analysis.symbol);
    expect(a.analysis.tradePlan.entry).toBe(b.analysis.tradePlan.entry);
    expect(a.analysis.annotations.length).toBe(b.analysis.annotations.length);
  }, 15000);

  it('enforces confidence < 70 → NO_TRADE (mock weak setup)', async () => {
    // A fresh URL with no strong confluences → score < 70.
    const { analysis } = await run({ imageUrl: 'https://example.com/weak.png' });
    if (analysis.confidenceScore < 70) {
      expect(analysis.decision).toBe('NO_TRADE');
      expect(analysis.tradePlan.entry).toBeNull();
    }
  }, 15000);

  it('produces entry/SL/TP annotations when decision is BUY/SELL', async () => {
    // Mock is seeded to produce BUY or SELL for most URLs (rectangle → OB).
    const { analysis } = await run({ imageUrl: 'https://example.com/trade.png' });
    if (analysis.decision !== 'NO_TRADE') {
      const layers = analysis.annotations.map((a) => a.layer);
      expect(layers).toContain('entry');
      expect(layers).toContain('stopLoss');
      expect(layers).toContain('takeProfit');
    }
  }, 15000);
});
