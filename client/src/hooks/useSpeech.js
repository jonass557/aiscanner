import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper around the browser Web Speech API (SpeechRecognition +
 * SpeechSynthesis). Keeps STT/TTS client-side — free, low-latency, private.
 *
 * State machine: idle → listening → (transcript) → speaking → idle.
 *
 * Gracefully degrades: `supported` is false on browsers without the API, so
 * callers can fall back to typed input / server-side STT.
 */
export function useSpeech({ lang = 'fr-FR', onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = Boolean(SpeechRecognition);

  // Build the recognition instance once.
  useEffect(() => {
    if (!SpeechRecognition) return undefined;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        onResultRef.current?.(finalText.trim());
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [SpeechRecognition, lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setInterim('');
    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setListening(true);
    } catch {
      /* start() throws if already started — ignore */
    }
  }, [listening, lang]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!synthSupported || !text) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [synthSupported, lang]
  );

  const cancelSpeech = useCallback(() => {
    if (synthSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [synthSupported]);

  return {
    supported,
    synthSupported,
    listening,
    speaking,
    interim,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}

export default useSpeech;
