import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bot, Plus, Send, Trash2, MessageSquare, Menu, Mic, MicOff, Sparkles,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import AssistantMessage from '../../components/assistant/AssistantMessage.jsx';
import NewsBanner from '../../components/news/NewsBanner.jsx';
import { assistantApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useSpeech } from '../../hooks/useSpeech.js';

const SUGGESTIONS = [
  'Analyse EURUSD en H4',
  'Analyse BTCUSD selon Smart Money Concepts',
  'Donne-moi un trade avec un ratio minimum de 1:3',
  'Quels sont les meilleurs marchés aujourd\'hui ?',
  'Compare EURUSD et GBPUSD',
  'C\'est quoi un order block ?',
];

/**
 * AI Trading Assistant — ChatGPT-style copilot specialized in trading.
 * Understands natural language, analyzes real market data, keeps conversation
 * context, and renders rich decision/trade-plan cards inline.
 */
export default function AssistantChat() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const { data } = await assistantApi.conversations();
      setConversations(data.data.conversations || []);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, sending]);

  const send = useCallback(
    async (text) => {
      const clean = String(text || '').trim();
      if (!clean || sending) return;

      setMessages((m) => [...m, { role: 'user', content: clean }]);
      setInput('');
      setSending(true);
      try {
        // Lazily create a conversation on first message.
        let id = conversationId;
        if (!id) {
          const { data } = await assistantApi.createConversation({});
          id = data.data.conversation._id;
          setConversationId(id);
        }
        const { data } = await assistantApi.sendMessage(id, { content: clean });
        const res = data.data;
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: res.reply,
            action: res.action,
            analysisId: res.analysisId,
            analysisIds: res.analysisIds,
            dataSource: res.dataSource,
            isRealData: res.isRealData,
          },
        ]);
        loadList();
      } catch (err) {
        toast.error(getErrorMessage(err));
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `Désolé — ${getErrorMessage(err)}` },
        ]);
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, loadList]
  );

  const { supported: micSupported, listening, interim, startListening, stopListening } = useSpeech({
    lang: 'fr-FR',
    onResult: (t) => send(t),
  });

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  const openConversation = async (id) => {
    setSidebarOpen(false);
    try {
      const { data } = await assistantApi.getConversation(id);
      const conv = data.data.conversation;
      setConversationId(conv._id);
      setMessages(conv.messages || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await assistantApi.deleteConversation(id);
      setConversations((c) => c.filter((x) => x._id !== id));
      if (id === conversationId) newConversation();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
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

      {/* Main */}
      <div className="card flex min-w-0 flex-1 flex-col p-0">
        <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button className="btn-ghost !px-2 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <span className="font-semibold">AI Trading Assistant</span>
              <p className="text-[11px] text-gray-500">Analyse temps réel · langage naturel</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          <NewsBanner withinHours={24} />

          {messages.length === 0 && (
            <div className="mx-auto max-w-xl pt-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold">Votre copilote de trading</h2>
              <p className="mt-1 text-sm text-gray-500">
                Parlez ou écrivez naturellement. J'analyse les marchés en données réelles, j'explique
                mon raisonnement et je m'adapte à vos préférences.
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
              <p className="mt-4 text-[11px] text-gray-400">
                Éducatif uniquement — jamais un conseil financier. Les décisions se basent sur des
                données réelles ; les données simulées sont signalées.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <AssistantMessage key={i} message={m} />
          ))}

          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-brand-600/60 px-4 py-2.5 text-sm text-white">
                {interim}…
              </div>
            </div>
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-2.5 dark:bg-gray-800">
                <Spinner />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
          {micSupported && (
            <button
              type="button"
              onClick={() => (listening ? stopListening() : startListening())}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition ${
                listening ? 'animate-pulse bg-red-500' : 'bg-gradient-to-br from-brand-500 to-accent-500'
              }`}
              title={listening ? 'Arrêter' : 'Parler'}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Analyse EURUSD en H4, compare BTCUSD et ETHUSD, c'est quoi un FVG…"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
          />
          <Button type="submit" loading={sending} disabled={!input.trim()} className="!px-3">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
