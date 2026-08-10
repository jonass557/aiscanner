import { perceive } from '../vision/index.js';
import { read as readTechnical } from './technicalEngine.js';
import { decide } from './decisionEngine.js';
import { explain } from './explanationEngine.js';
import { build as buildOverlay } from '../annotation/overlayBuilder.js';
import { FAMILY_KEYS } from './technicalParser.js';
import { getMarketSnapshot, resolveSymbol } from '../marketData/index.js';
import { normalizeTimeframe } from '../marketData/timeframe.js';
import logger from '../../config/logger.js';
import config from '../../config/index.js';

/**
 * The two-pass Computer-Vision pipeline (Engines 1→2→3→4 + overlay).
 *
 *   image ──▶ [1 Vision] perceive ──▶ [2 Technical] read ──▶ [3 Decision] decide
 *                                                          └▶ [4 Explanation] explain
 *                                                          └▶ overlay annotations
 *
 * Perception (what is visible) is separated from Cognition (what it means),
 * which is what makes this a real CV architecture rather than "an LLM looking
 * at an image". Each stage consumes the previous stage's validated contract, so
 * any engine can be swapped without touching the others.
 *
 * The assembled object matches the Analysis schema exactly, so the controller
 * just Object.assigns it onto the pending record.
 */

export const ENGINE_VERSION = 'cv-1.0.0';

/** Flatten a reading's narrative + families into the technicalAnalysis shape. */
const toTechnicalAnalysis = (reading) => {
  const ta = {
    marketStructure: reading.marketStructure || '',
    momentum: reading.momentum || '',
    volatility: reading.volatility || '',
  };
  for (const key of FAMILY_KEYS) ta[key] = reading.families?.[key] || [];
  return ta;
};

/**
 * Fetch a live market snapshot for the perceived symbol + timeframe. Returns
 * null when the symbol can't be resolved (unknown pair) — the analysis then
 * proceeds on the screenshot alone. Never throws: a market-data failure must not
 * break a scan.
 */
const fetchLiveMarket = async (perception) => {
  // Never hit the network in the test env — keeps the suite hermetic/offline.
  if (config.isTest) return null;
  const rawSymbol = perception?.context?.symbol;
  const entry = rawSymbol ? resolveSymbol(rawSymbol) : null;
  if (!entry) {
    logger.warn(`Scan: symbol "${rawSymbol || '∅'}" not resolvable; skipping live market data.`);
    return null;
  }
  const tf = normalizeTimeframe(perception?.context?.timeframe);
  try {
    return await getMarketSnapshot(entry, tf, 150);
  } catch (err) {
    logger.warn(`Scan: live market fetch failed for ${entry.symbol} (${err.message}).`);
    return null;
  }
};

/**
 * Run the full pipeline for one image.
 * @param {Object} params
 * @param {string} params.imageUrl
 * @param {string} [params.providerName] - override vision provider
 * @returns {Promise<{ analysis: Object, meta: Object, market: Object|null }>}
 */
export const run = async ({ imageUrl, providerName }) => {
  const startedAt = Date.now();

  // 1. Perception — fails hard: if we can't see the chart, we don't proceed
  //    (and the controller won't charge a credit).
  const { perception, meta: visionMeta } = await perceive({ imageUrl, providerName });

  // 1b. Connect to the live market feed for the perceived symbol + timeframe.
  //     This anchors the decision on the REAL price and powers the live chart.
  const market = await fetchLiveMarket(perception);

  // 2. Technical reading (SMC/ICT) over the perception JSON.
  const { reading, meta: techMeta } = await readTechnical({ perception });

  // 3. Decision (deterministic confluences + always-directional verdict,
  //    anchored on the live price when a market snapshot is available).
  const decision = decide({ reading, perception, market });

  // 4. Explanation (report + reasoning) and header fields.
  const { header, report } = explain({ perception, reading, decision, market });

  // Overlay annotations (normalized coords for the client to draw).
  const annotations = buildOverlay({ perception, reading, decision });

  const analysis = {
    ...header,
    technicalAnalysis: toTechnicalAnalysis(reading),
    decision: decision.decision,
    confidenceScore: decision.confidenceScore,
    confidenceLabel: decision.confidenceLabel,
    tradePlan: decision.tradePlan,
    report,
    perception,
    annotations,
    source: 'vision',
    engineVersion: ENGINE_VERSION,
    visionProvider: visionMeta.visionProvider,
    visionModel: visionMeta.visionModel,
    // Live market provenance (null-safe when no snapshot was fetched).
    dataSource: market?.source ?? null,
    isRealData: market ? Boolean(market.isRealData) : null,
  };

  const meta = {
    aiProvider: techMeta.engineProvider,
    aiModel: techMeta.engineModel,
    visionProvider: visionMeta.visionProvider,
    visionModel: visionMeta.visionModel,
    processingTime: Date.now() - startedAt,
  };

  return { analysis, meta, market };
};

export default { run, ENGINE_VERSION };
