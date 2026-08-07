import { LAYER_BY_ID, SOURCE_LAYER } from './layers.js';

/**
 * Overlay builder (visual report).
 *
 * Produces a flat list of `annotations` — one entry per drawable element — in
 * NORMALIZED coordinates (0-1), so the client renders them at any resolution
 * with no server-side image processing. Each annotation names its layer, shape,
 * coords, color, label and confidence.
 *
 * Two coordinate sources:
 *  1. A perceived `bbox` (0-1) → drawn directly as a rect/zone/label.
 *  2. A price `level` with no bbox → mapped to a horizontal line using a price
 *     axis reconstructed from the perceived candles (see buildPriceScale). This
 *     is what lets us draw entry/SL/TP and S/R lines the model only gave prices
 *     for. If the axis can't be reconstructed, level-only elements are skipped
 *     (we never guess a position).
 */

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * Reconstruct a linear price→normalized-y mapping from perceived candles.
 * Each candle's bbox top corresponds to its highest price (wickHigh) and its
 * bbox bottom to its lowest (wickLow). We fit y = a*price + b by least squares
 * over all such sample points. Returns a clamped priceToY(price) or null.
 */
export const buildPriceScale = (candles) => {
  const pts = [];
  for (const c of candles || []) {
    if (!c?.bbox) continue;
    const top = c.bbox.y;
    const bottom = c.bbox.y + c.bbox.h;
    if (c.wickHigh != null) pts.push([c.wickHigh, top]);
    if (c.wickLow != null) pts.push([c.wickLow, bottom]);
    if (c.wickHigh == null && c.bodyHigh != null) pts.push([c.bodyHigh, top]);
    if (c.wickLow == null && c.bodyLow != null) pts.push([c.bodyLow, bottom]);
  }
  if (pts.length < 2) return null;

  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null; // all prices identical → degenerate
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return (price) => clamp01(a * price + b);
};

const mkColor = (layerId, override) => override || LAYER_BY_ID.get(layerId)?.color || '#888888';

/** Horizontal line annotation spanning the full width at normalized y. */
const hLine = (layerId, y, label, confidence, color) => ({
  layer: layerId,
  shape: 'line',
  coords: { points: [{ x: 0, y }, { x: 1, y }] },
  color: mkColor(layerId, color),
  label,
  confidence: confidence ?? null,
});

/** Rect/zone annotation from a normalized bbox. */
const boxAnn = (layerId, shape, bbox, label, confidence, color) => ({
  layer: layerId,
  shape,
  coords: { bbox },
  color: mkColor(layerId, color),
  label,
  confidence: confidence ?? null,
});

/**
 * Build the annotation list.
 * @param {Object} params
 * @param {Object} params.perception
 * @param {Object} params.reading - parsed TechnicalReading (has .families)
 * @param {Object} params.decision - decisionEngine output (tradePlan)
 * @returns {Array<Object>} annotations
 */
export const build = ({ perception, reading, decision }) => {
  const annotations = [];
  const families = reading?.families || {};
  const priceToY = buildPriceScale(perception?.candles);

  // 1. Detection families → their mapped layers.
  for (const [family, layerId] of Object.entries(SOURCE_LAYER)) {
    const items = families[family];
    if (!Array.isArray(items)) continue;
    const layer = LAYER_BY_ID.get(layerId);
    for (const el of items) {
      if (el.bbox) {
        // Zones/rects drawn from their bounding box.
        const shape = layer?.shape === 'label' ? 'label' : (layer?.shape === 'line' ? 'zone' : layer?.shape || 'rect');
        annotations.push(boxAnn(layerId, shape === 'line' ? 'zone' : shape, el.bbox, el.label, el.confidence, el.color));
      } else if (el.level != null && priceToY) {
        // Level-only → horizontal line at the reconstructed price position.
        annotations.push(hLine(layerId, priceToY(el.level), el.label, el.confidence, el.color));
      }
      // else: no position we can trust → skip (never guess).
    }
  }

  // 2. Trade levels from the decision (entry / SL / TP) as horizontal lines.
  if (decision?.decision !== 'NO_TRADE' && priceToY) {
    const tp = decision.tradePlan || {};
    if (tp.entry != null) annotations.push(hLine('entry', priceToY(tp.entry), `Entry ${tp.entry}`, decision.confidenceScore));
    if (tp.stopLoss != null) annotations.push(hLine('stopLoss', priceToY(tp.stopLoss), `SL ${tp.stopLoss}`, decision.confidenceScore));
    [tp.takeProfit1, tp.takeProfit2, tp.takeProfit3].forEach((v, i) => {
      if (v != null) annotations.push(hLine('takeProfit', priceToY(v), `TP${i + 1} ${v}`, decision.confidenceScore));
    });
  }

  return annotations;
};

export default { build, buildPriceScale };
