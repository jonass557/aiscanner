import crypto from 'crypto';

/**
 * Deterministic offline perception provider. Mirrors the role of
 * ai/MockProvider: with no real API key configured, the whole vision pipeline
 * (including annotations) still runs end-to-end for dev and tests.
 *
 * The output is DERIVED FROM A HASH of the image URL so the same image always
 * yields the same perception (stable snapshots), while different images differ.
 * It returns a raw JSON string, exactly like a real provider's perceive().
 */
export class MockVisionProvider {
  constructor(config) {
    this.config = config;
    this.name = 'mock-vision';
    this.model = 'mock-vision-v1';
  }

  isConfigured() {
    return true;
  }

  // Stable pseudo-random helpers seeded by the image URL.
  _seed(imageUrl) {
    const hash = crypto.createHash('sha256').update(String(imageUrl)).digest();
    let i = 0;
    return () => {
      const byte = hash[i % hash.length];
      i += 1;
      return byte / 255; // 0..1
    };
  }

  _perceptionObject(imageUrl) {
    const rand = this._seed(imageUrl);
    const symbols = ['EURUSD', 'GBPUSD', 'BTCUSD', 'XAUUSD', 'US30'];
    const timeframes = ['M15', 'H1', 'H4', 'D1'];
    const symbol = symbols[Math.floor(rand() * symbols.length)];
    const basePrice = 1 + rand() * 100;

    // Deterministic bias for this image: lean bullish or bearish so the whole
    // pipeline (including the trade-annotation path) is exercised offline.
    const bullishChart = rand() > 0.5;

    const candles = Array.from({ length: 3 }, (_, k) => {
      // Bias the candle colors toward the chart's bias so the derived reading
      // gets a clear (non-neutral) direction most of the time.
      const bullish = rand() > (bullishChart ? 0.3 : 0.7);
      return {
        bbox: { x: 0.2 + k * 0.2, y: 0.3, w: 0.05, h: 0.4 },
        color: bullish ? '#26a69a' : '#ef5350',
        direction: bullish ? 'bullish' : 'bearish',
        bodyHigh: Number((basePrice + rand()).toFixed(4)),
        bodyLow: Number((basePrice - rand()).toFixed(4)),
        wickHigh: Number((basePrice + 1 + rand()).toFixed(4)),
        wickLow: Number((basePrice - 1 - rand()).toFixed(4)),
        confidence: 60 + Math.floor(rand() * 30),
      };
    });

    // A user-drawn rectangle marking an institutional zone (demand if bullish,
    // supply if bearish). Perceived as a plain rectangle; the technical engine
    // interprets it as an order block.
    const zoneLevel = Number((basePrice + (bullishChart ? -1.2 : 1.2)).toFixed(4));

    return {
      context: {
        symbol,
        market: symbol.includes('BTC') ? 'crypto' : 'forex',
        timeframe: timeframes[Math.floor(rand() * timeframes.length)],
        platform: 'MockTrade',
        currentPrice: Number(basePrice.toFixed(4)),
        confidence: 70,
      },
      candles,
      indicators: [
        { label: 'EMA 50', value: null, bbox: { x: 0.1, y: 0.4, w: 0.8, h: 0.02 }, color: '#2196f3', confidence: 65, note: '' },
      ],
      drawnObjects: [
        { type: 'support', label: 'Support', level: Number((basePrice - 2).toFixed(4)), bbox: { x: 0.1, y: 0.7, w: 0.8, h: 0.01 }, color: '#26a69a', confidence: 60, note: '' },
        { type: 'resistance', label: 'Resistance', level: Number((basePrice + 2).toFixed(4)), bbox: { x: 0.1, y: 0.2, w: 0.8, h: 0.01 }, color: '#ef5350', confidence: 60, note: '' },
        { type: 'rectangle', label: bullishChart ? 'Demand zone' : 'Supply zone', level: zoneLevel, bbox: { x: 0.35, y: bullishChart ? 0.6 : 0.28, w: 0.5, h: 0.08 }, color: '#f59e0b', confidence: 62, note: 'Marked zone' },
      ],
      texts: [{ text: symbol, bbox: { x: 0.02, y: 0.02, w: 0.2, h: 0.05 }, confidence: 80 }],
      gaps: [],
      psychLevels: [{ level: Math.round(basePrice), label: 'round number', confidence: 55 }],
      consolidations: [],
      volumeVisible: rand() > 0.5,
      meta: { imageWidth: 1280, imageHeight: 720 },
    };
  }

  async perceive({ imageUrl }) {
    return JSON.stringify(this._perceptionObject(imageUrl));
  }

  async perceiveMultiple({ images }) {
    const first = images?.[0]?.url || 'multi';
    return JSON.stringify(this._perceptionObject(first));
  }
}
