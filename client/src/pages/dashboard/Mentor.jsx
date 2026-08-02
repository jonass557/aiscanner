import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  GraduationCap, Plus, Send, Trash2, MessageSquare, Menu, Sparkles,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { mentorApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { renderMarkdown } from '../../utils/markdown.jsx';

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const SUGGESTIONS = [
  'What is an order block and how do I trade it?',
  'Explain the difference between BOS and CHoCH.',
  'How should I size my positions and manage risk?',
  'Walk me through a full SMC trade setup step by step.',
];

/** AI Mentor: conversational trading educator with saved conversations. */
export default function Mentor() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null); // full conversation { messages: [] }
  const [level, setLevel] = useState('intermediate');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const { data } = await mentorApi.conversations();
      setConversations(data.data.conversations);
    } catch {
      /* non-blocking */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages?.length, sending]);

  const openConversation = async (id) => {
    setActiveId(id);
    setSidebarOpen(false);
    try {
      const { data } = await mentorApi.getConversation(id);
      setActive(data.data.conversation);
      setLevel(data.data.conversation.level || 'intermediate');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const newConversation = () => {
    setActiveId(null);
    setActive({ messages: [] });
    setSidebarOpen(false);
  };

  const removeConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await mentorApi.deleteConversation(id);
      setConversations((c) => c.filter((x) => x._id !== id));
      if (activeId === id) {
        setActiveId(null);
        setActive(null);
      }
      toast.success('Conversation deleted.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setInput('');
    setSending(true);

    // Optimistically render the user's message.
    const optimistic = { role: 'user', content, createdAt: new Date().toISOString() };
    setActive((prev) => ({ ...(prev || {}), messages: [...(prev?.messages || []), optimistic] }));

    try {
      let convId = activeId;
      // Lazily create a conversation on the first message.
      if (!convId) {
        const { data } = await mentorApi.createConversation({ level });
        convId = data.data.conversation._id;
        setActiveId(convId);
      }

      const { data } = await mentorApi.sendMessage(convId, { content, level });
      setActive((prev) => ({ ...prev, ...data.data.conversation }));
      await loadList();
    } catch (err) {
      toast.error(getErrorMessage(err));
      // Roll back the optimistic message on failure.
      setActive((prev) => ({
        ...prev,
        messages: (prev?.messages || []).filter((m) => m !== optimistic),
      }));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasMessages = active?.messages?.length > 0;

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={newConversation} className="w-full">
          <Plus className="h-4 w-4" /> New conversation
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {loadingList ? (
          <p className="p-3 text-sm text-gray-500">Loading…</p>
        ) : conversations.length ? (
          conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => openConversation(c._id)}
              className={`group mb-1 flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                activeId === c._id
                  ? 'bg-brand-50 dark:bg-brand-950/50'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-gray-500">{c.lastMessage || 'No messages yet'}</p>
              </div>
              <span
                onClick={(e) => removeConversation(c._id, e)}
                className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                aria-label="Delete conversation"
                role="button"
              >
                <Trash2 className="h-4 w-4" />
              </span>
            </button>
          ))
        ) : (
          <p className="p-3 text-sm text-gray-500">No conversations yet.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">
        {Sidebar}
      </aside>

      {/* Sidebar drawer (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-900">{Sidebar}</aside>
        </div>
      )}

      {/* Chat pane */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open conversations">
              <Menu className="h-5 w-5" />
            </button>
            <GraduationCap className="h-5 w-5 text-brand-500" />
            <span className="font-semibold">AI Mentor</span>
          </div>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {!active || !hasMessages ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
                <GraduationCap className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold">Ask your trading mentor</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Get clear explanations of SMC, ICT, price action, and risk management — tailored to your level.
              </p>
              <div className="mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-gray-200 p-3 text-left text-sm transition hover:border-brand-400 hover:bg-brand-50 dark:border-gray-700 dark:hover:bg-brand-950/30"
                  >
                    <Sparkles className="mb-1 h-4 w-4 text-brand-500" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose-sm">{renderMarkdown(m.content)}</div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </span>
                Mentor is thinking…
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about SMC, ICT, price action, risk management…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
            />
            <Button onClick={() => send()} loading={sending} disabled={!input.trim()} className="!px-3 !py-2.5">
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-center text-[11px] text-gray-400">
            <MessageSquare className="h-3 w-3" />
            Educational guidance only — not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
