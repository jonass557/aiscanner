import config from '../../config/index.js';
import { resolveVisionProvider, isVisionConfigured } from './registry.js';
import { PERCEPTION_SYSTEM_PROMPT, buildPerceptionPrompt } from './perceptionPrompt.js';
import { parsePerceptionResponse } from './perceptionParser.js';

/**
 * Engine 1 orchestrator — Computer Vision (perception).
 *
 * This is the single seam the pipeline talks to for perception. It:
 *  1. Resolves the active vision provider (DB/config-driven, mock fallback).
 *  2. Runs perceive() with the pure-extraction perceptionPrompt.
 *  3. Parses + validates the raw text into a clean PerceptionResult.
 *  4. Returns the result plus provenance metadata.
 *
 * Mirrors ai/index.js#analyzeChart so the two engines feel identical from the
 * outside. Providers stay dumb transports; all normalization lives in the
 * parser, so swapping OpenAI/Claude/Gemini/NVIDIA/mock changes nothing here.
 */

/** True when a REAL vision provider is configured (not the mock fallback). */
export { isVisionConfigured };

/**
 * Perceive a single chart image → validated PerceptionResult.
 * @param {Object} params
 * @param {string} params.imageUrl
 * @param {string} [params.providerName] - override the configured provider
 * @returns {Promise<{ perception: Object, meta: Object }>}
 */
export const perceive = async ({ imageUrl, providerName = config.vision?.provider }) => {
  const provider = resolveVisionProvider(providerName);
  const startedAt = Date.now();

  const raw = await provider.perceive({
    imageUrl,
    systemPrompt: PERCEPTION_SYSTEM_PROMPT,
    prompt: buildPerceptionPrompt(),
  });

  const perception = parsePerceptionResponse(raw);

  return {
    perception,
    meta: {
      visionProvider: provider.name,
      visionModel: provider.model,
      perceptionTime: Date.now() - startedAt,
    },
  };
};

/**
 * Perceive several labelled images at once (multi-timeframe). Returns the same
 * PerceptionResult shape; the model is asked to describe the combined view.
 * @param {Object} params
 * @param {Array<{ url: string, label: string }>} params.images
 * @param {string} [params.providerName]
 * @returns {Promise<{ perception: Object, meta: Object }>}
 */
export const perceiveMultiple = async ({ images, providerName = config.vision?.provider }) => {
  const provider = resolveVisionProvider(providerName);
  const startedAt = Date.now();

  const raw = await provider.perceiveMultiple({
    images,
    systemPrompt: PERCEPTION_SYSTEM_PROMPT,
    prompt: buildPerceptionPrompt(),
  });

  const perception = parsePerceptionResponse(raw);

  return {
    perception,
    meta: {
      visionProvider: provider.name,
      visionModel: provider.model,
      perceptionTime: Date.now() - startedAt,
    },
  };
};

export default { perceive, perceiveMultiple, isVisionConfigured };
