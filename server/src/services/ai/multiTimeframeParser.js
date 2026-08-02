/**
 * Parses and normalizes the raw model response for the Multi-Timeframe
 * Analyzer into a validated object matching the MultiTimeframeAnalysis schema.
 * Defensive like responseParser.js: models occasionally wrap JSON in fences or
 * drift from the schema, so every field is coerced/clamped to a safe value.
 */
import { extractJson } from './responseParser.js';

const VALID_MARKETS = ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'];
const VALID_TRENDS = ['bullish', 'bearish', 'ranging'];
const VALID_BIAS = ['BUY', 'SELL', 'NEUTRAL'];
const VALID_DECISIONS = ['BUY', 'SELL', 'NO_TRADE'];
const VALID_ALIGNMENT = ['aligned', 'partial', 'conflicted'];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeLevels = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((el) => el && typeof el === 'object')
    .slice(0, 20)
    .map((el) => ({
      label: String(el.label ?? el.name ?? '').slice(0, 200),
      level: el.level ?? null,
      note: String(el.note ?? el.description ?? '').slice(0, 500),
      type: String(el.type ?? '').slice(0, 50),
    }));
};

/**
 * Main entry: raw model text -> clean, schema-shaped multi-timeframe object.
 */
export const parseMultiTimeframeResponse = (raw) => {
  const data = extractJson(raw);

  const timeframes = (Array.isArray(data.timeframes) ? data.timeframes : [])
    .filter((t) => t && typeof t === 'object')
    .slice(0, 12)
    .map((t) => ({
      timeframe: String(t.timeframe || 'Unknown').slice(0, 20),
      trend: VALID_TRENDS.includes(t.trend) ? t.trend : 'ranging',
      marketStructure: String(t.marketStructure || '').slice(0, 2000),
      keyLevels: normalizeLevels(t.keyLevels),
      bias: VALID_BIAS.includes(t.bias) ? t.bias : 'NEUTRAL',
    }));

  const alignmentStatus = VALID_ALIGNMENT.includes(data.alignmentStatus)
    ? data.alignmentStatus
    : 'partial';

  let confluenceScore = clamp(Math.round(toNumberOrNull(data.confluenceScore) ?? 0), 0, 100);

  const dominantBias = ['BUY', 'SELL'].includes(data.dominantBias) ? data.dominantBias : 'BUY';

  const conflicts = (Array.isArray(data.conflicts) ? data.conflicts : [])
    .filter((c) => c && typeof c === 'object')
    .slice(0, 20)
    .map((c) => ({
      tf1: String(c.tf1 || '').slice(0, 20),
      tf2: String(c.tf2 || '').slice(0, 20),
      description: String(c.description || '').slice(0, 500),
    }));

  // Enforce the business rule: conflicted or low confluence => NO_TRADE.
  const rec = data.recommendation || {};
  let decision = VALID_DECISIONS.includes(rec.decision) ? rec.decision : 'NO_TRADE';
  if (alignmentStatus === 'conflicted' || confluenceScore < 70) decision = 'NO_TRADE';

  const recommendation =
    decision === 'NO_TRADE'
      ? {
          decision: 'NO_TRADE',
          entry: null,
          stopLoss: null,
          takeProfit1: null,
          takeProfit2: null,
          riskRewardRatio: null,
          reasoning: String(rec.reasoning || '').slice(0, 2000),
        }
      : {
          decision,
          entry: toNumberOrNull(rec.entry),
          stopLoss: toNumberOrNull(rec.stopLoss),
          takeProfit1: toNumberOrNull(rec.takeProfit1),
          takeProfit2: toNumberOrNull(rec.takeProfit2),
          riskRewardRatio: rec.riskRewardRatio ? String(rec.riskRewardRatio).slice(0, 20) : null,
          reasoning: String(rec.reasoning || '').slice(0, 2000),
        };

  const market = VALID_MARKETS.includes(data.market) ? data.market : 'unknown';

  return {
    symbol: String(data.symbol || 'Unknown').slice(0, 50),
    market,
    broker: String(data.broker || 'Unknown').slice(0, 50),
    currentPrice: toNumberOrNull(data.currentPrice),
    timeframes,
    alignmentStatus,
    confluenceScore,
    dominantBias,
    conflicts,
    recommendation,
    summary: String(data.summary || '').slice(0, 3000),
  };
};
