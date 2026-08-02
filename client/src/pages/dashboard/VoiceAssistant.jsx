import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Mic, MicOff, Volume2, VolumeX, Plus, Trash2, MessageSquare,
  Menu, Sparkles, Send,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import VoiceAnimation from '../../components/voice/VoiceAnimation.jsx';
import { voiceApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useSpeech } from '../../hooks/useSpeech.js';

const SUGGESTIONS = [
  'Analyse ce graphique',
  'Pourquoi proposes-tu un achat ?',
  'Quel est le stop loss ?',
  'Montre-moi les opportunités',
  "Qu'est-ce qu'un order block ?",
];

/**
 * Voice Assistant: hands-free trading companion.
 * Web Speech API drives STT/TTS client-side; the backend resolves intents,
 * pulls live context, and returns a spoken reply + optional UI directive.
 */
export default function VoiceAssistant() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [turns, setTurns] = useState([]); // { role, text }
  const [processing, setProcessing] = useState(false);
  const [typed, setTyped] = useState('');
  const [ttsOn, setTtsOn] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);

  // Send a transcript to the backend and handle the reply.
  const send = useCallback(
    async (text) => {
      const clean = String(text || '').trim();
      if (!clean || processing) return;

      setTurns((t) => [...t, { role: 'user', text: clean }]);
      setProcessing(true);
      try {
        const { data } = await voiceApi.command({
          transcript: clean,
          conversationId,
          language: 'fr',
        });
        const res = data.data;
        setConversationId(res.conversationId);
        setTurns((t) => [...t, { role: 'assistant', text: res.reply }]);
        if (ttsOn) speak(res.reply);
        // App-control directive (navigate). Slight delay so TTS can start.
        if (res.directive?.type === 'navigate' && res.directive.target) {
          setTimeout(() => navigate(res.directive.target), 900);
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
        setTurns((t) => [...t, { role: 'assistant', text: 'Désolé, une erreur est survenue.' }]);
      } finally {
        setProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, processing, ttsOn, navigate]
  );

  const { supported, synthSupported, listening, speaking, interim, startListening, stopListening, speak, cancelSpeech } =
    useSpeech({ lang: 'fr-FR', onResult: send });

  const loadList = useCallback(async () => {
    try {
      const { data } = await voiceApi.conversations();
      setConversations(data.data.conversations || []);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Auto-scroll to newest turn.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns.length, processing]);

  const newConversation = () => {
    cancelSpeech();
    setConversationId(null);
    setTurns([]);
    setSidebarOpen(false);
  };

  const openConversation = async (id) => {
    setSidebarOpen(false);
    try {
      const { data } = await voiceApi.getConversation(id);
      const conv = data.data.conversation;
      setConversationId(conv._id);
      setTurns((conv.turns || []).map((t) => ({ role: t.role, text: t.text })));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await voiceApi.deleteConversation(id);
      setConversations((c) => c.filter((x) => x._id !== id));
      if (id === conversationId) newConversation();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleMic = () => {
    if (listening) stopListening();
    else {
      cancelSpeech();
      startListening();
    }
  };

  const toggleTts = () => {
    if (ttsOn) cancelSpeech();
    setTtsOn((v) => !v);
  };

  const submitTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    send(typed);
    setTyped('');
  };

  const micState = listening ? 'listening' : speaking ? 'speaking' : 'idle';

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar: conversation history */}
      <aside
        className={`${sidebarOpen ? 'absolute inset-y-0 left-0 z-40 w-72' : 'hidden'} card shrink-0 flex-col p-0 lg:relative lg:flex lg:w-72`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-800">
          <span className="font-semibold">Conversations</span>
          <button onClick={newConversation} className="btn-ghost !px-2" title="Nouvelle conversation">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="p-3 text-center text-sm text-gray-500">Aucune conversation.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c._id}
                onClick={() => openConversation(c._id)}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                  c._id === conversationId
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <Trash2
                  className="h-4 w-4 shrink-0 opacity-0 transition hover:text-red-500 group-hover:opacity-60"
                  onClick={(e) => removeConversation(c._id, e)}
                />
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat + voice controls */}
      <div className="card flex min-w-0 flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-2 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <Mic className="h-5 w-5 text-brand-500" />
            <span className="font-semibold">Voice Assistant</span>
          </div>
          {synthSupported && (
            <button onClick={toggleTts} className="btn-ghost !px-2" title={ttsOn ? 'Couper la voix' : 'Activer la voix'}>
              {ttsOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-gray-400" />}
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="mx-auto max-w-md pt-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <Mic className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold">Parlez à votre assistant</h2>
              <p className="mt-1 text-sm text-gray-500">
                Appuyez sur le micro et posez une question, ou essayez :
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs transition hover:border-brand-400 hover:text-brand-600 dark:border-gray-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  turn.role === 'user'
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                {turn.role === 'assistant' && (
                  <Sparkles className="mb-1 inline h-3.5 w-3.5 text-brand-400" />
                )}
                <span className="whitespace-pre-wrap">{turn.text}</span>
              </div>
            </div>
          ))}

          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-brand-600/60 px-4 py-2.5 text-sm text-white">
                {interim}…
              </div>
            </div>
          )}

          {processing && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-2.5 dark:bg-gray-800">
                <Spinner />
              </div>
            </div>
          )}
        </div>

        {/* Voice + text controls */}
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          {(listening || speaking) && (
            <div className="mb-3">
              <VoiceAnimation state={micState} />
              <p className="text-center text-xs text-gray-500">
                {listening ? 'À l\'écoute…' : 'L\'assistant parle…'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {supported ? (
              <button
                onClick={toggleMic}
                disabled={processing}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-50 ${
                  listening
                    ? 'animate-pulse bg-red-500 shadow-lg shadow-red-500/40'
                    : 'bg-gradient-to-br from-brand-500 to-accent-500 shadow-lg shadow-brand-500/30'
                }`}
                title={listening ? 'Arrêter' : 'Parler'}
              >
                {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400 dark:bg-gray-800" title="Reconnaissance vocale non supportée par ce navigateur">
                <MicOff className="h-6 w-6" />
              </div>
            )}

            <form onSubmit={submitTyped} className="flex flex-1 items-center gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={supported ? 'Ou tapez votre question…' : 'Tapez votre question…'}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              />
              <Button type="submit" loading={processing} disabled={!typed.trim()} className="!px-3">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
