import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Mic, Activity } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import AnimatedTradingRobotPreview from './AnimatedTradingRobotPreview.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Hero() {
  const { lang, t } = useLanguage();
  const isEn = lang === 'en';

  return (
    <section className="relative overflow-hidden pt-36 pb-24">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-20 right-1/4 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-4 w-4 text-cyan-400" /> {t('heroBadge')}
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mx-auto mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          {t('heroTitle1')}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            {t('heroTitleHighlight')}
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg"
        >
          {t('heroDesc')}
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#pricing"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-8 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:brightness-110 active:scale-95"
          >
            {t('heroCta')} <ArrowRight className="h-5 w-5" />
          </a>
          <Link
            to="/tools"
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-7 py-3.5 text-base font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800"
          >
            {isEn ? 'Discover all AI tools' : 'Découvrir tous les outils IA'}
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400"
        >
          <span className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> {isEn ? 'No credit card required' : 'Sans carte bancaire requise'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Zap className="h-4 w-4 text-cyan-400" /> {isEn ? 'Ultra-fast analysis < 2s' : 'Analyses ultra-rapides < 2s'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Mic className="h-4 w-4 text-indigo-400" /> {isEn ? 'Hands-free voice dialogue' : 'Dialogue vocal continu mains libres'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Activity className="h-4 w-4 text-amber-400" /> {isEn ? 'All markets: Forex, Crypto, Synthetics' : 'Tous marchés : Forex, Crypto, Synthetics'}
          </span>
        </motion.div>

        {/* Live Animated Trading Robot and Candlestick Chart */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mx-auto mt-14"
        >
          <AnimatedTradingRobotPreview isEn={isEn} />
        </motion.div>
      </div>
    </section>
  );
}
