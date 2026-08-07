import { BaseVisionProvider } from './BaseVisionProvider.js';

/**
 * Adapts an existing ai/ provider (OpenAI/Claude/Gemini) into a vision
 * provider. Their analyze()/analyzeMultiple() already do image -> text with a
 * system + user prompt; perception is just those same calls pointed at the
 * perceptionPrompt instead of the trading prompt. This is the "reuse, don't
 * rewrite" seam from the plan — no duplicate image-fetch/base64 code.
 */
export class AIVisionAdapter extends BaseVisionProvider {
  /**
   * @param {import('../ai/BaseProvider.js').BaseProvider} aiProvider
   */
  constructor(aiProvider) {
    super(aiProvider?.config);
    this.ai = aiProvider;
    this.name = `${aiProvider?.name || 'ai'}-vision`;
    this.model = aiProvider?.model || 'unknown';
  }

  isConfigured() {
    return Boolean(this.ai?.isConfigured?.());
  }

  async perceive({ imageUrl, systemPrompt, prompt }) {
    return this.ai.analyze({ imageUrl, systemPrompt, userPrompt: prompt });
  }

  async perceiveMultiple({ images, systemPrompt, prompt }) {
    return this.ai.analyzeMultiple({ images, systemPrompt, userPrompt: prompt });
  }
}
