/**
 * Parses + normalizes a raw technical-reading response (Engine 2) into a stable
 * TechnicalReading contract, and provides a deterministic offline fallback.
 *
 * Same defensive philosophy as ai/responseParser.js and vision/perceptionParser
 * .js: extract JSON from noisy text, coerce every field, clamp confidence to
 * 0-100, validate bboxes. Everything downstream (confluence, decision,
 * explanation, overlay) trusts this shape.
 */

import { extractJson } from '../ai/responseParser.js';

/**
 * The full set of detection families that map 1:1 into
 * Analysis.technicalAnalysis. Existing families are kept; the plan's advanced
 * SMC/ICT families are appended. Parser, engine, overlay and the Mongoose
 * schema all read from this single list so they never drift apart.
 */
export const FAMILY_KEYS = [
  // Structure
  'bos', 'choch', 'mss',
  'higherHighs', 'higherLows', 'lowerHighs', 'lowerLows',
  // Institutional zones
  'orderBlocks', 'fairValueGaps', 'breakerBlocks', 'mitigationBlocks',
  'inverseFvg', 'imbalances', 'displacement',
  // Premium / discount
  'premiumZones', 'discountZones', 'oteZones',
  // Liquidity
  'liquidityZones', 'equalHighs', 'equalLows',
  'liquiditySweeps', 'stopHunts', 'inducement',
  // Classic
  'supportLevels', 'resistanceLevels', 'trendlines', 'channels',
  'consolidations', 'breakouts', 'fakeBreakouts', 'retests', 'fibonacci',
  // Patterns
  'chartPatterns', 'candlePatterns',
];

const VALID_BIAS = ['bullish', 'bearish', 'neutral'];
const VALID_DIRECTIONS = ['bullish', 'bearish', 'neutral'];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const conf = (v) => {
  const n = toNumberOrNull(v);
  if (n === null) return 50;
  return clamp(Math.round(n), 0, 100);
};

const str = (v, max) => String(v ?? '').slice(0, max);

const normalizeBbox = (b) => {
  if (!b || typeof b !== 'object') return null;
  const nums = ['x', 'y', 'w', 'h'].map((k) => toNumberOrNull(b[k]));
  if (nums.some((v) => v === null)) return null;
  const [x, y, w, h] = nums.map((v) => clamp(v, 0, 1));
  return { x, y, w, h };
};

const normalizeStringArray = (arr, max = 500) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, max));
};

/**
 * A single detection: label + optional price/level + a direction + confidence +
 * optional bbox + evidence (references back to perceived elements).
 */
const normalizeDetection = (el) => ({
  label: str(el.label ?? el.name, 200),
  level: toNumberOrNull(el.level),
  note: str(el.note ?? el.description, 500),
  type: str(el.type, 50),
  direction: VALID_DIRECTIONS.includes(el.direction) ? el.direction : 'neutral',
  confidence: conf(el.confidence),
  bbox: normalizeBbox(el.bbox),
  evidence: normalizeStringArray(el.evidence, 200),
});

const mapDetections = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((el) => el && typeof el === 'object')
    .map(normalizeDetection);

const normalizeSetup = (s) => {
  if (!s || typeof s !== 'object') return null;
  const direction = s.direction === 'BUY' || s.direction === 'SELL' ? s.direction : null;
  if (!direction) return null;
  return {
    direction,
    entry: toNumberOrNull(s.entry),
    stopLoss: toNumberOrNull(s.stopLoss),
    takeProfit1: toNumberOrNull(s.takeProfit1),
    takeProfit2: toNumberOrNull(s.takeProfit2),
    takeProfit3: toNumberOrNull(s.takeProfit3),
    rationale: str(s.rationale, 800),
  };
};

/**
 * Main entry: raw model text -> clean TechnicalReading.
 * @param {string} raw
 * @returns {Object} reading
 */
export const parseTechnicalReading = (raw) => {
  const data = extractJson(raw);
  const det = data.detections || data.technicalAnalysis || {};

  const families = {};
  for (const key of FAMILY_KEYS) families[key] = mapDetections(det[key]);

  return {
    marketStructure: str(data.marketStructure ?? det.marketStructure, 2000),
    momentum: str(data.momentum ?? det.momentum, 1000),
    volatility: str(data.volatility ?? det.volatility, 1000),
    bias: VALID_BIAS.includes(data.bias) ? data.bias : 'neutral',
    modelConfidence: conf(data.modelConfidence ?? data.confidenceScore),
    candidateSetup: normalizeSetup(data.candidateSetup),
    confluences: normalizeStringArray(data.confluences),
    risks: normalizeStringArray(data.risks),
    weaknesses: normalizeStringArray(data.weaknesses),
    missingElements: normalizeStringArray(data.missingElements),
    families,
  };
};

// Exposed for unit tests.
export const _internals = { normalizeDetection, normalizeSetup, conf, normalizeBbox };
