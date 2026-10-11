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

  const speak = useCallback(
    (text) => {
      if (!synthSupported || !text) return;

      // Suspendre l'écoute pendant la parole pour éviter le retour audio
      try {
        if (recognitionRef.current) recognitionRef.current.abort();
      } catch {}

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 1.05; // Débit naturel et fluide
      utter.pitch = 1.0;

      utter.onstart = () => {
        setSpeaking(true);
        speakingRef.current = true;
      };

      const onDone = () => {
        setSpeaking(false);
        speakingRef.current = false;
        // Si le mode mains-libres est actif, relancer l'écoute dès que l'IA a terminé de parler !
        if (shouldListenRef.current && handsFreeRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current && handsFreeRef.current) {
              startListening();
            }
          }, 350);
        }
      };

      utter.onend = onDone;
      utter.onerror = onDone;

      window.speechSynthesis.speak(utter);
    },
    [synthSupported, lang, startListening]
  );

  const cancelSpeech = useCallback(() => {
    if (synthSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
    speakingRef.current = false;
  }, [synthSupported]);

  return {
    supported,
    synthSupported,
    listening,
    speaking,
    interim,
    handsFree,
    toggleHandsFree,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}

export default useSpeech;
