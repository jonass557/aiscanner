import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { NvidiaProvider } from './NvidiaProvider.js';
import { MockProvider } from './MockProvider.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { parseAnalysisResponse } from './responseParser.js';
import { MTF_SYSTEM_PROMPT, buildMtfUserPrompt } from './multiTimeframePrompt.js';
import { parseMultiTimeframeResponse } from './multiTimeframeParser.js';
import { MENTOR_SYSTEM_PROMPT, buildMentorSystemPrompt } from './mentorPrompt.js';
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantAnalysisPrompt, parseAssistantAnalysis } from './assistantAnalysisPrompt.js';

/**
 * AI service factory + orchestrator.
 *
 * This is the single seam the rest of the app talks to. It:
 *  1. Instantiates the configured provider (openai/claude/gemini/nvidia).
 *  2. Falls back to a deterministic mock when no key is configured, so the
 *     product works end-to-end in development without external costs.
 *  3. Runs the analysis, parses/validates the response, and returns a clean
 *     object plus metadata (provider, model, processingTime).
 *
 * Runtime overrides (e.g. from the admin panel) can be passed to
 * getProvider() without changing environment variables.
 */

const PROVIDER_REGISTRY = {
  openai: (cfg) => new OpenAIProvider(cfg.ai.openai),
  claude: (cfg) => new ClaudeProvider(cfg.ai.claude),
  gemini: (cfg) => new GeminiProvider(cfg.ai.gemini),
  nvidia: (cfg) => new NvidiaProvider(cfg.ai.nvidia),
};

/**
 * Resolve which provider to use. Falls back to MockProvider if the requested
 * provider is unknown or not configured with an API key.
 */
export const getProvider = (providerName = config.ai.provider) => {
  const factory = PROVIDER_REGISTRY[providerName];
  if (factory) {
    const provider = factory(config);
    if (provider.isConfigured()) return provider;
    logger.warn(`AI provider "${providerName}" is not configured; trying any other configured provider.`);
  } else if (providerName !== 'mock') {
    logger.warn(`Unknown AI provider "${providerName}"; trying any other configured provider.`);
  }

  // Resilient fallback: if the requested provider has no key (e.g. a stale DB
  // override points at "openai" but only GEMINI_API_KEY is set), use ANY other
  // real provider that IS configured before dropping to the mock. This keeps
  // scanning alive whenever at least one valid key exists, regardless of which
  // provider AI_PROVIDER / the admin DB happens to name.
  const configured = findConfiguredProvider();
  if (configured) {
    logger.warn(`Using configured provider "${configured.name}" instead of "${providerName}".`);
    return configured;
  }

  return new MockProvider(config.ai);
};

/**
 * Return the first REAL provider (in registry order) that has a valid key, or
 * null if none is configured. Skips the requested provider's own failure.
 */
const findConfiguredProvider = () => {
  for (const factory of Object.values(PROVIDER_REGISTRY)) {
    const provider = factory(config);
    if (provider.isConfigured()) return provider;
  }
  return null;
};

/**
 * Ordered list of DISTINCT configured providers to try, starting with the
 * requested one. Used by runWithFallback so a provider outage (e.g. Gemini 503
 * after all retries) transparently rolls over to the next configured provider
 * instead of surfacing a raw error to the user.
 * @param {string} [providerName]
 * @returns {Array<BaseProvider>}
 */
const providerChain = (providerName) => {
  const chain = [];
  const seen = new Set();
  const push = (p) => {
    if (p && !seen.has(p.name)) { seen.add(p.name); chain.push(p); }
  };
  push(getProvider(providerName)); // requested (or its configured fallback)
  for (const factory of Object.values(PROVIDER_REGISTRY)) {
    const p = factory(config);
    if (p.isConfigured()) push(p);
  }
  if (!chain.length) push(new MockProvider(config.ai));
  return chain;
};

/**
 * Run `op(provider)` across the provider chain, falling back to the next
 * configured provider when one throws (all its internal retries already
 * exhausted). Returns { result, provider } from the first that succeeds; throws
 * a clear, user-facing error only if EVERY provider fails.
 * @param {string} providerName
 * @param {(provider: BaseProvider) => Promise<any>} op
 */
const runWithFallback = async (providerName, op) => {
  const chain = providerChain(providerName);
  let lastError;
  for (const provider of chain) {
    try {
      const result = await op(provider);
      return { result, provider };
    } catch (err) {
      lastError = err;
      logger.warn(`AI provider "${provider.name}" failed (${err.message}); trying next provider.`);
    }
  }
  throw new Error(
    'Tous les fournisseurs IA sont indisponibles ou surchargés pour le moment. ' +
    'Réessayez dans quelques minutes.' + (lastError ? ` (dernier échec : ${lastError.message})` : '')
  );
};

/**
 * True when a REAL vision/text provider is configured (not the mock fallback).
 * Used to block silent mock analyses in production — returning a fabricated
 * result (always "EURUSD") for a real user's chart is worse than a clear error.
 * Checks ANY provider, so a valid key on a non-default provider still counts.
 */
export const isRealProviderConfigured = () => Boolean(findConfiguredProvider());

/**
 * Guard: in production, refuse to run image analysis with the mock provider.
 * Throws a clear Error the controller surfaces to the user. No-op in dev/test,
 * where the deterministic mock is intentionally used for offline flows.
 */
export const assertVisionReady = () => {
  if (config.isProduction && !isRealProviderConfigured()) {
    throw new Error(
      "L'analyse IA n'est pas configurée sur le serveur (aucune clé de vision valide). " +
      "Configurez une clé OpenAI, Claude ou Gemini avant de scanner."
    );
  }
};

