import { BaseProvider } from './BaseProvider.js';
import { fetchWithRetry } from './fetchWithRetry.js';

/**
 * Google Gemini vision provider.
 * Fetches the image, base64-encodes it as inline_data, and calls the
 * generateContent endpoint. Uses native fetch (Node 18+).
 *
 * All model calls go through fetchWithRetry: Gemini frequently returns 503
 * ("high demand") during peak hours, so we retry transient errors with
 * exponential backoff before giving up (the ai/index.js layer then falls back
 * to another provider if all retries fail).
 */
export class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.apiKey = config?.apiKey;
    this.model = config?.model || 'gemini-flash-latest';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async fetchImageAsBase64(imageUrl) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString('base64'), mimeType: contentType };
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    const { data, mimeType } = await this.fetchImageAsBase64(imageUrl);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

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

    const res = await fetchWithRetry(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      'Gemini'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    const parts = [{ text: userPrompt }];
    for (const img of images) {
      const { data, mimeType } = await this.fetchImageAsBase64(img.url);
      parts.push({ text: `\n--- Chart for timeframe: ${img.label} ---` });
      parts.push({ inline_data: { mime_type: mimeType, data } });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    const res = await fetchWithRetry(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      'Gemini'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async chat({ systemPrompt, messages }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    // Gemini uses 'model' for the assistant role.
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    };

    const res = await fetchWithRetry(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      'Gemini'
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}
