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
const VALID_DECISIONS = ['BUY', 'SELL', 'WAIT', 'NO_TRADE'];
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

  // Enforce the business rule: conflicted or low confluence => WAIT (never a
  // dead-end NO_TRADE). A legacy NO_TRADE from the model is normalized to WAIT.
  const rec = data.recommendation || {};
  let decision = VALID_DECISIONS.includes(rec.decision) ? rec.decision : 'WAIT';
  if (decision === 'NO_TRADE') decision = 'WAIT';
  if (alignmentStatus === 'conflicted' || confluenceScore < 70) decision = 'WAIT';

  const isLive = decision === 'BUY' || decision === 'SELL';
  const suggestedZone = toNumberOrNull(rec.entry);

  // Build a top-down waitReason if the model didn't supply one.
  const fallbackWaitReason = () => {
    const why = alignmentStatus === 'conflicted'
      ? `les timeframes se contredisent (confluence ${confluenceScore}%)`
      : `la confluence multi-timeframe (${confluenceScore}%) est sous le seuil de 70%`;
    const side = dominantBias === 'BUY' ? 'achat' : 'vente';
    const zone = suggestedZone != null ? `la zone ${suggestedZone}` : `une zone alignée sur le biais ${dominantBias}`;
    return `Pas d'entrée confirmée en top-down : ${why}. ` +
      `Attendre que les timeframes s'alignent (biais dominant ${dominantBias}) et que le prix rejoigne ${zone} ` +
      `avant d'envisager un ${side}.`;
  };

  const recommendation = isLive
    ? {
        decision,
        entry: suggestedZone,
        stopLoss: toNumberOrNull(rec.stopLoss),
        takeProfit1: toNumberOrNull(rec.takeProfit1),
        takeProfit2: toNumberOrNull(rec.takeProfit2),
        riskRewardRatio: rec.riskRewardRatio ? String(rec.riskRewardRatio).slice(0, 20) : null,
        reasoning: String(rec.reasoning || '').slice(0, 2000),
        waitReason: null,
      }
    : {
        // WAIT: keep entry as the SUGGESTED zone to wait for; null live levels.
        decision: 'WAIT',
        entry: suggestedZone,
        stopLoss: null,
        takeProfit1: null,
        takeProfit2: null,
        riskRewardRatio: null,
        reasoning: String(rec.reasoning || '').slice(0, 2000),
        waitReason: (rec.waitReason ? String(rec.waitReason).slice(0, 600) : '') || fallbackWaitReason(),
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
