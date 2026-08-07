import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { OpenAIProvider } from '../ai/OpenAIProvider.js';
import { ClaudeProvider } from '../ai/ClaudeProvider.js';
import { GeminiProvider } from '../ai/GeminiProvider.js';
import { NvidiaProvider } from '../ai/NvidiaProvider.js';
import { AIVisionAdapter } from './AIVisionAdapter.js';
import { MockVisionProvider } from './MockVisionProvider.js';

/**
 * Dynamic vision-provider registry (Engine 5 — continuous improvement).
 *
 * Extends the static AI registry into one that is DB-driven: which provider
 * performs perception is read from config.vision.provider, which the settings
 * service overlays from the database at runtime. Adding an OSS model later =
 * registerVisionProvider('x', (cfg) => new XVisionProvider(cfg)) — zero change
 * elsewhere.
 *
 * Factories return a BaseVisionProvider. The AI-backed ones wrap the existing
 * ai/ providers via AIVisionAdapter so we reuse their image transport.
 */
const REGISTRY = {
  openai: (cfg) => new AIVisionAdapter(new OpenAIProvider(cfg.ai.openai)),
  claude: (cfg) => new AIVisionAdapter(new ClaudeProvider(cfg.ai.claude)),
  gemini: (cfg) => new AIVisionAdapter(new GeminiProvider(cfg.ai.gemini)),
  nvidia: (cfg) => new AIVisionAdapter(new NvidiaProvider(cfg.ai.nvidia)),
};

/** Register (or replace) a vision provider factory at runtime. */
export const registerVisionProvider = (name, factory) => {
  REGISTRY[name] = factory;
};

/** The first real (configured) provider in registry order, or null. */
const findConfigured = () => {
  for (const factory of Object.values(REGISTRY)) {
    const provider = factory(config);
    if (provider.isConfigured()) return provider;
  }
  return null;
};

/**
 * Resolve the active vision provider. Order:
 *   1. the requested / config.vision.provider if configured,
 *   2. any other configured real provider (resilient to stale DB overrides),
 *   3. the deterministic mock (offline dev / no keys).
 */
export const resolveVisionProvider = (providerName = config.vision?.provider) => {
  const factory = REGISTRY[providerName];
  if (factory) {
    const provider = factory(config);
    if (provider.isConfigured()) return provider;
    logger.warn(`Vision provider "${providerName}" not configured; trying another.`);
  } else if (providerName && providerName !== 'mock') {
    logger.warn(`Unknown vision provider "${providerName}"; trying another.`);
  }

  const configured = findConfigured();
  if (configured) {
    logger.warn(`Using vision provider "${configured.name}" instead of "${providerName}".`);
    return configured;
  }
  return new MockVisionProvider(config.vision);
};

/** True when a REAL vision provider (not the mock) has valid credentials. */
export const isVisionConfigured = () => Boolean(findConfigured());
