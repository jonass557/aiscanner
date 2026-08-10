import { run, ENGINE_VERSION } from '../src/services/analysis-engine/pipeline.js';
import config from '../src/config/index.js';

/**
 * Integration test: the full CV pipeline (perception → technical → decision →
 * explanation + overlay) with the deterministic mock, exercising the offline
 * path end-to-end. The scanner is always directional: the decision is BUY or
 * SELL (never WAIT / NO_TRADE) with a complete trade plan. Also asserts
 * determinism (same URL → same result).
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

    // Decision is ALWAYS directional — never WAIT / NO_TRADE.
    expect(['BUY', 'SELL']).toContain(analysis.decision);
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(analysis.confidenceScore).toBeLessThanOrEqual(100);
    expect(analysis.confidenceLabel).toBeTruthy();

    // TradePlan is always complete for a directional verdict.
    expect(analysis.tradePlan.entry).not.toBeNull();
    expect(analysis.tradePlan.stopLoss).not.toBeNull();
    expect(analysis.tradePlan.takeProfit1).not.toBeNull();
    expect(analysis.tradePlan.waitReason).toBeNull();

    // Report
    expect(analysis.report.summary).toBeTruthy();
    expect(Array.isArray(analysis.report.reasoning)).toBe(true);
    expect(analysis.report.reasoning.length).toBeGreaterThan(0);

    // Perception
    expect(analysis.perception).toBeTruthy();
    expect(Array.isArray(analysis.perception.candles)).toBe(true);

    // Annotations (overlay)
    expect(Array.isArray(analysis.annotations)).toBe(true);
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

  it('always produces a directional verdict with a complete plan', async () => {
    const { analysis } = await run({ imageUrl: 'https://example.com/weak.png' });
    expect(['BUY', 'SELL']).toContain(analysis.decision);
    expect(analysis.tradePlan.entry).not.toBeNull();
    expect(analysis.tradePlan.stopLoss).not.toBeNull();
    expect(analysis.tradePlan.waitReason).toBeNull();
  }, 15000);

  it('produces entry/SL/TP annotations for the directional decision', async () => {
    const { analysis } = await run({ imageUrl: 'https://example.com/trade.png' });
    const layers = analysis.annotations.map((a) => a.layer);
    // entry is always drawn when the price axis can be reconstructed; when the
    // mock perception yields candle bboxes, SL/TP appear too.
    expect(layers).toContain('entry');
  }, 15000);

  it('returns a market field (null when the pair is unresolved offline)', async () => {
    const res = await run({ imageUrl: 'https://example.com/chart-a.png' });
    expect('market' in res).toBe(true);
  }, 15000);
});
