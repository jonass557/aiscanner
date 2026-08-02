import { BaseSpeechProvider } from './BaseSpeechProvider.js';

/**
 * OpenAI speech provider: Whisper for STT, TTS-1 for synthesis.
 * Used as a higher-quality fallback for browsers without Web Speech, or when
 * the user prefers server-side voice. Native fetch (Node 18+), no SDK.
 */
export class OpenAISpeechProvider extends BaseSpeechProvider {
  constructor(config) {
    super(config);
    this.name = 'openai-speech';
    this.apiKey = config?.apiKey;
    this.sttModel = config?.sttModel || 'whisper-1';
    this.ttsModel = config?.ttsModel || 'tts-1';
    this.ttsVoice = config?.ttsVoice || 'alloy';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async transcribe({ audio, mimeType = 'audio/webm', language }) {
    const form = new FormData();
    const blob = new Blob([audio], { type: mimeType });
    form.append('file', blob, `audio.${mimeType.split('/')[1] || 'webm'}`);
    form.append('model', this.sttModel);
    if (language) form.append('language', language);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI STT error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return { text: data.text || '' };
  }

  async synthesize({ text, voice, language }) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.ttsModel,
        voice: voice || this.ttsVoice,
        input: text,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI TTS error (${res.status}): ${errText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { audio: buffer, mimeType: 'audio/mpeg' };
  }
}
