import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ScrollText, Cpu, Menu, LogOut, ArrowLeft, ShieldCheck, Moon, Sun, CreditCard, Layers, BarChart3, ChevronRight, Activity, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const NAV = [
  { to: '/admin', label: 'Vue Globale', icon: LayoutDashboard, end: true },
  { to: '/admin/analytics', label: 'Audience & Analytics', icon: BarChart3 },
  { to: '/admin/users', label: 'Utilisateurs & Essais', icon: Users },
  { to: '/admin/strategies', label: 'Stratégies & Moteur', icon: Layers },
  { to: '/admin/plans', label: 'Plans & Promotions', icon: CreditCard },
  { to: '/admin/reviews', label: 'Avis Clients', icon: MessageSquare },
  { to: '/admin/ai-config', label: 'IA & Paiements', icon: Cpu },
  { to: '/admin/logs', label: 'Logs Système & Audit', icon: ScrollText },
];

/** Admin executive layout with professional dark theme and high contrast navigation. */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const activeItem = NAV.find((n) => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)) || NAV[0];

  const SidebarInner = () => (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 shadow-lg shadow-brand-500/20 text-white font-black">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-base tracking-tight">AI Scanner</span>
            <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-400">
              Admin
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">Centre de Pilotage Système</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Supervision & Contrôle
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-slate-800/90 text-white font-semibold shadow-sm shadow-black/20 border-l-4 border-brand-500'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4 shrink-0 transition group-hover:scale-105" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition" />
          </NavLink>
        ))}
      </nav>

      {/* Admin User Footer Widget */}
      <div className="border-t border-slate-800/80 p-3 space-y-2 bg-slate-950/80">
        <div className="flex items-center gap-3 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-brand-400 font-bold text-sm">
            {(user?.firstName?.[0] || user?.email?.[0] || 'A').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email || 'Administrateur'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-slate-400 font-mono">Super Admin</span>
            </div>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-900 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'application
        </Link>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 transition"
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block sticky top-0 h-screen overflow-y-auto z-40 border-r border-slate-800/80 bg-slate-950 shadow-xl">
        <SidebarInner />
      </aside>

      {/* Mobile Sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-950 shadow-2xl">
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium hidden sm:inline">Administration</span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <activeItem.icon className="h-4 w-4 text-brand-500" />
                {activeItem.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <Activity className="h-3 w-3 animate-pulse" />
              <span>Système Opérationnel</span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
