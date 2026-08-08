import { BaseProvider } from './BaseProvider.js';
import { fetchWithRetry } from './fetchWithRetry.js';

/**
 * OpenAI vision provider (GPT-4o / GPT-4-vision family).
 * Uses the Chat Completions API with an image_url content part.
 * Implemented with native fetch (Node 18+) to avoid an SDK dependency.
 *
 * All calls go through _post() → fetchWithRetry, so transient 429/5xx errors
 * are retried with exponential backoff before the ai/index.js layer falls back
 * to another provider.
 */
export class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'openai';
    this.apiKey = config?.apiKey;
    this.model = config?.model || 'gpt-4o';
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  /** POST a chat-completions body with retry; return the message content. */
  async _post(body) {
    const res = await fetchWithRetry(
      () =>
        fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        }),
      'OpenAI'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    return this._post({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    // Interleave a text label before each image so the model can attribute
    // each chart to its timeframe.
    const content = [{ type: 'text', text: userPrompt }];
    for (const img of images) {
      content.push({ type: 'text', text: `\n--- Chart for timeframe: ${img.label} ---` });
      content.push({ type: 'image_url', image_url: { url: img.url, detail: 'high' } });
    }

    return this._post({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
  }

  async chat({ systemPrompt, messages }) {
    return this._post({
      model: this.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 2048,
      temperature: 0.5,
    });
  }
}
