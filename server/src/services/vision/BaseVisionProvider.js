/**
 * Contract every vision (perception) provider must satisfy. Mirrors
 * ai/BaseProvider so the pipeline depends only on this interface — swapping
 * OpenAI perception for Claude/Gemini/NVIDIA/mock requires no downstream change.
 *
 * perceive() returns the RAW model text (expected JSON PerceptionResult); the
 * caller parses it via perceptionParser. This keeps providers dumb transports.
 */
export class BaseVisionProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base-vision';
    this.model = config?.model || 'unknown';
  }

  /** @returns {boolean} whether this provider has the credentials it needs. */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by the vision provider');
  }

  /**
   * Perceive a single chart image.
   * @param {Object} params
   * @param {string} params.imageUrl
   * @param {string} params.systemPrompt
   * @param {string} params.prompt - the perception user prompt
   * @returns {Promise<string>} raw JSON text (PerceptionResult)
   */
  // eslint-disable-next-line no-unused-vars
  async perceive({ imageUrl, systemPrompt, prompt }) {
    throw new Error('perceive() must be implemented by the vision provider');
  }

  /**
   * Perceive several labelled images at once (multi-timeframe).
   * @param {Object} params
   * @param {Array<{ url: string, label: string }>} params.images
   * @param {string} params.systemPrompt
   * @param {string} params.prompt
   * @returns {Promise<string>} raw JSON text
   */
  // eslint-disable-next-line no-unused-vars
  async perceiveMultiple({ images, systemPrompt, prompt }) {
    throw new Error('perceiveMultiple() must be implemented by the vision provider');
  }
}
