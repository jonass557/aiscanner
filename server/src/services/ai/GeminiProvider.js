import { BaseProvider } from './BaseProvider.js';
import logger from '../../config/logger.js';

/**
 * Google Gemini multimodal provider — tuned for LOW LATENCY and RESILIENCE.
 *
 * Measured behaviour (see benchmark): the newest "preview-class" models
 * (e.g. gemini-3.8-flash) regularly answer 503 "high demand", 429 quota, or take
 * 40s. So instead of retrying the SAME failing model several times (which blew
 * past the browser timeout), we:
 *   - try each model in a reliability-ordered chain, moving on IMMEDIATELY on
 *     503 / 429 / 404 / timeout (no same-model retries);
 *   - cap every attempt (ATTEMPT_TIMEOUT_MS) and the whole call (TOTAL_BUDGET_MS)
 *     so one AI call can never exceed the client's timeout;
 *   - disable "thinking" by default (thinkingBudget: 0) which cuts latency from
 *     seconds to ~1s on flash models. Override with GEMINI_THINKING_BUDGET.
 */

// Ordered by measured reliability/latency:
// gemini-3.5-flash: ~4s, supporte vision + JSON, ultra stable.
// gemini-flash-lite-latest: ~4-5s, rapide et disponible.
// gemini-3.1-flash-lite: ~7s, excellent fallback.
// gemini-3.8-flash: modèle avancé mais plus lourd (10-30s).
// gemini-flash-latest: fallback de sécurité.
const FALLBACK_CHAIN = [
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

const ATTEMPT_TIMEOUT_MS = 15000; // 15s per model attempt (fails fast to try next)
const TOTAL_BUDGET_MS = 45000; // 45s total budget per call
// All transient or model-specific errors should immediately switch model
const SKIP_STATUS = new Set([400, 404, 408, 429, 500, 502, 503, 504]);

const thinkingBudget = () => {
  const v = process.env.GEMINI_THINKING_BUDGET;
  return v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
};

export class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.apiKey = config?.apiKey;
    this.model = config?.model || FALLBACK_CHAIN[0];
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

  /** One HTTP attempt against one model. Returns { ok, status, json|text }. */
  async attempt(model, body, timeoutMs) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { ok: true, status: res.status, json: await res.json() };
    return { ok: false, status: res.status, text: await res.text() };
  }

  /**
   * generateContent with a model chain, per-attempt timeout and a global budget.
   */
  async executeGenerate(body) {
    const chain = [...new Set([this.model, ...FALLBACK_CHAIN].filter(Boolean))];
    const startedAt = Date.now();
    let lastError = null;

    const baseConfig = body.generationConfig || {};
    const budgetVal = thinkingBudget();
    // Only attach thinkingConfig if explicitly configured to a number; otherwise omit it
    // because models like gemini-flash-lite-latest reject thinkingConfig with 400 INVALID_ARGUMENT.
    const bodyWithConfig = budgetVal !== null
      ? { ...body, generationConfig: { ...baseConfig, thinkingConfig: { thinkingBudget: budgetVal } } }
      : body;

    for (const model of chain) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < 3000) break;
      const timeoutMs = Math.min(ATTEMPT_TIMEOUT_MS, remaining);

      try {
        let r = await this.attempt(model, bodyWithConfig, timeoutMs);

        // If a model rejects thinkingConfig with 400, retry once without it
        if (!r.ok && r.status === 400 && /thinking/i.test(r.text || '')) {
          r = await this.attempt(model, body, Math.min(ATTEMPT_TIMEOUT_MS, TOTAL_BUDGET_MS - (Date.now() - startedAt)));
        }

        if (r.ok) {
          const text = (r.json.candidates?.[0]?.content?.parts || [])
            .filter((p) => !p.thought)
            .map((p) => p.text || '')
            .join('');
          if (text) {
            if (model !== this.model) logger.info(`Gemini: served by fallback model "${model}".`);
            return text;
          }
          lastError = new Error(`Gemini (${model}) returned an empty response`);
          continue;
        }

        lastError = new Error(`Gemini API error (${r.status}) on ${model}: ${String(r.text).slice(0, 200)}`);
        if (SKIP_STATUS.has(r.status)) {
          logger.warn(`Gemini ${model} → ${r.status}; switching model immediately.`);
          continue;
        }
        // If 401 or 403, key is invalid across all models
        throw lastError;
      } catch (err) {
        if (err.message && (err.message.includes('401') || err.message.includes('403') || err.message.includes('API_KEY_INVALID'))) {
          throw err;
        }
        lastError = err;
        logger.warn(`Gemini ${model} failed (${err.name === 'TimeoutError' ? 'timeout' : err.message}); trying next model in chain.`);
      }
    }

    throw lastError || new Error('Gemini: no model answered within the time budget.');
  }

  async analyze({ imageUrl, systemPrompt, userPrompt }) {
    const { data, mimeType } = await this.fetchImageAsBase64(imageUrl);
    return this.executeGenerate({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: 'user', parts: [{ text: userPrompt }, { inline_data: { mime_type: mimeType, data } }] },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
  }

  async analyzeMultiple({ images, systemPrompt, userPrompt }) {
    const imageParts = await Promise.all(
      images.map(async (img) => {
        const { data, mimeType } = await this.fetchImageAsBase64(img.url);
        return [
          { text: `\n--- Chart for timeframe: ${img.label} ---` },
          { inline_data: { mime_type: mimeType, data } },
        ];
      })
    );
    return this.executeGenerate({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }, ...imageParts.flat()] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
  }

  async chat({ systemPrompt, messages }) {
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    return this.executeGenerate({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    });
  }
}

export default GeminiProvider;
