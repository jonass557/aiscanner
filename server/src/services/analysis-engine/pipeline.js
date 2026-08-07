import { perceive } from '../vision/index.js';
import { read as readTechnical } from './technicalEngine.js';
import { decide } from './decisionEngine.js';
import { explain } from './explanationEngine.js';
import { build as buildOverlay } from '../annotation/overlayBuilder.js';
import { FAMILY_KEYS } from './technicalParser.js';

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
 * Run the full pipeline for one image.
 * @param {Object} params
 * @param {string} params.imageUrl
 * @param {string} [params.providerName] - override vision provider
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export const run = async ({ imageUrl, providerName }) => {
  const startedAt = Date.now();

  // 1. Perception — fails hard: if we can't see the chart, we don't proceed
  //    (and the controller won't charge a credit).
  const { perception, meta: visionMeta } = await perceive({ imageUrl, providerName });

  // 2. Technical reading (SMC/ICT) over the perception JSON.
  const { reading, meta: techMeta } = await readTechnical({ perception });

  // 3. Decision (deterministic confluences + guardrails).
  const decision = decide({ reading, perception });

  // 4. Explanation (report + reasoning) and header fields.
  const { header, report } = explain({ perception, reading, decision });

  // Overlay annotations (normalized coords for the client to draw).
  const annotations = buildOverlay({ perception, reading, decision });

  const analysis = {
    ...header,
    technicalAnalysis: toTechnicalAnalysis(reading),
    decision: decision.decision,
    confidenceScore: decision.confidenceScore,
    tradePlan: decision.tradePlan,
    report,
    perception,
    annotations,
    source: 'vision',
    engineVersion: ENGINE_VERSION,
    visionProvider: visionMeta.visionProvider,
    visionModel: visionMeta.visionModel,
  };

  const meta = {
    aiProvider: techMeta.engineProvider,
    aiModel: techMeta.engineModel,
    visionProvider: visionMeta.visionProvider,
    visionModel: visionMeta.visionModel,
    processingTime: Date.now() - startedAt,
  };

  return { analysis, meta };
};

export default { run, ENGINE_VERSION };
