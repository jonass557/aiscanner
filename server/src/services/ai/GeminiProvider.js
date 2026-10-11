import { BaseProvider } from './BaseProvider.js';
import { fetchWithRetry } from './fetchWithRetry.js';
import logger from '../../config/logger.js';

/**
 * Google Gemini multimodal provider.
 * Supports latest models: gemini-3.8-flash, gemini-3.5-flash, gemini-flash-latest, etc.
 * Uses native fetch with AbortSignal timeout and automatic resilient model fallback.
 */
export class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.apiKey = config?.apiKey;
    // Default to the ultra-fast, state-of-the-art gemini-3.8-flash
    this.model = config?.model || 'gemini-3.8-flash';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async fetchImageAsBase64(imageUrl) {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString('base64'), mimeType: contentType };
  }

  /**
   * Helper that executes generateContent with model fallback and timeouts.
   */
  async executeGenerate(body) {
    const candidateModels = [
      this.model,
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];

    // Deduplicate
    const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

    let lastError = null;

    for (const currentModel of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${this.apiKey}`;

      try {
        const res = await fetchWithRetry(
          () =>
            fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(40000),
            }),
          `Gemini (${currentModel})`
        );

        if (!res.ok) {
          const errText = await res.text();
          // If 404 (model not found / deprecated) or 429 quota, try next candidate model
          if (res.status === 404 || res.status === 429) {
            logger.warn(`Gemini model ${currentModel} returned ${res.status}. Falling back to next model...`);
            lastError = new Error(`Gemini API error (${res.status}): ${errText}`);
            continue;
          }
          throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const result = await res.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
      } catch (err) {
        lastError = err;
        logger.warn(`Gemini ${currentModel} error: ${err.message}. Trying next fallback if available...`);
      }
    }

    throw lastError || new Error('All Gemini model fallbacks exhausted.');
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    const { data, mimeType } = await this.fetchImageAsBase64(imageUrl);

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }, { inline_data: { mime_type: mimeType, data } }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    return this.executeGenerate(body);
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    // Parallelize image fetches for high performance
    const imageParts = await Promise.all(
      images.map(async (img) => {
        const { data, mimeType } = await this.fetchImageAsBase64(img.url);
        return [
          { text: `\n--- Chart for timeframe: ${img.label} ---` },
          { inline_data: { mime_type: mimeType, data } },
        ];
      })
    );

    const parts = [{ text: userPrompt }, ...imageParts.flat()];

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    return this.executeGenerate(body);
  }

  async chat({ systemPrompt, messages }) {
    // Gemini uses 'model' for the assistant role.
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    };

    return this.executeGenerate(body);
  }
}
export default GeminiProvider;
