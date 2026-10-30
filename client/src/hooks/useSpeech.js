import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook vocal avancé avec support mains-libres continu (Hands-Free Continuous Voice).
 * Permet à l'utilisateur de parler à l'IA en continu sans avoir à appuyer sur le micro :
 * - Détection automatique de fin de parole (VAD silence 1.2s)
 * - Boucle de réécoute automatique en mode mains libres
 * - Mise en pause automatique du micro pendant que l'IA parle (évite l'écho)
 * - Reprise instantanée de l'écoute dès que l'IA a fini de parler
 */
export function useSpeech({ lang = 'fr-FR', onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [handsFree, setHandsFree] = useState(false);

  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  const silenceTimerRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');
  const shouldListenRef = useRef(false);

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = Boolean(SpeechRecognition);

  const initRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onresult = (event) => {
        if (speakingRef.current) return; // ignorer si l'IA parle

        let interimText = '';
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedTranscriptRef.current += ' ' + chunk;
            hasFinal = true;
          } else {
            interimText += chunk;
          }
        }

        setInterim(interimText || accumulatedTranscriptRef.current.trim());

        // Réinitialiser le timer de silence
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Si silence de 1.3s ou segment final, valider et envoyer à l'IA
        silenceTimerRef.current = setTimeout(() => {
          const fullText = (accumulatedTranscriptRef.current + ' ' + interimText).trim();
          if (fullText.length > 2) {
            setInterim('');
            accumulatedTranscriptRef.current = '';
            onResultRef.current?.(fullText);
          }
        }, 1300);
      };

      recognition.onerror = (e) => {
        // En cas d'erreur de réseau ou permission, tenter de reprendre si en mode mains-libres
        if (e.error !== 'no-speech') {
          // ignore common no-speech timeout
        }
      };

      recognition.onend = () => {
        setListening(false);
        // En mode mains libres, si l'IA ne parle pas et qu'on doit écouter, relancer immédiatement
        if (shouldListenRef.current && handsFreeRef.current && !speakingRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current && handsFreeRef.current && !speakingRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      return recognition;
    } catch {
      return null;
    }
  }, [SpeechRecognition, lang]);

  useEffect(() => {
    initRecognition();
    return () => {
      shouldListenRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, [initRecognition]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) initRecognition();
    if (!recognitionRef.current) return;

    shouldListenRef.current = true;
    setInterim('');
    accumulatedTranscriptRef.current = '';
    try {
      recognitionRef.current.start();
    } catch {
      // Ignorer si déjà démarré
    }
  }, [initRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {}
    setListening(false);
  }, []);

  const toggleHandsFree = useCallback(() => {
    setHandsFree((prev) => {
      const next = !prev;
      handsFreeRef.current = next;
      if (next) {
        startListening();
      } else {
        stopListening();
      }
      return next;
    });
  }, [startListening, stopListening]);

  const [isPaused, setIsPaused] = useState(false);
  const queueRef = useRef([]);
  const keepAliveTimerRef = useRef(null);

  const startKeepAlive = () => {
    if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 10000);
  };

  const stopKeepAlive = () => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
  };

  const cancelSpeech = useCallback(() => {
    stopKeepAlive();
    queueRef.current = [];
    if (synthSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setIsPaused(false);
    speakingRef.current = false;
  }, [synthSupported]);

  const pauseSpeech = useCallback(() => {
    if (synthSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [synthSupported]);

  const resumeSpeech = useCallback(() => {
    if (synthSupported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [synthSupported]);

  const speak = useCallback(
    (text, customLang) => {
      if (!synthSupported || !text) return;

      cancelSpeech();

      // Clean markdown, brackets, and code blocks for fluid spoken output
      const clean = String(text)
        .replace(/```[\s\S]*?```/g, '') // strip full code blocks
        .replace(/[#*_~`]/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!clean) return;

      // Break into natural sentences for continuous, non-stopping speech
      const sentenceRegex = /[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g;
      const rawSentences = clean.match(sentenceRegex) || [clean];
      const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 0);

      if (sentences.length === 0) return;

      queueRef.current = [...sentences];
      setSpeaking(true);
      setIsPaused(false);
      speakingRef.current = true;
      startKeepAlive();

      // Detect English vs French if not explicitly passed
      const targetLang =
        customLang ||
        (/^[a-zA-Z0-9\s,.'!?-]+$/.test(clean) &&
        (clean.includes('the ') || clean.includes('is ') || clean.includes('trading ') || clean.includes('market '))
          ? 'en-US'
          : lang || 'fr-FR');

      const playNextSentence = () => {
        if (!queueRef.current || queueRef.current.length === 0) {
          stopKeepAlive();
          setSpeaking(false);
          setIsPaused(false);
          speakingRef.current = false;

          // If hands-free mode is on, resume listening automatically
          if (shouldListenRef.current && handsFreeRef.current) {
            setTimeout(() => {
              if (shouldListenRef.current && handsFreeRef.current) {
                startListening();
              }
            }, 400);
          }
          return;
        }

        const sentence = queueRef.current.shift();
        const utter = new SpeechSynthesisUtterance(sentence);
        utter.lang = targetLang;
        utter.rate = 1.05; // clear, comfortable educational cadence
        utter.pitch = 1.0;

        utter.onend = () => {
          playNextSentence();
        };

        utter.onerror = (e) => {
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            playNextSentence();
          }
        };

        try {
          window.speechSynthesis.speak(utter);
        } catch {
          playNextSentence();
        }
      };

      playNextSentence();
    },
    [synthSupported, lang, startListening, cancelSpeech]
  );

  return {
    supported,
    synthSupported,
    listening,
    speaking,
    isPaused,
    interim,
    handsFree,
    toggleHandsFree,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    pauseSpeech,
    resumeSpeech,
  };
}

export default useSpeech;
