/**
 * Parses and normalizes the raw model response into a validated analysis
 * object matching the Analysis schema. Defensive by design: models
 * occasionally wrap JSON in markdown fences or add stray prose, so we
 * extract the JSON, then coerce/clamp every field to safe values.
 */

const VALID_MARKETS = ['forex', 'crypto', 'indices', 'commodities', 'synthetic', 'unknown'];
const VALID_DECISIONS = ['BUY', 'SELL', 'WAIT', 'NO_TRADE'];
const ELEMENT_KEYS = [
  'bos', 'choch', 'mss', 'orderBlocks', 'fairValueGaps', 'breakerBlocks',
  'mitigationBlocks', 'liquidityZones', 'equalHighs', 'equalLows',
  'supportLevels', 'resistanceLevels', 'trendlines', 'consolidations',
  'breakouts', 'fakeBreakouts', 'premiumZones', 'discountZones',
];

/**
 * Extracts a JSON object from a possibly-noisy string.
 */
export const extractJson = (raw) => {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty AI response');
  }

  // Strip markdown code fences if present
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // If still not starting with {, grab the first {...} block
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
    text = text.slice(start, end + 1);
  }

  return JSON.parse(text);
};

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const normalizeElements = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((el) => el && typeof el === 'object')
    .map((el) => ({
      label: String(el.label ?? el.name ?? '').slice(0, 200),
      level: el.level ?? null,
      note: String(el.note ?? el.description ?? '').slice(0, 500),
      type: String(el.type ?? '').slice(0, 50),
    }));
};

const normalizeStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 500));
};

/**
 * Main entry: raw model text -> clean, schema-shaped object.
 */
export const parseAnalysisResponse = (raw) => {
  const data = extractJson(raw);

  const ta = data.technicalAnalysis || {};
  const technicalAnalysis = {
    marketStructure: String(ta.marketStructure || '').slice(0, 2000),
    momentum: String(ta.momentum || '').slice(0, 1000),
    volatility: String(ta.volatility || '').slice(0, 1000),
  };
  for (const key of ELEMENT_KEYS) {
    technicalAnalysis[key] = normalizeElements(ta[key]);
  }

  // Decision + confidence with the hard business rule enforced here too:
  // confidence < 70 can never be a live BUY/SELL — it becomes WAIT (a suggested
  // zone + reason) rather than a dead-end NO_TRADE. A legacy NO_TRADE from the
  // model is normalized to WAIT so new analyses never surface NO_TRADE.
  let decision = VALID_DECISIONS.includes(data.decision) ? data.decision : 'WAIT';
  if (decision === 'NO_TRADE') decision = 'WAIT';
  let confidenceScore = clamp(Math.round(toNumberOrNull(data.confidenceScore) ?? 0), 0, 100);
  if (confidenceScore < 70 && (decision === 'BUY' || decision === 'SELL')) decision = 'WAIT';

  const tp = data.tradePlan || {};
  const isLive = decision === 'BUY' || decision === 'SELL';
  const tradePlan = isLive
    ? {
        entry: toNumberOrNull(tp.entry),
        stopLoss: toNumberOrNull(tp.stopLoss),
        takeProfit1: toNumberOrNull(tp.takeProfit1),
        takeProfit2: toNumberOrNull(tp.takeProfit2),
        takeProfit3: toNumberOrNull(tp.takeProfit3),
        riskRewardRatio: tp.riskRewardRatio ? String(tp.riskRewardRatio).slice(0, 20) : null,
        estimatedDuration: tp.estimatedDuration ? String(tp.estimatedDuration).slice(0, 100) : null,
        estimatedProbability: toNumberOrNull(tp.estimatedProbability),
        waitReason: null,
      }
    : {
        // WAIT: keep `entry` as the SUGGESTED zone if the model provided one,
        // null the live levels, and carry the model's waitReason if present.
        entry: toNumberOrNull(tp.entry),
        stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
        riskRewardRatio: null, estimatedDuration: null,
        estimatedProbability: toNumberOrNull(tp.estimatedProbability),
        waitReason: tp.waitReason ? String(tp.waitReason).slice(0, 600) : null,
      };

  const rep = data.report || {};
  const report = {
    summary: String(rep.summary || '').slice(0, 3000),
    validationReasons: normalizeStringArray(rep.validationReasons),
    confluences: normalizeStringArray(rep.confluences),
    risks: normalizeStringArray(rep.risks),
    weaknesses: normalizeStringArray(rep.weaknesses),
    missingElements: normalizeStringArray(rep.missingElements),
  };

  const market = VALID_MARKETS.includes(data.market) ? data.market : 'unknown';

  return {
    symbol: String(data.symbol || 'Unknown').slice(0, 50),
    market,
    timeframe: String(data.timeframe || 'Unknown').slice(0, 20),
    broker: String(data.broker || 'Unknown').slice(0, 50),
    currentPrice: toNumberOrNull(data.currentPrice),
    technicalAnalysis,
    decision,
    confidenceScore,
    tradePlan,
    report,
  };
};
