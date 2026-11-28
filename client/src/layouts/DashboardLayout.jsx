import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, History, CreditCard, User, Settings,
  Menu, X, LogOut, ShieldCheck, Layers, Radar, GraduationCap,
  CalendarClock, Mic, ClipboardCheck, Bot, BookOpen, Zap, Globe, Eye, Calculator, Cpu,
  ArrowLeft, Share2, Crown, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import VoiceAssistantButton from '../components/voice/VoiceAssistantButton.jsx';

const NAV_ITEMS = [
  { to: '/dashboard', key: 'overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/chart-vision', key: 'chartVision', icon: Eye },
  { to: '/dashboard/opportunities', key: 'opportunities', icon: Bot },
  { to: '/dashboard/scanner', key: 'aiScanner', icon: ScanLine },
  { to: '/dashboard/assistant', key: 'aiAssistant', icon: Bot },
  { to: '/dashboard/multi-timeframe', key: 'multiTimeframe', icon: Layers },
  { to: '/dashboard/journal', key: 'tradingJournal', icon: BookOpen },
  { to: '/dashboard/backtesting', key: 'backtesting', icon: Zap },
  { to: '/dashboard/mentor', key: 'aiMentor', icon: GraduationCap },
  { to: '/dashboard/trade-validator', key: 'tradeValidator', icon: ClipboardCheck },
  { to: '/dashboard/calculator', key: 'positionCalculator', icon: Calculator },
  { to: '/dashboard/managed-trading', key: 'managedTrading', icon: Cpu },
  { to: '/dashboard/delegate', key: 'tradingDelegate', icon: Radar },
  { to: '/dashboard/economic-news', key: 'economicNews', icon: CalendarClock },
  { to: '/dashboard/voice-assistant', key: 'voiceAssistant', icon: Mic },
  { to: '/dashboard/history', key: 'history', icon: History },
  { to: '/dashboard/subscription', key: 'subscription', icon: CreditCard },
  { to: '/dashboard/profile', key: 'profile', icon: User },
  { to: '/dashboard/settings', key: 'settings', icon: Settings },
];

