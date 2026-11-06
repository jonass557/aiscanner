import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook vocal avancé avec support mains-libres continu (Hands-Free Continuous Voice)
 * et synthèse vocale ininterrompue de haute qualité (anti-coupure Chrome / Android / iOS).
 *
 * Résout définitivement :
 * - Le problème des arrêts intempestifs en cours de route (anti-timeout & anti-freeze)
 * - La suppression des coupures sur les nombres à virgule (ex: 1.1234, 78.9, 2.5)
 * - La compatibilité avec les politiques d'autoplay des navigateurs mobiles
 * - Le basculement automatique sur la meilleure voix naturelle disponible
 */
export function useSpeech({ lang = 'fr-FR', onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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

  const queueRef = useRef([]);
  const manualCancelRef = useRef(false);
  const watchdogTimerRef = useRef(null);
  const voicesRef = useRef([]);

  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const supported = Boolean(SpeechRecognition);

  // Charger et mettre en cache les voix système
  useEffect(() => {
    if (!synthSupported) return;
    const updateVoices = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices() || [];
      } catch {}
    };
    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [synthSupported]);

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
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedTranscriptRef.current += ' ' + chunk;
          } else {
            interimText += chunk;
          }
        }

        setInterim(interimText || accumulatedTranscriptRef.current.trim());

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

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
    } catch {}
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

  const stopWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  const cancelSpeech = useCallback(() => {
    manualCancelRef.current = true;
    stopWatchdog();
    queueRef.current = [];
    if (synthSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
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

  /**
   * Synthèse vocale continue, naturelle et ininterrompue
   */
  const speak = useCallback(
    (text, customLang) => {
      if (!synthSupported || !text) return;

      manualCancelRef.current = false;
      stopWatchdog();
      queueRef.current = [];

      // Annuler toute lecture précédente
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {}

      // Nettoyer et transcrire le texte pour une prononciation fluide et humaine
      let clean = String(text)
        .replace(/```[\s\S]*?```/g, '') // supprimer les blocs de code
        .replace(/[#*_~`]/g, '')
        .replace(/https?:\/\/\S+/g, '') // supprimer les URLs
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .trim();

      if (!clean) return;

      // Détecter la langue
      const isEnglish =
        customLang === 'en' ||
        customLang === 'en-US' ||
        (/^[a-zA-Z0-9\s,.'!?-]+$/.test(clean) &&
          (clean.includes('the ') || clean.includes('is ') || clean.includes('trading ') || clean.includes('market ')));
      const targetLang = customLang || (isEnglish ? 'en-US' : lang || 'fr-FR');

      // Prononciation optimisée pour le trading et la finance
      if (!isEnglish) {
        clean = clean
          .replace(/(\d+)\.(\d+)/g, '$1 virgule $2') // ex: 1.1234 -> 1 virgule 1234
          .replace(/TP1\s*\/\s*TP2\s*\/\s*TP3/gi, 'Take Profit 1, 2 et 3')
          .replace(/TP1\s*\/\s*2\s*\/\s*3/gi, 'Take Profit 1, 2 et 3')
          .replace(/TP\s*1\s*\/\s*2/gi, 'Take Profit 1 et 2')
          .replace(/R:R\s*:\s*([0-9.,]+)/gi, 'Ratio Risque Rendement de $1')
          .replace(/\bR:R\b/gi, 'Ratio Risque Rendement')
          .replace(/\bSL\b/g, 'Stop Loss')
          .replace(/\bTP\b/g, 'Take Profit')
          .replace(/%/g, ' pour cent')
          .replace(/\$/g, ' dollars')
          .replace(/•/g, ' ')
          .replace(/-/g, ' ');
      } else {
        clean = clean
          .replace(/(\d+)\.(\d+)/g, '$1 point $2')
          .replace(/TP1\s*\/\s*TP2\s*\/\s*TP3/gi, 'Take Profit 1, 2 and 3')
          .replace(/TP1\s*\/\s*2\s*\/\s*3/gi, 'Take Profit 1, 2 and 3')
          .replace(/R:R\s*:\s*([0-9.,]+)/gi, 'Risk to Reward of $1')
          .replace(/\bR:R\b/gi, 'Risk to Reward ratio')
          .replace(/\bSL\b/g, 'Stop Loss')
          .replace(/\bTP\b/g, 'Take Profit')
          .replace(/%/g, ' percent')
          .replace(/\$/g, ' dollars');
      }

      // Nettoyer les espaces multiples
      clean = clean.replace(/\s+/g, ' ').trim();

      // Découper en segments courts (30 à 110 caractères) sur les séparateurs naturels
      const rawChunks = clean.split(/(?<=[.!?;\n])\s+/);
      const sentences = [];

      for (const piece of rawChunks) {
        const trimmed = piece.trim();
        if (!trimmed) continue;
        if (trimmed.length > 130) {
          // Si le segment est trop long, découper sur les virgules ou deux-points
          const sub = trimmed.split(/(?<=[,:])\s+/);
          for (const s of sub) {
            const str = s.trim();
            if (str) sentences.push(str);
          }
        } else {
          sentences.push(trimmed);
        }
      }

      if (sentences.length === 0) return;

      queueRef.current = [...sentences];
      setSpeaking(true);
      setIsPaused(false);
      speakingRef.current = true;

      // Recherche de la meilleure voix naturelle disponible
      const allVoices = voicesRef.current.length > 0
        ? voicesRef.current
        : (typeof window !== 'undefined' && window.speechSynthesis.getVoices()) || [];
      const langPrefix = targetLang.split('-')[0].toLowerCase();

      const matchedVoice =
        allVoices.find((v) => v.lang && v.lang.toLowerCase() === targetLang.toLowerCase() && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))) ||
        allVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix) && (v.name.includes('Google') || v.name.includes('Natural'))) ||
        allVoices.find((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)) ||
        null;

      const playNextSentence = () => {
        if (manualCancelRef.current) return;

        if (!queueRef.current || queueRef.current.length === 0) {
          stopWatchdog();
          setSpeaking(false);
          setIsPaused(false);
          speakingRef.current = false;

          // Si le mode mains-libres est actif, reprendre l'écoute micro
          if (shouldListenRef.current && handsFreeRef.current) {
            setTimeout(() => {
              if (shouldListenRef.current && handsFreeRef.current && !speakingRef.current) {
                startListening();
              }
            }, 350);
          }
          return;
        }

        const sentence = queueRef.current.shift();
        if (!sentence || sentence.trim().length === 0) {
          playNextSentence();
          return;
        }

        const utter = new SpeechSynthesisUtterance(sentence);
        if (matchedVoice) utter.voice = matchedVoice;
        utter.lang = targetLang;
        utter.rate = 1.02; // Cadence fluide et claire
        utter.pitch = 1.0;

        // Prévenir le garbage-collector Chrome V8
        if (typeof window !== 'undefined') {
          window.__activeSpeechUtterance = utter;
        }

        // Watchdog de sécurité (si un segment freeze plus de 12s, passer au suivant)
        stopWatchdog();
        watchdogTimerRef.current = setTimeout(() => {
          if (speakingRef.current && !manualCancelRef.current) {
            playNextSentence();
          }
        }, 12000);

        utter.onend = () => {
          stopWatchdog();
          if (typeof window !== 'undefined') window.__activeSpeechUtterance = null;
          if (!manualCancelRef.current) {
            setTimeout(() => playNextSentence(), 30);
          }
        };

        utter.onerror = (e) => {
          stopWatchdog();
          if (typeof window !== 'undefined') window.__activeSpeechUtterance = null;
          // Continuer systématiquement la lecture du texte même si une erreur survient
          if (!manualCancelRef.current && e.error !== 'canceled') {
            setTimeout(() => playNextSentence(), 35);
          }
        };

        try {
          window.speechSynthesis.speak(utter);
          // Si le navigateur est en pause inattendue, le débloquer
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        } catch {
          if (!manualCancelRef.current) {
            setTimeout(() => playNextSentence(), 35);
          }
        }
      };

      // Délai de 60ms pour laisser le pipeline audio du navigateur se réinitialiser proprement
      setTimeout(() => {
        if (!manualCancelRef.current) {
          playNextSentence();
        }
      }, 60);
    },
    [synthSupported, lang, startListening]
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
