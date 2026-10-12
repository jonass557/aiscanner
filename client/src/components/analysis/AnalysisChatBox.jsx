import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User as UserIcon, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import toast from 'react-hot-toast';

/**
 * Interactive Q&A chat component allowing the trader to converse with the AI
 * about a specific completed scan (Single Scan or Multi-Timeframe).
 *
 * Professional hedge-fund tone, strictly grounded in the analysis context.
 */
export default function AnalysisChatBox({ analysisId, type = 'single', initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (initialMessages && initialMessages.length) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg = { role: 'user', content: query, createdAt: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { analysisApi, multiTimeframeApi } = await import('../../services/endpoints.js');
      const apiCall = type === 'multi' ? multiTimeframeApi.askChat : analysisApi.askChat;
      const { data } = await apiCall(analysisId, query);
      const reply = data.data.reply;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, createdAt: new Date() }]);
    } catch (err) {
      toast.error("L'IA n'a pas pu répondre. Veuillez réessayer.");
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Désolé, je n'ai pas pu analyser votre question pour l'instant. Veuillez reformuler ou réessayer.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_QUESTIONS = [
    "Pourquoi as-tu choisi ce niveau d'invalidation (Stop Loss) ?",
    "Y a-t-il une erreur ou un piège de liquidité à surveiller ici ?",
    "Quelles sont les confluences qui soutiennent ce trade ?",
    "Puis-je entrer maintenant au prix actuel ou dois-je attendre ?",
  ];

  return (
    <div className="card overflow-hidden border border-brand-500/20 shadow-lg dark:bg-dark-card/90">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-brand-500/10 to-transparent px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 text-brand-600 dark:text-brand-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Débriefing & Questions avec l'IA Expert
              <Sparkles className="h-4 w-4 text-amber-500" />
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Posez toutes vos questions sur ce graphique. L'IA analyse sans rien inventer et vous avertit en cas d'erreur.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="max-h-[380px] min-h-[160px] overflow-y-auto space-y-4 p-5 text-sm"
      >
        {messages.length === 0 ? (
          <div className="py-6 text-center text-gray-400 dark:text-gray-500">
            <HelpCircle className="mx-auto mb-2 h-8 w-8 text-brand-500/40" />
            <p className="font-medium text-gray-700 dark:text-gray-300">
              Une hésitation sur cette analyse ?
            </p>
            <p className="mt-1 text-xs max-w-md mx-auto">
              Demandez des précisions sur le plan de trade, les déséquilibres (FVG), les order blocks ou vérifiez la validité de votre scénario.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-500">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] leading-relaxed ${
                    isUser
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800/80 dark:text-gray-200 rounded-tl-none border border-gray-200/50 dark:border-gray-700/50'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 items-center text-gray-400 text-xs">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-500">
              <Spinner size="sm" />
            </div>
            <span>L'IA analyse le contexte technique et prépare sa réponse experte...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Questions */}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-2.5">
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              onClick={() => {
                setInput(q);
              }}
              className="rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:border-brand-500 hover:text-brand-500 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Form Input */}
      <form onSubmit={handleSend} className="flex gap-2 p-3 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-gray-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez une question technique sur ce graphique (ex: 'Y a-t-il un risque de sweep ?')..."
          disabled={loading}
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        />
        <Button type="submit" variant="primary" loading={loading} disabled={!input.trim()}>
          <Send className="h-4 w-4" /> Envoyer
        </Button>
      </form>
    </div>
  );
}