/**
 * Analyze a chart image end-to-end.
 * @param {Object} params
 * @param {string} params.imageUrl
 * @param {string} [params.providerName]
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export const analyzeChart = async ({ imageUrl, providerName }) => {
  const startedAt = Date.now();

  const { result: raw, provider } = await runWithFallback(providerName, (p) =>
    p.analyze({
      imageUrl,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(),
    })
  );

  const analysis = parseAnalysisResponse(raw);
  const processingTime = Date.now() - startedAt;

  return {
    analysis,
    meta: {
      aiProvider: provider.name,
      aiModel: provider.model,
      processingTime,
    },
  };
};

/**
 * Analyze several charts of one symbol across multiple timeframes in a single
 * model call, returning a top-down multi-timeframe verdict.
 * @param {Object} params
 * @param {Array<{ url: string, label: string }>} params.images - label is the timeframe
 * @param {string[]} [params.timeframes] - ordered low->high for the prompt
 * @param {string} [params.providerName]
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export const analyzeMultiTimeframe = async ({ images, timeframes, providerName }) => {
  const startedAt = Date.now();

  const { result: raw, provider } = await runWithFallback(providerName, (p) =>
    p.analyzeMultiple({
      images,
      systemPrompt: MTF_SYSTEM_PROMPT,
      userPrompt: buildMtfUserPrompt(timeframes || images.map((i) => i.label)),
    })
  );

  const analysis = parseMultiTimeframeResponse(raw);
  const processingTime = Date.now() - startedAt;

  return {
    analysis,
    meta: {
      aiProvider: provider.name,
      aiModel: provider.model,
      processingTime,
    },
  };
};

/**
 * Generate a mentor reply for a conversation.
 * @param {Object} params
 * @param {Array<{ role: 'user'|'assistant', content: string }>} params.messages
 * @param {string} [params.level] - beginner|intermediate|advanced
 * @param {string} [params.providerName]
 * @returns {Promise<{ reply: string, meta: Object }>}
 */
export const mentorReply = async ({ messages, level, providerName }) => {
  const startedAt = Date.now();

  const { result: reply, provider } = await runWithFallback(providerName, (p) =>
    p.chat({
      systemPrompt: buildMentorSystemPrompt(level),
      messages,
    })
  );

  return {
    reply: (reply || '').trim(),
    meta: {
      aiProvider: provider.name,
      aiModel: provider.model,
      processingTime: Date.now() - startedAt,
    },
  };
};

/**
 * Analyze real market data (OHLC + quote) with the trading-assistant prompt.
 * Unlike analyzeChart (image), this works purely from numerical data.
 * @param {Object} params
 * @param {Object} params.snapshot - from marketData.getMarketSnapshot
 * @param {Object} [params.preferences] - user trading preferences
 * @param {string} [params.strategy]
 * @param {Object} [params.intentParams] - minRR / minConfidence constraints
 * @param {string} [params.providerName]
 * @returns {Promise<{ analysis: Object, meta: Object }>}
 */
export const analyzeMarketData = async ({ snapshot, preferences = {}, strategy, intentParams = {}, providerName }) => {
  const startedAt = Date.now();

  const { result: raw, provider } = await runWithFallback(providerName, (p) =>
    p.analyzeData({
      systemPrompt: ASSISTANT_SYSTEM_PROMPT,
      userPrompt: buildAssistantAnalysisPrompt({ snapshot, preferences, strategy, params: intentParams }),
    })
  );

  const analysis = parseAssistantAnalysis(raw);

  // Post-parse constraint enforcement (defense in depth): the model may ignore
  // minRR/minConfidence — enforce them so the assistant never overpromises. A
  // violation downgrades a live BUY/SELL to WAIT (keeping the entry as the
  // suggested zone), never a dead-end NO_TRADE.
  if (analysis.decision === 'BUY' || analysis.decision === 'SELL') {
    let violated = null;
    const minRR = intentParams.minRR || preferences.minRiskReward;
    if (minRR) {
      const rr = parseFloat((analysis.tradePlan?.riskRewardRatio || '').replace(/^1\s*:\s*/, ''));
      if (Number.isFinite(rr) && rr < minRR) violated = `R:R 1:${rr} < minimum requis 1:${minRR}`;
    }
    const minConf = intentParams.minConfidence;
    if (!violated && minConf && analysis.confidenceScore < minConf) {
      violated = `confiance ${analysis.confidenceScore}% < minimum requis ${minConf}%`;
    }
    if (violated) {
      const suggestedZone = analysis.tradePlan?.entry ?? null;
      const side = analysis.decision === 'BUY' ? 'achat' : 'vente';
      analysis.decision = 'WAIT';
      analysis.tradePlan = {
        entry: suggestedZone, // keep the suggested zone to wait for
        stopLoss: null, takeProfit1: null, takeProfit2: null, takeProfit3: null,
        riskRewardRatio: null, estimatedDuration: null, estimatedProbability: analysis.confidenceScore,
        tradeType: null,
        waitReason: `Ne pas entrer maintenant en ${side} : ${violated}. ` +
          (suggestedZone != null
            ? `Attendre que le prix rejoigne la zone ${suggestedZone} et se confirme avant de réévaluer.`
            : `Attendre une meilleure configuration avant de réévaluer.`),
      };
    }
  }

  return {
    analysis,
    meta: {
      aiProvider: provider.name,
      aiModel: provider.model,
      processingTime: Date.now() - startedAt,
    },
  };
};

export { SYSTEM_PROMPT, MTF_SYSTEM_PROMPT, MENTOR_SYSTEM_PROMPT };
