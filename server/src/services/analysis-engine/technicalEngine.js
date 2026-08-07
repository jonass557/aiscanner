import { getProvider } from '../ai/index.js';
import { TECHNICAL_SYSTEM_PROMPT, buildTechnicalPrompt } from './technicalPrompt.js';
import { parseTechnicalReading } from './technicalParser.js';
import logger from '../../config/logger.js';

/**
 * Engine 2 — Technical reading (SMC/ICT/price action).
 *
 * Consumes a PerceptionResult and produces a TechnicalReading. It uses the
 * TEXT side of the AI providers (chat/analyzeData) with the perception JSON in
 * the prompt — never the image again. Reasoning over already-extracted facts is
 * more deterministic and cheaper.
 *
 * Resilience: if the provider is the deterministic mock (offline dev / no key),
 * or if the model returns unparseable output, we fall back to a rule-based
 * reading DERIVED from the perception itself, so the whole pipeline keeps
 * producing a coherent, non-fabricated result end-to-end.
 */

/** True when the resolved provider is the offline mock (its chat() is prose). */
const isMock = (provider) => provider?.name === 'mock';

/**
 * Deterministic technical reading derived purely from the perception. Used as
 * the offline/mock path and as a defensive fallback. Reads only what perception
 * actually reported — it invents nothing.
 * @param {Object} perception
 * @returns {Object} a parsed-shaped TechnicalReading
 */
