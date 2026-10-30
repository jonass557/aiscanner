import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScanLine, Eye, Layers, Zap, Bot, BookOpen, MessageSquare,
  Radar, Cpu, Calculator, ClipboardCheck, GraduationCap, Mic,
  CalendarClock, History as HistoryIcon, CreditCard, Receipt, User as UserIcon,
  Settings as SettingsIcon, ShieldCheck, Search, Sparkles, BarChart2,
  LayoutGrid, ArrowRight, TrendingUp, Target, Gauge,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { analysisApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { decisionMeta, formatDate, marketLabel } from '../../utils/format.js';

const DECISION_COLORS = { BUY: '#22c55e', SELL: '#ef4444', WAIT: '#f59e0b', NO_TRADE: '#9ca3af' };

export default function Overview() {
  const { user, isAdmin } = useAuth();
  const { isEn, lang } = useLanguage();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('launcher'); // 'launcher' | 'analytics'

  useEffect(() => {
    analysisApi
      .stats()
      .then(({ data }) => setStats(data?.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Category definitions with colored circle buttons matching the reference UI
  const categories = useMemo(() => [
    {
      id: 'trading_analysis',
      titleFr: 'TRADING & ANALYSE DE MARCHÉ',
      titleEn: 'TRADING & MARKET ANALYSIS',
      items: [
        {
          id: 'scanner',
          labelFr: 'Scanner IA',
          labelEn: 'AI Scanner',
          to: '/dashboard/scanner',
          icon: ScanLine,
          bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
          shadow: 'shadow-blue-500/25',
        },
        {
          id: 'chart_vision',
          labelFr: 'Chart Vision',
          labelEn: 'Chart Vision',
          to: '/dashboard/chart-vision',
          icon: Eye,
          bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
          shadow: 'shadow-emerald-500/25',
        },
        {
          id: 'multi_tf',
          labelFr: 'Multi-Timeframe',
          labelEn: 'Multi-Timeframe',
          to: '/dashboard/multi-timeframe',
          icon: Layers,
          bg: 'bg-gradient-to-br from-purple-500 to-indigo-600',
          shadow: 'shadow-purple-500/25',
        },
        {
          id: 'backtesting',
          labelFr: 'Backtesting Replay',
          labelEn: 'Backtesting Replay',
          to: '/dashboard/backtesting',
          icon: Zap,
          bg: 'bg-gradient-to-br from-orange-500 to-amber-600',
          shadow: 'shadow-orange-500/25',
        },
        {
          id: 'opportunities',
          labelFr: 'Opportunités Live',
          labelEn: 'Live Opportunities',
          to: '/dashboard/opportunities',
          icon: Bot,
          bg: 'bg-gradient-to-br from-pink-500 to-rose-600',
          shadow: 'shadow-pink-500/25',
        },
        {
          id: 'journal',
          labelFr: 'Journal de Trading',
          labelEn: 'Trading Journal',
          to: '/dashboard/journal',
          icon: BookOpen,
          bg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
          shadow: 'shadow-teal-500/25',
        },
      ],
    },
    {
      id: 'assistant_ai',
      titleFr: 'ASSISTANT IA & GESTION INTELLIGENTE',
      titleEn: 'AI ASSISTANT & AUTOMATION',
      items: [
        {
          id: 'assistant',
          labelFr: 'Chat IA',
          labelEn: 'AI Chat',
          to: '/dashboard/assistant',
          icon: MessageSquare,
          bg: 'bg-gradient-to-br from-cyan-600 to-blue-600',
          shadow: 'shadow-cyan-600/25',
        },
        {
          id: 'delegate',
          labelFr: 'AI Delegate (Surveillance)',
          labelEn: 'AI Delegate (Watch)',
          to: '/dashboard/delegate',
          icon: Radar,
          bg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
          shadow: 'shadow-amber-500/25',
        },
        {
          id: 'managed',
          labelFr: 'AI Managed Trading',
          labelEn: 'AI Managed Trading',
          to: '/dashboard/managed-trading',
          icon: Cpu,
          bg: 'bg-gradient-to-br from-indigo-600 to-purple-700',
          shadow: 'shadow-indigo-600/25',
        },
        {
          id: 'calculator',
          labelFr: 'Calculateur de Lot',
          labelEn: 'Position Calculator',
          to: '/dashboard/calculator',
          icon: Calculator,
          bg: 'bg-gradient-to-br from-emerald-600 to-green-700',
          shadow: 'shadow-emerald-600/25',
        },
        {
          id: 'validator',
          labelFr: 'Validateur Trade',
          labelEn: 'Trade Validator',
          to: '/dashboard/trade-validator',
          icon: ClipboardCheck,
          bg: 'bg-gradient-to-br from-violet-600 to-purple-600',
          shadow: 'shadow-violet-600/25',
        },
        {
          id: 'mentor',
          labelFr: 'AI Mentor',
          labelEn: 'AI Mentor',
          to: '/dashboard/mentor',
          icon: GraduationCap,
          bg: 'bg-gradient-to-br from-fuchsia-600 to-pink-600',
          shadow: 'shadow-fuchsia-600/25',
        },
        {
          id: 'voice',
          labelFr: 'Assistant Vocal',
          labelEn: 'Voice Assistant',
          to: '/dashboard/voice-assistant',
          icon: Mic,
          bg: 'bg-gradient-to-br from-sky-500 to-blue-500',
          shadow: 'shadow-sky-500/25',
        },
      ],
    },
    {
      id: 'finances_news',
      titleFr: 'FINANCES & ABONNEMENTS',
      titleEn: 'FINANCES & SUBSCRIPTIONS',
      items: [
        {
          id: 'payment_history',
          labelFr: 'Historique des paiements',
          labelEn: 'Payment History',
          to: '/dashboard/subscription?tab=history',
          icon: HistoryIcon,
          bg: 'bg-gradient-to-br from-indigo-500 to-blue-600',
          shadow: 'shadow-indigo-500/25',
        },
        {
          id: 'invoices',
          labelFr: 'Factures',
          labelEn: 'Invoices',
          to: '/dashboard/subscription?tab=invoices',
          icon: Receipt,
          bg: 'bg-gradient-to-br from-blue-500 to-cyan-600',
          shadow: 'shadow-blue-500/25',
        },
        {
          id: 'subscription',
          labelFr: 'Souscriptions',
          labelEn: 'Subscriptions',
          to: '/dashboard/subscription',
          icon: CreditCard,
          bg: 'bg-gradient-to-br from-orange-500 to-amber-600',
          shadow: 'shadow-orange-500/25',
        },
        {
          id: 'news',
          labelFr: 'Actualités & News',
          labelEn: 'Economic News',
          to: '/dashboard/economic-news',
          icon: CalendarClock,
          bg: 'bg-gradient-to-br from-rose-500 to-red-600',
          shadow: 'shadow-rose-500/25',
        },
        {
          id: 'history',
          labelFr: 'Historique Scans',
          labelEn: 'Scan History',
          to: '/dashboard/history',
          icon: HistoryIcon,
          bg: 'bg-gradient-to-br from-purple-600 to-indigo-700',
          shadow: 'shadow-purple-600/25',
        },
      ],
    },
    {
      id: 'account_admin',
      titleFr: 'COMPTE & ADMINISTRATION',
      titleEn: 'ACCOUNT & ADMINISTRATION',
      items: [
        {
          id: 'profile',
          labelFr: 'Mon Profil',
          labelEn: 'My Profile',
          to: '/dashboard/profile',
          icon: UserIcon,
          bg: 'bg-gradient-to-br from-purple-600 to-indigo-600',
          shadow: 'shadow-purple-600/25',
        },
        {
          id: 'settings',
          labelFr: 'Paramètres',
          labelEn: 'Settings',
          to: '/dashboard/settings',
          icon: SettingsIcon,
          bg: 'bg-gradient-to-br from-slate-600 to-gray-700',
          shadow: 'shadow-slate-600/25',
        },
        ...(isAdmin
          ? [
              {
                id: 'admin',
                labelFr: 'Panneau Admin',
                labelEn: 'Admin Panel',
                to: '/admin',
                icon: ShieldCheck,
                bg: 'bg-gradient-to-br from-amber-500 to-yellow-500',
                shadow: 'shadow-amber-500/25',
              },
            ]
          : []),
      ],
    },
  ], [isAdmin]);

  // Filter categories and buttons by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.labelFr.toLowerCase().includes(q) ||
            item.labelEn.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

  if (loading) return <Spinner label="Initialisation de votre espace..." />;

  const sub = stats?.subscription || {};
  const remaining = sub.scansPerMonth === -1 ? '∞' : Math.max(0, (sub.scansPerMonth || 0) - (sub.scansUsed || 0));

  const kpis = [
    { label: isEn ? 'Total scans' : 'Total des scans', value: stats?.total ?? 0, icon: ScanLine, tone: 'purple' },
    { label: isEn ? 'Avg. confidence' : 'Confiance moyenne', value: `${stats?.avgConfidence ?? 0}%`, icon: Gauge, tone: 'blue' },
    { label: isEn ? 'Buy signals' : 'Signaux Achat', value: stats?.byDecision?.BUY ?? 0, icon: TrendingUp, tone: 'green' },
    { label: isEn ? 'Scans left' : 'Scans restants', value: remaining, icon: Target, tone: 'yellow' },
  ];

  const dailyMap = Object.fromEntries((stats?.dailyScans || []).map((d) => [d._id, d.count]));
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }), scans: dailyMap[key] || 0 };
  });

  const decisionData = Object.entries(stats?.byDecision || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
            {lang === 'fr' ? 'Bienvenue' : 'Welcome back'}
            {user?.firstName ? `, ${user.firstName}` : ''} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {lang === 'fr'
              ? 'Choisissez une fonctionnalité pour commencer votre session'
              : 'Select a feature below to begin your trading session'}
          </p>
        </div>

        {/* View Switcher: Hub vs Analytics */}
        <div className="flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveView('launcher')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeView === 'launcher'
                ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{lang === 'fr' ? 'Fonctionnalités' : 'Features Hub'}</span>
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeView === 'analytics'
                ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>{lang === 'fr' ? 'Statistiques' : 'Analytics'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: FEATURES LAUNCHER GRID (Exact Match to the Uploaded Mobile Reference) */}
      {activeView === 'launcher' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'fr' ? 'Rechercher une fonctionnalité (ex: Scanner, Délégué, Calculateur, Backtest...)' : 'Search any feature...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs sm:text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
          </div>

          {/* Categorized Sections */}
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                <h2 className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-gray-500 dark:text-gray-400">
                  {lang === 'fr' ? cat.titleFr : cat.titleEn}
                </h2>
              </div>

              {/* Grid of Circular Icon Buttons with Labels Underneath */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-6 gap-x-3 sm:gap-x-4">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.to)}
                      className="group flex flex-col items-center text-center focus:outline-none transition-transform active:scale-95"
                    >
                      {/* Circular Colored Button */}
                      <div
                        className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white shadow-md ${item.bg} ${item.shadow} group-hover:scale-105 transition-all duration-200`}
                      >
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.2]" />
                      </div>

                      {/* Text Label Below */}
                      <span className="mt-2 text-[11px] sm:text-xs font-semibold text-gray-800 dark:text-gray-200 max-w-[85px] sm:max-w-[105px] line-clamp-2 leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {lang === 'fr' ? item.labelFr : item.labelEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="p-8 text-center text-xs text-gray-500">
              {lang === 'fr' ? 'Aucune fonctionnalité ne correspond à votre recherche.' : 'No features found.'}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ANALYTICS & RECENT SCANS */}
      {activeView === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{k.label}</span>
                  <Badge tone={k.tone}>
                    <k.icon className="h-3.5 w-3.5" />
                  </Badge>
                </div>
                <p className="mt-2 text-2xl sm:text-3xl font-bold">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Activity chart */}
            <div className="card p-6 lg:col-span-2">
              <h3 className="font-semibold text-sm">{lang === 'fr' ? 'Activité des 7 derniers jours' : 'Activity (last 7 days)'}</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={days}>
                    <defs>
                      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1f2937', color: '#fff' }} />
                    <Area type="monotone" dataKey="scans" stroke="#6366f1" strokeWidth={2} fill="url(#g)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Decision split */}
            <div className="card p-6">
              <h3 className="font-semibold text-sm">{lang === 'fr' ? 'Répartition des décisions' : 'Decision split'}</h3>
              {decisionData.length ? (
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {decisionData.map((d) => (
                          <Cell key={d.name} fill={DECISION_COLORS[d.name] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', background: '#1f2937', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-6 text-xs text-gray-500">
                  {lang === 'fr' ? 'Aucun scan pour le moment.' : 'No scans yet — run your first analysis!'}
                </p>
              )}
            </div>
          </div>

          {/* Recent analyses */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{lang === 'fr' ? 'Analyses récentes' : 'Recent analyses'}</h3>
              <Link to="/dashboard/history" className="flex items-center gap-1 text-xs text-brand-600 hover:underline font-bold">
                {lang === 'fr' ? 'Voir tout' : 'View all'} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {stats?.recent?.length ? (
              <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
                {stats.recent.map((a) => {
                  const meta = decisionMeta(a.decision);
                  return (
                    <Link
                      key={a._id}
                      to={`/dashboard/history/${a._id}`}
                      className="flex items-center justify-between py-3 transition hover:opacity-80"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${meta.bg}`} />
                        <div>
                          <p className="text-sm font-medium">{a.symbol} · {a.timeframe}</p>
                          <p className="text-xs text-gray-500">{marketLabel(a.market)} · {formatDate(a.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <p className="mt-1 text-xs text-gray-500">{a.confidenceScore}%</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center py-8 text-center">
                <Sparkles className="h-10 w-10 text-brand-400" />
                <p className="mt-3 text-xs text-gray-500">{lang === 'fr' ? 'Aucune analyse encore effectuée.' : 'No analyses yet.'}</p>
                <Link to="/dashboard/scanner" className="btn-primary mt-4 text-xs">
                  {lang === 'fr' ? 'Lancer un premier scan' : 'Run first scan'}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
