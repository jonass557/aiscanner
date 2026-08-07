/**
 * Parses and normalizes a raw vision-model response into a validated
 * PerceptionResult. Defensive by design (same philosophy as
 * ai/responseParser.js): extract JSON from possibly-noisy text, then coerce
 * every field, clamp confidence to 0-100, and validate bboxes to 0-1.
 *
 * This is the contract boundary of Engine 1 (Vision). Everything downstream
 * (technical/decision/explanation engines) trusts this shape.
 */

import { extractJson } from '../ai/responseParser.js';

const VALID_MARKETS = [
  'forex', 'crypto', 'indices', 'commodities', 'stocks', 'synthetic', 'unknown',
];
const VALID_DIRECTIONS = ['bullish', 'bearish', 'doji', 'unknown'];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Confidence coerced to an int in [0,100]; defaults to 50 when absent. */
const conf = (v) => {
  const n = toNumberOrNull(v);
  if (n === null) return 50;
  return clamp(Math.round(n), 0, 100);
};

/**
 * Validate a bbox: must be an object with 4 finite numbers in [0,1]. Returns a
 * clamped copy, or null if invalid/absent.
 */
const normalizeBbox = (b) => {
  if (!b || typeof b !== 'object') return null;
  const x = toNumberOrNull(b.x);
  const y = toNumberOrNull(b.y);
  const w = toNumberOrNull(b.w);
  const h = toNumberOrNull(b.h);
  if ([x, y, w, h].some((v) => v === null)) return null;
  return {
    x: clamp(x, 0, 1), y: clamp(y, 0, 1),
    w: clamp(w, 0, 1), h: clamp(h, 0, 1),
  };
};

/** Normalize a color to hex or null. Accepts "#rrggbb" or common names. */
const NAMED_COLORS = {
  red: '#ef5350', green: '#26a69a', blue: '#2196f3', yellow: '#ffeb3b',
  orange: '#ff9800', purple: '#9c27b0', white: '#ffffff', black: '#000000',
  gray: '#9e9e9e', grey: '#9e9e9e',
};
const normalizeColor = (c) => {
  if (typeof c !== 'string') return null;
  const s = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return NAMED_COLORS[s] || null;
};

const str = (v, max) => String(v ?? '').slice(0, max);

const normalizeCandle = (c) => ({
  bbox: normalizeBbox(c.bbox),
  color: normalizeColor(c.color),
  direction: VALID_DIRECTIONS.includes(c.direction) ? c.direction : 'unknown',
  bodyHigh: toNumberOrNull(c.bodyHigh),
  bodyLow: toNumberOrNull(c.bodyLow),
  wickHigh: toNumberOrNull(c.wickHigh),
  wickLow: toNumberOrNull(c.wickLow),
  confidence: conf(c.confidence),
});

const normalizeIndicator = (el) => ({
  label: str(el.label ?? el.name, 200),
  value: el.value === null || el.value === undefined ? null : str(el.value, 200),
  bbox: normalizeBbox(el.bbox),
  color: normalizeColor(el.color),
  confidence: conf(el.confidence),
  note: str(el.note, 500),
});

const normalizeDrawnObject = (el) => ({
  type: str(el.type, 50) || 'other',
  label: str(el.label, 200),
  level: toNumberOrNull(el.level),
  bbox: normalizeBbox(el.bbox),
  color: normalizeColor(el.color),
  confidence: conf(el.confidence),
  note: str(el.note, 500),
});

const normalizeText = (el) => ({
  text: str(el.text, 500),
  bbox: normalizeBbox(el.bbox),
  confidence: conf(el.confidence),
});

const mapArray = (arr, fn) =>
  Array.isArray(arr) ? arr.filter((el) => el && typeof el === 'object').map(fn) : [];

/**
 * Main entry: raw model text -> clean, validated PerceptionResult.
 */
export const parsePerceptionResponse = (raw) => {
  const data = extractJson(raw);
  const ctx = data.context || {};
  const meta = data.meta || {};

  return {
    context: {
      symbol: ctx.symbol ? str(ctx.symbol, 50) : null,
      market: VALID_MARKETS.includes(ctx.market) ? ctx.market : 'unknown',
      timeframe: ctx.timeframe ? str(ctx.timeframe, 20) : null,
      platform: ctx.platform ? str(ctx.platform, 60) : null,
      currentPrice: toNumberOrNull(ctx.currentPrice),
      confidence: conf(ctx.confidence),
    },
    candles: mapArray(data.candles, normalizeCandle),
    indicators: mapArray(data.indicators, normalizeIndicator),
    drawnObjects: mapArray(data.drawnObjects, normalizeDrawnObject),
    texts: mapArray(data.texts, normalizeText),
    gaps: mapArray(data.gaps, normalizeDrawnObject),
    psychLevels: mapArray(data.psychLevels, (el) => ({
      level: toNumberOrNull(el.level),
      label: str(el.label, 100),
      confidence: conf(el.confidence),
    })),
    consolidations: mapArray(data.consolidations, normalizeDrawnObject),
    volumeVisible: Boolean(data.volumeVisible),
    meta: {
      imageWidth: toNumberOrNull(meta.imageWidth),
      imageHeight: toNumberOrNull(meta.imageHeight),
    },
  };
};

// Exposed for unit tests.
export const _internals = { normalizeBbox, normalizeColor, conf };
