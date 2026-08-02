/**
 * Abstract base class every AI vision provider must extend.
 * The rest of the application depends only on this interface, so swapping
 * OpenAI for Claude/Gemini/a custom CV model requires no downstream changes.
 */
export class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
    this.model = config?.model || 'unknown';
  }

  /**
   * Whether this provider is configured (has an API key, etc.).
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by the provider');
  }

  /**
   * Analyze a chart image.
   * @param {Object} params
   * @param {string} params.imageUrl - Publicly reachable image URL
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @returns {Promise<string>} Raw text response from the model (expected JSON)
   */
  // eslint-disable-next-line no-unused-vars
  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    throw new Error('analyze() must be implemented by the provider');
  }

  /**
   * Analyze several chart images at once (multi-timeframe). Each image carries
   * a label (e.g. its timeframe) so the model can reason across them in a
   * single call. Providers that support multiple image parts override this.
   * @param {Object} params
   * @param {Array<{ url: string, label: string }>} params.images
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @returns {Promise<string>} Raw text response from the model (expected JSON)
   */
  // eslint-disable-next-line no-unused-vars
  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    throw new Error('analyzeMultiple() must be implemented by the provider');
  }

  /**
   * Free-form text conversation (no image). Used by the AI Mentor. Providers
   * that support chat override this; vision-only setups can leave it unset.
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {Array<{ role: 'user'|'assistant', content: string }>} params.messages
   * @returns {Promise<string>} Raw assistant text
   */
  // eslint-disable-next-line no-unused-vars
  async chat({ systemPrompt, messages }) {
    throw new Error('chat() must be implemented by the provider');
  }

  /**
   * Validate a trade plan. Concrete by default: if an image is provided it
   * runs vision analysis, otherwise a text-only chat. Real providers inherit
   * this; the mock overrides it to return a schema-valid sample.
   * @param {Object} params
   * @param {string|null} params.imageUrl
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @returns {Promise<string>} Raw JSON text
   */
  async validateTrade({ imageUrl, systemPrompt, userPrompt }) {
    if (imageUrl) {
      return this.analyze({ imageUrl, systemPrompt, userPrompt });
    }
    return this.chat({ systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
  }

  /**
   * Analyze numerical market data (no image). Real providers route through
   * chat() with the data embedded in the prompt; the mock overrides this to
   * derive a coherent analysis from the actual candle data it receives.
   * @param {Object} params
   * @param {string} params.systemPrompt
   * @param {string} params.userPrompt
   * @returns {Promise<string>} Raw JSON text
   */
  // eslint-disable-next-line no-unused-vars
  async analyzeData({ systemPrompt, userPrompt }) {
    return this.chat({ systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
  }
}