export const deriveReadingFromPerception = (perception) => {
  const p = perception || {};
  const price = p.context?.currentPrice ?? null;
  const candles = Array.isArray(p.candles) ? p.candles : [];

  // Bias from candle directions (majority vote), else neutral.
  const bull = candles.filter((c) => c.direction === 'bullish').length;
  const bear = candles.filter((c) => c.direction === 'bearish').length;
  const bias = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'neutral';

  const supports = (p.drawnObjects || []).filter((o) => o.type === 'support');
  const resistances = (p.drawnObjects || []).filter((o) => o.type === 'resistance');
  const trendlines = (p.drawnObjects || []).filter((o) => o.type === 'trendline' || o.type === 'channel');
  const fibs = (p.drawnObjects || []).filter((o) => o.type === 'fibonacci');
  // A user-drawn rectangle marks an institutional zone → treat it as an order
  // block in the bias direction (demand when bullish, supply when bearish).
  const rectangles = (p.drawnObjects || []).filter((o) => o.type === 'rectangle');

  const mkDet = (o, direction, note) => ({
    label: o.label || note,
    level: o.level ?? null,
    note: note || o.note || '',
    type: o.type || '',
    direction: direction || 'neutral',
    confidence: o.confidence ?? 55,
    bbox: o.bbox || null,
    evidence: [],
  });

  const families = {};
  // Every family defaults to empty; fill only what perception supports.
  for (const key of [
    'bos', 'choch', 'mss', 'higherHighs', 'higherLows', 'lowerHighs', 'lowerLows',
    'orderBlocks', 'fairValueGaps', 'breakerBlocks', 'mitigationBlocks', 'inverseFvg',
    'imbalances', 'displacement', 'premiumZones', 'discountZones', 'oteZones',
    'liquidityZones', 'equalHighs', 'equalLows', 'liquiditySweeps', 'stopHunts',
    'inducement', 'supportLevels', 'resistanceLevels', 'trendlines', 'channels',
    'consolidations', 'breakouts', 'fakeBreakouts', 'retests', 'fibonacci',
    'chartPatterns', 'candlePatterns',
  ]) {
    families[key] = [];
  }

  families.supportLevels = supports.map((o) => mkDet(o, 'bullish', 'Support level'));
  families.resistanceLevels = resistances.map((o) => mkDet(o, 'bearish', 'Resistance level'));
  families.trendlines = trendlines.map((o) => mkDet(o, bias, 'Trendline / channel'));
  families.fibonacci = fibs.map((o) => mkDet(o, bias, 'Fibonacci'));
  families.orderBlocks = rectangles.map((o) => mkDet(o, bias, bias === 'bearish' ? 'Supply order block' : 'Demand order block'));
  if (bias === 'bullish') families.discountZones = rectangles.map((o) => mkDet(o, 'bullish', 'Discount zone'));
  else if (bias === 'bearish') families.premiumZones = rectangles.map((o) => mkDet(o, 'bearish', 'Premium zone'));
  families.consolidations = (p.consolidations || []).map((o) => mkDet(o, 'neutral', 'Consolidation'));
  if (Array.isArray(p.gaps) && p.gaps.length) {
    families.fairValueGaps = p.gaps.map((o) => mkDet(o, bias, 'Gap / imbalance'));
  }
  // Psychological round numbers act as liquidity references.
  families.liquidityZones = (p.psychLevels || []).map((o) => ({
    label: o.label || 'Psychological level', level: o.level ?? null, note: 'Round-number liquidity',
    type: 'liquidity', direction: 'neutral', confidence: o.confidence ?? 50, bbox: null, evidence: [],
  }));

  // Simple candidate setup: at a nearby support/resistance in the bias direction.
  let candidateSetup = null;
  const nearestSupport = supports[0]?.level ?? null;
  const nearestResistance = resistances[0]?.level ?? null;
  if (price != null && bias === 'bullish' && nearestSupport != null && nearestResistance != null) {
    const risk = Math.max(1e-9, price - nearestSupport);
    candidateSetup = {
      direction: 'BUY', entry: price, stopLoss: nearestSupport,
      takeProfit1: Number((price + risk * 2).toFixed(6)),
      takeProfit2: nearestResistance, takeProfit3: null,
      rationale: 'Bullish candles above support; targeting resistance/liquidity above.',
    };
  } else if (price != null && bias === 'bearish' && nearestResistance != null && nearestSupport != null) {
    const risk = Math.max(1e-9, nearestResistance - price);
    candidateSetup = {
      direction: 'SELL', entry: price, stopLoss: nearestResistance,
      takeProfit1: Number((price - risk * 2).toFixed(6)),
      takeProfit2: nearestSupport, takeProfit3: null,
      rationale: 'Bearish candles below resistance; targeting support/liquidity below.',
    };
  }

  const confluences = [];
  if (supports.length || resistances.length) confluences.push('Support/resistance confluence');
  if (families.liquidityZones.length) confluences.push('Liquidity at psychological levels');
  if (trendlines.length) confluences.push('Trendline/channel structure');

  return {
    marketStructure: `Derived ${bias} structure from ${candles.length} visible candle(s).`,
    momentum: bias === 'neutral' ? 'Neutral / unclear momentum.' : `${bias} momentum from candle sequence.`,
    volatility: 'Undetermined (derived offline).',
    bias,
    modelConfidence: candidateSetup ? 60 : 45,
    candidateSetup,
    confluences,
    risks: candidateSetup ? [] : ['No clear directional edge in the perceived structure'],
    weaknesses: ['Reading derived from perception only (no model reasoning available)'],
    missingElements: p.volumeVisible ? [] : ['Volume not visible'],
    families,
  };
};

/**
 * Produce a TechnicalReading from a perception.
 * @param {Object} params
 * @param {Object} params.perception
 * @param {string} [params.providerName]
 * @returns {Promise<{ reading: Object, meta: Object }>}
 */
export const read = async ({ perception, providerName }) => {
  const provider = getProvider(providerName);
  const startedAt = Date.now();

  // Offline mock: its chat() returns prose, not JSON — derive deterministically.
  if (isMock(provider)) {
    return {
      reading: deriveReadingFromPerception(perception),
      meta: { engineProvider: provider.name, engineModel: provider.model, readingTime: Date.now() - startedAt },
    };
  }

  let reading;
  try {
    const raw = await provider.analyzeData({
      systemPrompt: TECHNICAL_SYSTEM_PROMPT,
      userPrompt: buildTechnicalPrompt(perception),
    });
    reading = parseTechnicalReading(raw);
  } catch (err) {
    logger.warn(`Technical engine fell back to derived reading: ${err.message}`);
    reading = deriveReadingFromPerception(perception);
  }

  return {
    reading,
    meta: { engineProvider: provider.name, engineModel: provider.model, readingTime: Date.now() - startedAt },
  };
};

export default { read, deriveReadingFromPerception };
