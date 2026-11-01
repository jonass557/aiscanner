import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

/** Final call-to-action band before the footer. */
export default function CTA() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  return (
    <section className="py-20 bg-slate-950">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/80 px-8 py-16 text-center shadow-2xl backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <span className="relative inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            {isEn ? 'START TODAY FOR FREE' : 'DÉMARREZ AUJOURD’HUI GRATUITEMENT'}
          </span>

          <h2 className="relative mt-4 text-3xl font-black text-white sm:text-5xl tracking-tight">
            {isEn ? 'Ready to Dominate Your Next Trade?' : 'Prêt à Dominer Votre Prochain Trade ?'}
          </h2>

          <p className="relative mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-300">
            {isEn
              ? 'Join thousands of traders using next-generation AI. 7-day free trial on the 1-Month Plan, 100% unlimited scans, no credit card required.'
              : 'Rejoignez les traders qui surperforment les marchés grâce à l’IA. Essai gratuit de 7 jours sur le Plan 1 Mois, scans 100% illimités, sans carte bancaire.'}
          </p>

          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register?plan=1mois&join=true"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-8 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:brightness-110 active:scale-95"
            >
              {isEn ? 'Start 7-Day Free Trial' : 'Démarrer l’Essai Gratuit 7 Jours'} <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/tools"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800"
            >
              {isEn ? 'Explore All 11 Tools' : 'Découvrir les 11 Outils IA'}
            </Link>
          </div>

          <div className="relative mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{isEn ? 'Zero commitment · Instant setup · Cancel anytime' : 'Zéro engagement · Configuration immédiate · Annulable à tout moment'}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
