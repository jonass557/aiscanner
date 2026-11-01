import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X, Moon, Sun, ScanLine, Globe } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

/** Navigation bar for public landing page. */
export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();

  const navLinks = [
    { label: t('landingNavTools'), href: '#tools' },
    { label: t('landingNavFeatures'), href: '#features' },
    { label: t('landingNavHow'), href: '#how' },
    { label: t('landingNavPricing'), href: '#pricing' },
    { label: t('landingNavFaq'), href: '#faq' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <nav className="w-full flex items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 text-white">
            <ScanLine className="h-5 w-5" />
          </span>
          <span className="text-lg">AI Chart Scanner</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 transition hover:text-brand-600 dark:text-gray-300">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition shadow-sm"
            title="Changer de langue / Switch language"
          >
            <Globe className="h-3.5 w-3.5 text-brand-500" />
            <span>{lang === 'fr' ? 'EN 🇬🇧' : 'FR 🇫🇷'}</span>
          </button>

          <button onClick={toggleTheme} className="btn-ghost !px-2.5" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary">{t('dashboard')}</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">{t('login')}</Link>
              <a href="#pricing" className="btn-primary">{t('startFree')}</a>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full border-t border-slate-800 bg-slate-950/95 space-y-2 px-6 py-4 md:hidden"
        >
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
              {l.label}
            </a>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-bold"
            >
              <Globe className="h-3.5 w-3.5 text-brand-500" />
              <span>{lang === 'fr' ? 'Switch to English 🇬🇧' : 'Passer en Français 🇫🇷'}</span>
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <Link to="/login" className="btn-secondary flex-1 text-center">{t('login')}</Link>
            <a href="#pricing" onClick={() => setOpen(false)} className="btn-primary flex-1 text-center">{t('startFree')}</a>
          </div>
        </motion.div>
      )}
    </header>
  );
}
