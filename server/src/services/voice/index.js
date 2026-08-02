import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { WebSpeechProvider } from './WebSpeechProvider.js';
import { OpenAISpeechProvider } from './OpenAISpeechProvider.js';

/**
 * Voice service factory. Mirrors services/ai/index.js: pick a provider from
 * config, fall back to the client-side Web Speech provider when no server-side
 * speech key is set. The rest of the app talks only to this seam.
 */
const PROVIDER_REGISTRY = {
  'web-speech': (cfg) => new WebSpeechProvider(cfg.voice),
  openai: (cfg) => new OpenAISpeechProvider(cfg.voice.openai),
};

export const getSpeechProvider = (providerName = config.voice.provider) => {
  const factory = PROVIDER_REGISTRY[providerName];
  if (factory) {
    const provider = factory(config);
    if (provider.isConfigured()) return provider;
    logger.warn(`Speech provider "${providerName}" not configured; using client-side Web Speech.`);
  } else if (providerName !== 'web-speech') {
    logger.warn(`Unknown speech provider "${providerName}"; using client-side Web Speech.`);
  }
  return new WebSpeechProvider(config.voice);
};

/**
 * Transcribe audio to text (server-side STT).
 * @param {{ audio: Buffer, mimeType?: string, language?: string }} params
 */
export const transcribeAudio = async (params) => {
  const provider = getSpeechProvider();
  return provider.transcribe(params);
};

/**
 * Synthesize speech from text. Returns null when synthesis should be done
 * client-side (Web Speech API), or { audio, mimeType } for server-side TTS.
 * @param {{ text: string, voice?: string, language?: string }} params
 */
export const synthesizeSpeech = async (params) => {
  const provider = getSpeechProvider();
  return provider.synthesize(params);
};