/** Authenticated dashboard shell: responsive sidebar + top bar + outlet. */
export default function DashboardLayout() {
  const { user, logout, isAdmin, freeTrialEnabled, canScan } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isLifetime =
    isAdmin ||
    (user?.partnership?.isActive && user?.partnership?.status === 'active' && user?.partnership?.lifetimeAccess) ||
    user?.subscription?.plan === 'partner_lifetime';

  const targetEndDate = user?.subscription?.endDate || (user?.trial?.isActive ? user?.trial?.endsAt : null);
  const diffMs = targetEndDate ? new Date(targetEndDate).getTime() - nowMs : 0;

  let countdownText = '';
  let isExpiredCountdown = false;
  if (isLifetime) {
    countdownText = lang === 'fr' ? 'Accès à Vie ∞' : 'Lifetime ∞';
  } else if (!targetEndDate || diffMs <= 0 || !canScan) {
    isExpiredCountdown = true;
    countdownText = lang === 'fr' ? 'Expiré' : 'Expired';
  } else {
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    const dUnit = lang === 'fr' ? 'j' : 'd';
    countdownText = `${days}${dUnit} ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const isSubscriptionAllowedRoute =
    location.pathname.startsWith('/dashboard/subscription') ||
    location.pathname.startsWith('/dashboard/profile');
  const requiresSubscription = Boolean(user && !isLifetime && !canScan);

  useEffect(() => {
    if (requiresSubscription && !isSubscriptionAllowedRoute) {
      navigate('/dashboard/subscription', { replace: true });
    }
  }, [requiresSubscription, isSubscriptionAllowedRoute, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const remaining =
    user?.subscription?.plan === 'premium' ||
    user?.subscription?.scansPerMonth === -1 ||
    (user?.partnership?.isActive && user?.partnership?.lifetimeAccess)
      ? '∞'
      : Math.max(0, (user?.subscription?.scansPerMonth || 0) - (user?.subscription?.scansUsed || 0));

  const SidebarInner = () => (
    <div className="flex h-full flex-col overflow-hidden bg-[#0B1124] text-slate-200">
      <Link to="/dashboard" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-3 px-5 py-5 border-b border-[#1E2B4E]/80">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-emerald-400 text-white shadow-lg shadow-cyan-500/20">
          <ScanLine className="h-5 w-5" />
        </span>
        <div>
          <div className="text-lg font-black tracking-tight leading-none">
            <span className="text-white">AI</span>
            <span className="text-emerald-400">Scanner</span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide mt-0.5">Scan · Analyse · Trade</p>
        </div>
      </Link>

      <nav className="flex-1 min-h-0 space-y-1 px-3 py-3 pb-4 overflow-y-auto overscroll-contain">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:bg-[#131C3A] hover:text-white'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(item.key)}</span>
            {item.key === 'aiAssistant' && (
              <span className="ml-auto rounded-md bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                NEW
              </span>
            )}
          </NavLink>
        ))}
        <NavLink
          to="/dashboard/partner"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold'
                : 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
            }`
          }
        >
          <Crown className="h-4 w-4 text-amber-400" />
          <span>
            {lang === 'en'
              ? (user?.partnership?.isActive ? 'Partner Space' : 'Become a Partner')
              : (user?.partnership?.isActive ? 'Espace Partenaire' : 'Devenir Partenaire')}
          </span>
          {user?.partnership?.isActive ? (
            <span className="ml-auto rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              VIP
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              30%
            </span>
          )}
        </NavLink>
        {user?.referral?.enabled && (
          <NavLink
            to="/dashboard/referral"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold'
                  : 'text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300'
              }`
            }
          >
            <Share2 className="h-4 w-4 text-cyan-400" />
            <span>Parrainage</span>
            <span className="ml-auto rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
              20%
            </span>
          </NavLink>
        )}
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-950/30"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Panel
          </NavLink>
        )}
      </nav>

      <div className="shrink-0 border-t border-[#1E2B4E] p-3.5 space-y-2.5 bg-[#080D1D]">
        {!isLifetime && (
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-[#121C3D] to-[#0D142B] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-white leading-tight">Trade Smarter with AI</span>
              <Badge tone="purple">{remaining}</Badge>
            </div>
            <Link
              to="/dashboard/subscription"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-400 px-3 py-2 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Passer Premium' : 'Upgrade Now'}</span>
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-[#1E2B4E] bg-[#0D142B] p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-black text-white">
              {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] font-semibold capitalize text-amber-400">
                {user?.subscription?.plan || 'free'} plan
              </p>
            </div>
          </div>
          <div className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-bold ${
            isExpiredCountdown
              ? 'bg-rose-500/15 text-rose-400'
              : isLifetime
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-emerald-500/15 text-emerald-400'
          }`}>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lang === 'fr' ? 'Expiration' : 'Expires'}
            </span>
            <span className="font-mono tabular-nums">{countdownText}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-[#131C3A] hover:text-white transition"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  );

  const isBacktesting = location.pathname.startsWith('/dashboard/backtesting');

  return (
    <div className="flex min-h-screen bg-[#070B1A] text-slate-100">
      {/* Persistent Desktop Left Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col border-r border-[#1E2B4E] bg-[#0B1124]">
        <SidebarInner />
      </aside>

      {/* Mobile Sliding Drawer Menu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden transition-opacity animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-[#1E2B4E] bg-[#0B1124] shadow-2xl">
            <div className="relative h-full">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-5 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title={t('close')}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarInner />
            </div>
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1E2B4E] bg-[#0B1124]/95 px-4 py-2.5 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden flex items-center gap-1.5 rounded-xl border border-[#1E2B4E] bg-[#101730] px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-[#182246]"
              title={t('featuresMenu')}
            >
              <Menu className="h-4 w-4 text-emerald-400" />
            </button>

            {location.pathname !== '/dashboard' && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 px-3 py-1.5 text-xs font-bold transition border border-indigo-500/30"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{lang === 'fr' ? 'Dashboard' : 'Dashboard'}</span>
              </button>
            )}

            {/* Market Live Ticker Bar (matching screenshot) */}
            <div className="hidden xl:flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Market Live
              </span>
              <span className="text-slate-300 font-mono">EURUSD <strong className="text-white">1.0874</strong> <span className="text-emerald-400">+0.24%</span></span>
              <span className="text-slate-300 font-mono">GBPUSD <strong className="text-white">1.2698</strong> <span className="text-emerald-400">+0.18%</span></span>
              <span className="text-slate-300 font-mono">USDJPY <strong className="text-white">154.32</strong> <span className="text-rose-400">-0.12%</span></span>
              <span className="text-slate-300 font-mono">XAUUSD <strong className="text-white">2,658.50</strong> <span className="text-emerald-400">+0.36%</span></span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Subscription Countdown Pill */}
            <Link
              to="/dashboard/subscription"
              title={lang === 'fr' ? 'Temps restant avant expiration de votre abonnement' : 'Remaining time before subscription expiration'}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition shadow-sm ${
                isExpiredCountdown
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse'
                  : isLifetime
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono tabular-nums">{countdownText}</span>
            </Link>

            {/* Language Switcher Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E2B4E] bg-[#101730] px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#182246] transition shadow-sm"
              title="Changer de langue / Switch language"
            >
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              <span>{lang === 'fr' ? 'EN 🇬🇧' : 'FR 🇫🇷'}</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-white shadow-sm">
                {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <span className="hidden text-sm font-semibold sm:block text-slate-200">
                {user?.firstName || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        <main className={`flex-1 w-full max-w-full ${isBacktesting ? 'p-0 overflow-hidden' : 'p-3 sm:p-5 lg:p-6'}`}>
          {requiresSubscription && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
              {!freeTrialEnabled
                ? (lang === 'fr'
                    ? 'L’essai gratuit est actuellement désactivé. Veuillez souscrire à un abonnement pour accéder aux fonctionnalités de la plateforme.'
                    : 'Free trial is currently disabled. Please subscribe to a plan to access the platform features.')
                : (lang === 'fr'
                    ? 'Votre abonnement ou période d’essai est expiré. Veuillez renouveler votre abonnement pour continuer.'
                    : 'Your subscription or free trial has expired. Please renew your subscription to continue.')}
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <VoiceAssistantButton />
    </div>
  );
}
