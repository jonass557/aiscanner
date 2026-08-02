import { BaseProvider } from './BaseProvider.js';

/**
 * Anthropic Claude vision provider.
 * Fetches the image, base64-encodes it, and sends it as an image content
 * block to the Messages API. Uses native fetch (Node 18+).
 */
export class ClaudeProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'claude';
    this.apiKey = config?.apiKey;
    this.model = config?.model || 'claude-3-opus-20240229';
    this.endpoint = 'https://api.anthropic.com/v1/messages';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async fetchImageAsBase64(imageUrl) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString('base64'), mediaType: contentType };
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    const { data, mediaType } = await this.fetchImageAsBase64(imageUrl);

    const body = {
      model: this.model,
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data },
            },
          ],
        },
      ],
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.content?.[0]?.text || '';
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    const content = [{ type: 'text', text: userPrompt }];
    for (const img of images) {
      const { data, mediaType } = await this.fetchImageAsBase64(img.url);
      content.push({ type: 'text', text: `\n--- Chart for timeframe: ${img.label} ---` });
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
    }

    const body = {
      model: this.model,
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.content?.[0]?.text || '';
  }

  async chat({ systemPrompt, messages }) {
    const body = {
      model: this.model,
      max_tokens: 2048,
      temperature: 0.5,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.content?.[0]?.text || '';
  }
}
