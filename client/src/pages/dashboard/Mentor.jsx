import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  Plus,
  Send,
  Trash2,
  MessageSquare,
  Menu,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BookOpen,
  CheckCircle,
  Lock,
  Award,
  ChevronRight,
  HelpCircle,
  FileText,
  AlertCircle,
  Zap,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { mentorApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { renderMarkdown } from '../../utils/markdown.jsx';
import { useSpeech } from '../../hooks/useSpeech.js';

const LEVELS = [
  { value: 'beginner', label: '🎓 Débutant' },
  { value: 'intermediate', label: '📊 Intermédiaire' },
  { value: 'advanced', label: '🏛️ Expert / Agrégé' },
];

const SUGGESTIONS = [
  'Expliquez-moi le fonctionnement des Order Blocks institutionnels et des FVG.',
  'Quelle est la différence rigoureuse entre un BOS et un Change of Character (CHoCH) ?',
  'Comment dimensionner sa position selon les mathématiques de Kelly et Mark Douglas ?',
  'Qu\'est-ce qu\'une divergence SMT et comment l\'utiliser entre EURUSD et GBPUSD ?',
];

/** AI Mentor: Professeur Agrégé en Trading avec cursus interactif, vocal bi-directionnel & validation d'exercices. */
export default function Mentor() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [level, setLevel] = useState('intermediate');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [curriculumTabOpen, setCurriculumTabOpen] = useState(false);

  // Exercise modal & state
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseAnswer, setExerciseAnswer] = useState('');
  const [evaluatingExercise, setEvaluatingExercise] = useState(false);

  // Voice output setting
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const scrollRef = useRef(null);

  // Bi-directional Speech hook
  const {
    listening,
    speaking,
    supported: speechSupported,
    handsFree,
    startListening,
    stopListening,
    toggleHandsFree,
    speak,
    cancelSpeech,
  } = useSpeech({
    lang: 'fr-FR',
    onResult: (spokenText) => {
      if (spokenText && spokenText.trim()) {
        send(spokenText.trim());
      }
    },
  });

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

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages?.length, sending]);

  const openConversation = async (id) => {
    cancelSpeech();
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

  const newConversation = async () => {
    cancelSpeech();
    try {
      const { data } = await mentorApi.createConversation({ level });
      const newConv = data.data.conversation;
      setActiveId(newConv._id);
      setActive(newConv);
      setSidebarOpen(false);
      await loadList();
      toast.success('Nouvelle séance avec le Professeur initialisée.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
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
      toast.success('Séance supprimée.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    cancelSpeech();
    setInput('');
    setSending(true);

    const optimistic = { role: 'user', content, createdAt: new Date().toISOString() };
    setActive((prev) => ({ ...(prev || {}), messages: [...(prev?.messages || []), optimistic] }));

    try {
      let convId = activeId;
      if (!convId) {
        const { data } = await mentorApi.createConversation({ level });
        convId = data.data.conversation._id;
        setActiveId(convId);
      }

      const { data } = await mentorApi.sendMessage(convId, { content, level });
      const updatedConv = data.data.conversation;
      setActive((prev) => ({ ...prev, ...updatedConv }));
      await loadList();

      // Read reply aloud if voice output is enabled
      if (voiceEnabled && data.data.reply) {
        // Strip markdown markers for clean speech synthesis
        const cleanSpeakText = data.data.reply
          .replace(/[#*_`]/g, '')
          .replace(/\[.*?\]/g, '')
          .slice(0, 450);
        speak(cleanSpeakText);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
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

  // Submit exercise to professor
  const submitCurrentExercise = async () => {
    if (!exerciseAnswer.trim() || evaluatingExercise) return;
    setEvaluatingExercise(true);

    try {
      const { data } = await mentorApi.submitExercise(active._id, { answer: exerciseAnswer.trim() });
      const { evaluation, conversation: updatedConv } = data.data;

      setActive(updatedConv);
      setExerciseModalOpen(false);
      setExerciseAnswer('');
      await loadList();

      if (evaluation.passed) {
        toast.success(`Module validé avec succès (${evaluation.score}/100) !`);
      } else {
        toast.error(`Exercice non validé (${evaluation.score}/100). Consultez les remarques du professeur.`);
      }

      if (voiceEnabled && evaluation.feedback) {
        speak(
          evaluation.passed
            ? `Félicitations, votre exercice a été validé avec une note de ${evaluation.score} sur 100.`
            : `Exercice corrigé avec une note de ${evaluation.score} sur 100. Veuillez réviser vos arguments.`
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEvaluatingExercise(false);
    }
  };

  // Select a lesson from curriculum
  const handleSelectLesson = async (idx) => {
    if (!active?._id) return;
    try {
      const { data } = await mentorApi.selectLesson(active._id, { lessonIndex: idx });
      setActive(data.data.conversation);
      toast.success('Module sélectionné.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const currentLesson = active?.curriculum?.[active?.activeLessonIndex ?? 0];
  const hasMessages = active?.messages?.length > 0;

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={newConversation} className="w-full justify-center gap-2">
          <Plus className="h-4 w-4" /> Nouvelle Séance
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {loadingList ? (
          <p className="p-3 text-sm text-gray-500">Chargement des séances…</p>
        ) : conversations.length ? (
          conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => openConversation(c._id)}
              className={`group mb-1.5 flex w-full items-start justify-between gap-2 rounded-xl p-3 text-left transition ${
                activeId === c._id
                  ? 'border border-brand-500/30 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                  <span>{c.level || 'intermédiaire'}</span>
                  {c.curriculumProgress && (
                    <span className="flex items-center gap-1 rounded bg-gray-200/60 px-1.5 py-0.5 dark:bg-gray-800">
                      <Award className="h-3 w-3 text-amber-500" />
                      {c.curriculumProgress.completedCount}/{c.curriculumProgress.totalLessons} validés
                    </span>
                  )}
                </div>
              </div>
              <span
                onClick={(e) => removeConversation(c._id, e)}
                className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                aria-label="Supprimer"
                role="button"
              >
                <Trash2 className="h-4 w-4" />
              </span>
            </button>
          ))
        ) : (
          <p className="p-3 text-sm text-gray-500">Aucune séance enregistrée.</p>
        )}
      </div>

      {/* Institutional credentials badge */}
      <div className="border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p className="font-semibold text-gray-700 dark:text-gray-200">Chaire de Trading Agréée</p>
        <p className="mt-0.5 text-[11px]">SMC • ICT • Wyckoff • Risk Asymétrique</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-72 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block shadow-sm">
        {Sidebar}
      </aside>

      {/* Sidebar drawer (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 shadow-xl">{Sidebar}</aside>
        </div>
      )}

      {/* Main Study & Chat Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-800 gap-2">
          <div className="flex items-center gap-2">
            <button className="lg:hidden p-1 text-gray-600 dark:text-gray-300" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Professeur Agrégé en Trading</span>
              <span className="hidden sm:inline-block ml-2 text-xs rounded-full bg-brand-100 dark:bg-brand-950 px-2 py-0.5 text-brand-700 dark:text-brand-300 font-medium">
                IA Spécialiste
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Curriculum Progress Toggle */}
            <button
              onClick={() => setCurriculumTabOpen(!curriculumTabOpen)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                curriculumTabOpen
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Cursus</span>
              {currentLesson && (
                <span className="rounded bg-black/20 px-1 text-[10px]">
                  {active?.curriculum?.filter((l) => l.status === 'completed').length || 0}/{active?.curriculum?.length || 0}
                </span>
              )}
            </button>

            {/* Voice Mute / Speak Toggle */}
            <button
              onClick={() => {
                if (speaking) cancelSpeech();
                setVoiceEnabled(!voiceEnabled);
              }}
              title={voiceEnabled ? 'Désactiver la voix de l\'IA' : 'Activer la réponse vocale de l\'IA'}
              className={`rounded-lg p-1.5 transition ${
                voiceEnabled
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
              }`}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Hands-Free Voice Mode */}
            {speechSupported && (
              <button
                onClick={toggleHandsFree}
                title={handsFree ? 'Mode mains libres actif (l\'IA écoute en continu)' : 'Activer le mode mains libres'}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  handsFree
                    ? 'bg-red-500 text-white animate-pulse shadow-sm'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mains libres</span>
              </button>
            )}

            {/* Student Level Select */}
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Active Lesson & Exercise Header Banner */}
        {currentLesson && (
          <div className="border-b border-gray-200 bg-gradient-to-r from-brand-50/70 via-indigo-50/40 to-transparent p-3 dark:border-gray-800 dark:from-brand-950/30 dark:via-indigo-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                    Module Actuel
                  </span>
                  {currentLesson.status === 'completed' ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle className="h-3 w-3" /> Validé ({currentLesson.submission?.score}/100)
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      En cours d'étude
                    </span>
                  )}
                </div>
                <h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                  {currentLesson.title}
                </h3>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {currentLesson.description}
                </p>
              </div>

              {currentLesson.exercise && (
                <button
                  onClick={() => setExerciseModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-brand-500 transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Devoir / Exercice</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Curriculum Drawer / Accordion */}
        {curriculumTabOpen && active?.curriculum?.length > 0 && (
          <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Programme d'études universitaire
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {active.curriculum.map((les, idx) => {
                const isSelected = active.activeLessonIndex === idx;
                const isLocked = les.status === 'locked';
                const isDone = les.status === 'completed';

                return (
                  <div
                    key={les.id}
                    onClick={() => !isLocked && handleSelectLesson(idx)}
                    className={`relative rounded-xl border p-3 transition ${
                      isSelected
                        ? 'border-brand-500 bg-white dark:bg-gray-900 shadow-md ring-2 ring-brand-500/20'
                        : isLocked
                        ? 'border-gray-200 bg-gray-100/60 opacity-60 dark:border-gray-800 dark:bg-gray-900/40 cursor-not-allowed'
                        : 'border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-400">Leçon {idx + 1}</span>
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : isLocked ? (
                        <Lock className="h-4 w-4 text-gray-400" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
                      )}
                    </div>
                    <p className="mt-1 font-bold text-xs line-clamp-1 text-gray-900 dark:text-gray-100">
                      {les.title}
                    </p>
                    {les.submission?.score !== undefined && les.submission?.score !== null && (
                      <p className="mt-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                        Score : {les.submission.score}/100
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {!active || !hasMessages ? (
            <div className="flex h-full flex-col items-center justify-center text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-accent-500 text-white shadow-lg">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-gray-900 dark:text-white">
                Chaire Académique de Trading & Finance
              </h2>
              <p className="mt-1.5 max-w-lg text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Formez-vous auprès d’un véritable professeur agrégé en trading institutionnel.
                Méthodologies certifiées SMC, ICT, Wyckoff et gestion de risque de fonds d'investissement.
              </p>

              {/* Suggestions grid */}
              <div className="mt-6 grid max-w-2xl gap-2.5 sm:grid-cols-2 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="group rounded-xl border border-gray-200 p-3.5 text-xs font-medium text-gray-700 transition hover:border-brand-500 hover:bg-brand-50/60 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-brand-950/30 shadow-sm"
                  >
                    <Sparkles className="mb-1.5 h-4 w-4 text-brand-500 transition-transform group-hover:scale-110" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border border-gray-200/60 dark:border-gray-700/60'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose-sm">{renderMarkdown(m.content)}</div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <Spinner className="h-4 w-4 text-brand-500" />
                <span>Le Professeur analyse votre requête selon les modèles institutionnels…</span>
              </div>
            </div>
          )}

          {speaking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                <Volume2 className="h-3.5 w-3.5" />
                <span>Le Professeur vous répond vocalement…</span>
              </div>
            </div>
          )}
        </div>

        {/* Input & Voice Composer */}
        <div className="border-t border-gray-200 p-3 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-end gap-2">
            {speechSupported && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                title={listening ? 'Arrêter le micro' : 'Parler au Professeur'}
                className={`rounded-xl p-3 transition shadow-sm ${
                  listening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-300'
                }`}
              >
                {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Posez votre question ou analysez un graphique avec le Professeur…"
              className="max-h-32 flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />

            <Button
              onClick={() => send()}
              loading={sending}
              disabled={!input.trim()}
              className="!px-4 !py-2.5 bg-brand-600 hover:bg-brand-500 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-brand-500" />
              Spécialisé rigoureusement dans le trading institutionnel & gestion des risques.
            </span>
            {handsFree && (
              <span className="text-red-500 font-semibold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                Mains libres actif : parlez librement
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Exercise Modal */}
      {exerciseModalOpen && currentLesson?.exercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="max-w-2xl w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b pb-3 dark:border-gray-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Évaluation Pratique du Professeur
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {currentLesson.title}
                </h3>
              </div>
              <button
                onClick={() => setExerciseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Exercise Question & Context */}
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Énoncé de l'exercice :
                </p>
                <p className="mt-1.5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {currentLesson.exercise.question}
                </p>

                {currentLesson.exercise.context && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 border-l-2 border-brand-500 pl-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Contexte : </span>
                    {currentLesson.exercise.context}
                  </div>
                )}
              </div>

              {/* Chart Illustration if present */}
              {currentLesson.chartIllustration && (
                <div className="rounded-xl bg-black/90 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                  <div className="text-[10px] text-gray-400 mb-1">// Schéma Technique du Professeur</div>
                  <pre>{currentLesson.chartIllustration.trim()}</pre>
                </div>
              )}

              {/* Last Submission Feedback if available */}
              {currentLesson.submission?.feedback && (
                <div className={`rounded-xl p-4 text-xs ${
                  currentLesson.submission.passed
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}>
                  <p className="font-bold flex items-center gap-1.5">
                    {currentLesson.submission.passed ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Note obtenue : {currentLesson.submission.score}/100 (Requis : {currentLesson.exercise.passingScore || 70}/100)
                  </p>
                  <div className="mt-2 leading-relaxed">
                    {renderMarkdown(currentLesson.submission.feedback)}
                  </div>
                </div>
              )}

              {/* Student Answer Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Votre Démonstration & Réponse :
                </label>
                <textarea
                  value={exerciseAnswer}
                  onChange={(e) => setExerciseAnswer(e.target.value)}
                  rows={5}
                  placeholder="Rédigez votre analyse technique détaillée selon les critères institutionnels demandés…"
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Le Professeur notera la rigueur méthodologique, l'exactitude des concepts et la cohérence de votre plan.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-3 dark:border-gray-800">
              <Button variant="ghost" onClick={() => setExerciseModalOpen(false)}>
                Fermer
              </Button>
              <Button
                onClick={submitCurrentExercise}
                loading={evaluatingExercise}
                disabled={!exerciseAnswer.trim()}
                className="bg-brand-600 hover:bg-brand-500 text-white"
              >
                Soumettre au Professeur
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
