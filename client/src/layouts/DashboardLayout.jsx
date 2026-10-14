import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ScanLine, History, CreditCard, User, Settings,
  Menu, X, LogOut, Moon, Sun, ShieldCheck, Layers, Radar, GraduationCap,
  CalendarClock, Mic, ClipboardCheck, Bot, BookOpen, Zap, Globe,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import VoiceAssistantButton from '../components/voice/VoiceAssistantButton.jsx';

const NAV_ITEMS = [
  { to: '/dashboard', key: 'overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/assistant', key: 'aiAssistant', icon: Bot },
  { to: '/dashboard/scanner', key: 'aiScanner', icon: ScanLine },
  { to: '/dashboard/multi-timeframe', key: 'multiTimeframe', icon: Layers },
  { to: '/dashboard/opportunities', key: 'opportunities', icon: Radar },
  { to: '/dashboard/journal', key: 'tradingJournal', icon: BookOpen },
  { to: '/dashboard/backtesting', key: 'backtesting', icon: Zap },
  { to: '/dashboard/mentor', key: 'aiMentor', icon: GraduationCap },
  { to: '/dashboard/trade-validator', key: 'tradeValidator', icon: ClipboardCheck },
  { to: '/dashboard/economic-news', key: 'economicNews', icon: CalendarClock },
  { to: '/dashboard/voice-assistant', key: 'voiceAssistant', icon: Mic },
  { to: '/dashboard/history', key: 'history', icon: History },
  { to: '/dashboard/subscription', key: 'subscription', icon: CreditCard },
  { to: '/dashboard/profile', key: 'profile', icon: User },
  { to: '/dashboard/settings', key: 'settings', icon: Settings },
];

/** Authenticated dashboard shell: responsive sidebar + top bar + outlet. */
export default function DashboardLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const remaining =
    user?.subscription?.plan === 'premium'
      ? '∞'
      : Math.max(0, (user?.subscription?.scansPerMonth || 0) - (user?.subscription?.scansUsed || 0));

  const SidebarInner = () => (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2 px-6 py-5 font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
          <ScanLine className="h-5 w-5" />
        </span>
        <span>AI Scanner</span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
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
        <div className="mb-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Scans</span>
            <Badge tone="purple">{remaining}</Badge>
          </div>
          <p className="mt-1 text-xs font-medium capitalize">{user?.subscription?.plan} plan</p>
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

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar - permanently fixed during page scroll */}
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block sticky top-0 h-screen overflow-y-auto">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-gray-900">
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
                {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <span className="hidden text-sm font-medium sm:block">
                {user?.firstName || user?.email?.split('@')[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <VoiceAssistantButton />
    </div>
  );
}
