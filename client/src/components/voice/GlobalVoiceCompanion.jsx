import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, X, Radio, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useSpeech } from '../../hooks/useSpeech.js';
import { voiceApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

/**
 * Global Hands-Free AI Voice Copilot.
 * Disponible sur toutes les pages de l'application :
 * - Mode Mains Libres : parle et écoute sans toucher aucun bouton.
 * - Réponse vocale immédiate via Web Speech API & synthèse.
 * - Navigation intelligente et réponse contextualisée.
 */
export default function GlobalVoiceCompanion() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastUserSpeech, setLastUserSpeech] = useState('');
  const [lastAiReply, setLastAiReply] = useState('');
  const [conversationId, setConversationId] = useState(null);

  const handleCommand = useCallback(
    async (transcript) => {
      const clean = String(transcript || '').trim();
      if (!clean || processing) return;

      setLastUserSpeech(clean);
      setProcessing(true);

      try {
        const { data } = await voiceApi.command({
          transcript: clean,
          conversationId,
          language: 'fr',
        });

        const res = data.data;
        setConversationId(res.conversationId);
        setLastAiReply(res.reply);

        if (ttsEnabled) {
          speak(res.reply);
        }

        if (res.directive?.type === 'navigate' && res.directive.target) {
          toast.success(`Navigation vers ${res.directive.target}`);
          setTimeout(() => navigate(res.directive.target), 900);
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
        setLastAiReply("Désolé, je n'ai pas pu traiter votre demande vocale.");
      } finally {
        setProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [processing, conversationId, ttsEnabled, navigate]
  );

  const {
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
  } = useSpeech({ lang: 'fr-FR', onResult: handleCommand });

  if (!supported) return null;

  return (
    <>
      {/* Floating Trigger Pill */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2.5 rounded-full px-4 py-3 font-semibold shadow-2xl backdrop-blur-xl transition ${
            handsFree && listening
              ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-cyan-500/40 animate-pulse'
              : 'border border-slate-700 bg-slate-900/90 text-white hover:border-cyan-500/50 hover:bg-slate-800'
          }`}
        >
          <div className="relative flex h-3 w-3">
            {(listening || handsFree) && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                listening ? 'bg-cyan-400' : handsFree ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
          </div>
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider">
            {handsFree ? 'IA Mains Libres Active' : 'Copilote Vocal IA'}
          </span>
        </motion.button>
      </div>

      {/* Floating Modal Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Copilote Vocal Mains Libres</h3>
                  <p className="text-[11px] text-slate-400">Trading interactif &amp; vocal en direct</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hands-Free Mode Toggle */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${handsFree ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <div>
                  <p className="text-xs font-semibold text-white">Mode Mains Libres Continu</p>
                  <p className="text-[10px] text-slate-400">Parlez sans toucher le bouton micro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleHandsFree}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  handsFree ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    handsFree ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Sound Wave State */}
            <div className="my-4 flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
              <div className="flex h-10 items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                  <motion.span
                    key={bar}
                    className={`w-1 rounded-full ${
                      listening ? 'bg-cyan-400' : speaking ? 'bg-indigo-400' : 'bg-slate-700'
                    }`}
                    animate={
                      listening || speaking
                        ? { height: ['20%', '100%', '30%', '90%', '20%'] }
                        : { height: '20%' }
                    }
                    transition={
                      listening || speaking
                        ? { duration: 0.6, repeat: Infinity, delay: bar * 0.08, ease: 'easeInOut' }
                        : { duration: 0.2 }
                    }
                    style={{ height: '20%' }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-300">
                {processing
                  ? 'Analyse IA en cours...'
                  : speaking
                  ? "L'IA vous répond vocalement..."
                  : listening
                  ? 'À votre écoute... (Parlez naturellement)'
                  : handsFree
                  ? 'Mains libres actif — En attente de voix'
                  : 'Micro en pause'}
              </p>
              {interim && <p className="mt-1 text-center text-xs italic text-cyan-300 font-mono">"{interim}..."</p>}
            </div>

            {/* Conversation Preview */}
            <div className="space-y-2 text-xs">
              {lastUserSpeech && (
                <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-2.5 text-slate-200">
                  <span className="font-semibold text-cyan-400">Vous :</span> {lastUserSpeech}
                </div>
              )}
              {lastAiReply && (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2.5 text-slate-100">
                  <span className="font-semibold text-indigo-400">IA :</span> {lastAiReply}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (listening) stopListening();
                    else startListening();
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-white transition ${
                    listening ? 'bg-rose-500 hover:bg-rose-600' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold'
                  }`}
                  title={listening ? 'Arrêter micro' : 'Activer micro'}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                {synthSupported && (
                  <button
                    onClick={() => {
                      if (ttsEnabled) cancelSpeech();
                      setTtsEnabled(!ttsEnabled);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                      ttsEnabled
                        ? 'border-slate-700 bg-slate-800 text-cyan-400'
                        : 'border-slate-800 bg-slate-900 text-slate-500'
                    }`}
                    title={ttsEnabled ? 'Désactiver audio réponse' : 'Activer audio réponse'}
                  >
                    {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/dashboard/voice-assistant');
                }}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
              >
                Plein écran <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
