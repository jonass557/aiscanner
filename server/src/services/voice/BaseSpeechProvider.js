/**
 * Abstract base for speech providers (STT + TTS).
 * The rest of the app depends only on this interface, so swapping the browser
 * Web Speech API for OpenAI Whisper/TTS, Deepgram, or ElevenLabs requires no
 * downstream changes — mirrors the pattern in services/ai/BaseProvider.js.
 */
export class BaseSpeechProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /** Whether this provider is configured (API key present, etc.). */
  isConfigured() {
    throw new Error('isConfigured() must be implemented by the provider');
  }

  /**
   * Speech-to-Text: transcribe an audio buffer.
   * @param {Object} params
   * @param {Buffer} params.audio
   * @param {string} [params.mimeType]
   * @param {string} [params.language]
   * @returns {Promise<{ text: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async transcribe({ audio, mimeType, language }) {
    throw new Error('transcribe() must be implemented by the provider');
  }

  /**
   * Text-to-Speech: synthesize speech from text.
   * @param {Object} params
   * @param {string} params.text
   * @param {string} [params.voice]
   * @param {string} [params.language]
   * @returns {Promise<{ audio: Buffer, mimeType: string }|null>}
   *   Returns null when synthesis should happen client-side (Web Speech API).
   */
  // eslint-disable-next-line no-unused-vars
  async synthesize({ text, voice, language }) {
    throw new Error('synthesize() must be implemented by the provider');
  }
}
