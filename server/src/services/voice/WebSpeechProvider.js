import { BaseSpeechProvider } from './BaseSpeechProvider.js';

/**
 * Default provider that delegates STT and TTS to the CLIENT's Web Speech API.
 *
 * The browser does the actual speech work (free, low-latency, private). On the
 * server side this provider is a no-op signal: transcribe() is never called
 * (the client sends already-transcribed text), and synthesize() returns null,
 * telling the controller "let the client speak this with SpeechSynthesis".
 */
export class WebSpeechProvider extends BaseSpeechProvider {
  constructor(config) {
    super(config);
    this.name = 'web-speech';
  }

  isConfigured() {
    return true; // always available; the browser provides the capability
  }

  async transcribe() {
    // Client-side STT: server never transcribes in this mode.
    throw new Error('WebSpeechProvider transcribes on the client, not the server.');
  }

  async synthesize() {
    // Signal the controller to use client-side SpeechSynthesis.
    return null;
  }
}
