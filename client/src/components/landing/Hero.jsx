import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Mic,
  Activity,
  Crown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { partnershipApi } from '../../services/endpoints.js';
import AnimatedTradingRobotPreview from './AnimatedTradingRobotPreview.jsx';
import PartnershipModal from '../partnership/PartnershipModal.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Hero() {
  const { lang, t } = useLanguage();
  const isEn = lang === 'en';

  const [partnerConfig, setPartnerConfig] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  const loadPartnerConfig = () => {
    partnershipApi
      .getConfig()
      .then(({ data }) => {
        const cfg = data?.data;
        if (cfg && cfg.isEnabled && !cfg.isDeleted) {
          setPartnerConfig(cfg);
        } else {
          setPartnerConfig(null);
        }
      })
      .catch(() => setPartnerConfig(null));
  };

  useEffect(() => {
    loadPartnerConfig();
  }, []);

  const hasPartnerSlide = Boolean(partnerConfig && partnerConfig.isEnabled && !partnerConfig.isDeleted);
  const slidesCount = hasPartnerSlide ? 2 : 1;

  // Auto-advance banner carousel
  useEffect(() => {
    if (!hasPartnerSlide || paused || partnerModalOpen) {
      setActiveSlide(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slidesCount);
    }, 5500);
    return () => clearInterval(timer);
  }, [hasPartnerSlide, paused, partnerModalOpen, slidesCount]);

  const currentSlide = hasPartnerSlide ? activeSlide : 0;

  return (
    <section className="relative overflow-hidden pt-32 pb-24">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-20 right-1/4 h-96 w-96 rounded-full bg-indigo-500/15 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-6 text-center">
        {/* Carousel Top Banner when Partnership is Active */}
        {hasPartnerSlide && (
          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="mx-auto mb-8 max-w-4xl relative"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/75 backdrop-blur-xl shadow-2xl">
              <AnimatePresence mode="wait">
                {currentSlide === 0 ? (
                  <motion.div
                    key="slide-platform"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r from-cyan-950/60 via-slate-900/90 to-indigo-950/60 text-left"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <Sparkles className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                          {t('heroBadge')}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {isEn
                            ? 'AI Chart Vision, Live Sentinel & Trading Robot — 100% Unlimited Scans'
                            : 'Chart Vision IA, Robot de Trading & Analyses Multi-Timeframe en direct'}
                        </p>
                      </div>
                    </div>
                    <a
                      href="#pricing"
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400 transition"
                    >
                      <span>{t('heroCta')}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </motion.div>
                ) : (
                  <motion.div
                    key="slide-partnership"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r from-amber-950/70 via-slate-900/95 to-orange-950/60 text-left border-l-4 border-amber-500"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25">
                        <Crown className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                            {partnerConfig.badgeText || 'Programme de Partenariat VIP'}
                          </span>
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {partnerConfig.spotsRemaining} / {partnerConfig.maxPartners} places restantes
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white mt-0.5">
                          Accès à Vie + {partnerConfig.commissionRate || 30}% de commission chaque mois à vie sur vos filleuls ({Number(partnerConfig.price || 0).toLocaleString('fr-FR')} {partnerConfig.currency || 'XOF'})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPartnerModalOpen(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 transition"
                    >
                      <span>Devenir Partenaire</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Carousel Controls */}
            <div className="mt-2.5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev - 1 + slidesCount) % slidesCount)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Slide précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                {[0, 1].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      currentSlide === idx
                        ? idx === 1
                          ? 'w-6 bg-amber-400'
                          : 'w-6 bg-cyan-400'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                    aria-label={`Aller à la diapositive ${idx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev + 1) % slidesCount)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Slide suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

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
          {hasPartnerSlide && (
            <button
              type="button"
              onClick={() => setPartnerModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-6 py-3.5 text-base font-bold text-amber-300 transition hover:bg-amber-500/25"
            >
              <Crown className="h-5 w-5 text-amber-400" />
              <span>Programme Partenaire ({partnerConfig.commissionRate || 30}%)</span>
            </button>
          )}
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
          {hasPartnerSlide && (
            <span className="flex items-center gap-1.5 text-amber-300">
              <CheckCircle2 className="h-4 w-4 text-amber-400" /> Paiement direct Mobile Money H2H
            </span>
          )}
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

      <PartnershipModal
        isOpen={partnerModalOpen}
        config={partnerConfig}
        onClose={() => setPartnerModalOpen(false)}
        onCompleted={loadPartnerConfig}
      />
    </section>
  );
}
