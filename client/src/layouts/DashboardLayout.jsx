import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, History, CreditCard, User, Settings,
  Menu, X, LogOut, Moon, Sun, ShieldCheck, Layers, Radar, GraduationCap,
  CalendarClock, Mic, ClipboardCheck, Bot, BookOpen, Zap, Globe, Eye, Calculator, Cpu,
  ArrowLeft, Share2, Crown, Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
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
  const { theme, toggleTheme } = useTheme();
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
    <div className="flex h-full flex-col overflow-hidden">
      <Link to="/" className="flex shrink-0 items-center gap-2 px-6 py-5 font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
          <ScanLine className="h-5 w-5" />
        </span>
        <span>AI Scanner</span>
      </Link>

      <nav className="flex-1 min-h-0 space-y-1 px-3 pb-4 overflow-y-auto overscroll-contain">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.key)}
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

      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Scans</span>
            <Badge tone="purple">{remaining}</Badge>
          </div>
          <p className="text-xs font-medium capitalize">{user?.subscription?.plan || 'free'} plan</p>
          <div className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] font-bold ${
            isExpiredCountdown
              ? 'bg-rose-500/15 text-rose-500'
              : isLifetime
              ? 'bg-amber-500/15 text-amber-500'
              : 'bg-emerald-500/15 text-emerald-500'
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
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </button>
      </div>
    </div>
  );

  const isBacktesting = location.pathname.startsWith('/dashboard/backtesting');

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sliding Drawer Menu (unfolds when toggled, rolls up automatically on navigation click) */}
      {open && (
        <div className="fixed inset-0 z-50 transition-opacity animate-fadeIn">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />
          {/* Sidebar Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900">
            <div className="relative h-full">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-4 top-5 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
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

      {/* Main Container - Takes 100% full screen width */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Bouton Retour Universel - Visible sur toutes les sous-pages */}
            {location.pathname !== '/dashboard' && (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 px-3 py-1.5 text-xs font-bold transition shadow-sm border border-brand-200 dark:border-brand-800"
                title={lang === 'fr' ? 'Retourner au menu principal des fonctionnalités' : 'Return to main features menu'}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{lang === 'fr' ? 'Menu Principal' : 'Main Menu'}</span>
                <span className="sm:hidden">{lang === 'fr' ? 'Retour' : 'Back'}</span>
              </button>
            )}

            {/* Menu Déroulant Button (Works on Desktop & Mobile, auto-rolls up when item clicked) */}
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              title={t('featuresMenu')}
            >
              <Menu className="h-4 w-4 text-brand-500" />
              <span className="hidden sm:inline">{t('featuresMenu')}</span>
            </button>

            {/* Quick logo badge - hidden on backtesting view to maximize space */}
            {!isBacktesting && (
              <Link to="/" className="flex items-center gap-2 font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white">
                  <ScanLine className="h-4 w-4" />
                </span>
                <span className="hidden md:inline font-black tracking-tight">AI Scanner</span>
              </Link>
            )}
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
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
              title="Changer de langue / Switch language"
            >
              <Globe className="h-3.5 w-3.5 text-brand-500" />
              <span>{lang === 'fr' ? 'EN 🇬🇧' : 'FR 🇫🇷'}</span>
            </button>

            <button onClick={toggleTheme} className="btn-ghost !px-2.5" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-sm">
                {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <span className="hidden text-sm font-semibold sm:block text-gray-800 dark:text-gray-200">
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
