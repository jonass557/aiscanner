import { BaseProvider } from './BaseProvider.js';
import { fetchWithRetry } from './fetchWithRetry.js';

/**
 * NVIDIA AI provider — open-source vision/text models served via NVIDIA NIM
 * (build.nvidia.com / integrate.api.nvidia.com). The API is OpenAI-compatible
 * (chat/completions with Bearer auth), so this mirrors OpenAIProvider — with one
 * difference: NIM vision models don't fetch remote URLs, so we inline the image
 * as a base64 data URL (like ClaudeProvider does).
 *
 * Endpoint, model and key are all config-driven (config.ai.nvidia), which the
 * settings service overlays from the admin dashboard at runtime. Adding another
 * OSS model = change the model string in the admin panel; no code change.
 *
 * The same instance backs BOTH engines:
 *  - perception (Engine 1) via analyze(), wrapped by AIVisionAdapter, and
 *  - technical reading (Engine 2) via analyzeData()/chat().
 */
export class NvidiaProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'nvidia';
    this.apiKey = config?.apiKey;
    this.model = config?.model || 'meta/llama-3.2-90b-vision-instruct';
    this.baseUrl = (config?.baseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
    this.endpoint = `${this.baseUrl}/chat/completions`;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async fetchImageAsDataUrl(imageUrl) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }

  async _post(body) {
    const res = await fetchWithRetry(
      () =>
        fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        }),
      'NVIDIA'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NVIDIA API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    const dataUrl = await this.fetchImageAsDataUrl(imageUrl);
    return this._post({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    });
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    const content = [{ type: 'text', text: userPrompt }];
    for (const img of images) {
      const dataUrl = await this.fetchImageAsDataUrl(img.url);
      content.push({ type: 'text', text: `\n--- Chart for timeframe: ${img.label} ---` });
      content.push({ type: 'image_url', image_url: { url: dataUrl } });
    }
    return this._post({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: 4096,
      temperature: 0.2,
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
