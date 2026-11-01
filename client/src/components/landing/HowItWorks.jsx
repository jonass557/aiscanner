import { motion } from 'framer-motion';
import { Bot, ScanLine, Target, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

const STEPS_FR = [
  {
    icon: ScanLine,
    step: 'Étape 1',
    title: 'Détection ou Capture Graphique',
    desc: 'Laissez le Robot scanner les flux en direct ou glissez une capture TradingView/MT5. Reconnaissance automatique du marché et timeframe.',
  },
  {
    icon: Bot,
    step: 'Étape 2',
    title: 'Analyse Algorithmique SMC',
    desc: 'L’IA décode instantanément la liquidité, Order Blocks, Fair Value Gaps et cassures de structure pour isoler les opportunités à haute probabilité.',
  },
  {
    icon: Target,
    step: 'Étape 3',
    title: 'Plan de Trade & Exécution',
    desc: 'Recevez un plan millimétré (Entrée, Stop Loss strict, Take Profits) avec ratio R:R calculé, ou activez l’automatisation sécurisée.',
  },
];

const STEPS_EN = [
  {
    icon: ScanLine,
    step: 'Step 1',
    title: 'Chart Detection or Upload',
    desc: 'Let the AI Robot scan live streams or drop any TradingView/MT5 screenshot. Automatic symbol and timeframe detection.',
  },
  {
    icon: Bot,
    step: 'Step 2',
    title: 'SMC Algorithmic Breakdown',
    desc: 'AI instantly identifies liquidity pools, Order Blocks, FVGs, and structural shifts to isolate institutional high-probability setups.',
  },
  {
    icon: Target,
    step: 'Step 3',
    title: 'Precision Trade Plan & Execution',
    desc: 'Get exact Entry, strict Stop Loss, and multiple Take Profits with optimized Risk-Reward ratio, or activate managed execution.',
  },
];

export default function HowItWorks() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const steps = isEn ? STEPS_EN : STEPS_FR;

  return (
    <section id="how" className="relative py-24 bg-slate-950 border-t border-slate-900 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            {isEn ? 'SIMPLE 3-STEP PROCESS' : 'FLUX DE TRAVAIL EN 3 ÉTAPES'}
          </span>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            {isEn ? 'From Market Scan to Winning Trade' : 'Du Scan au Trade Gagnant en 3 Étapes'}
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            {isEn
              ? 'Institutional accuracy in under 15 seconds, zero emotional bias.'
              : 'Une précision institutionnelle en moins de 15 secondes, sans aucune interférence émotionnelle.'}
          </p>
        </div>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-8 text-center backdrop-blur-xl shadow-lg hover:border-cyan-500/40 transition-all"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 text-cyan-300">
                  <Icon className="h-8 w-8" />
                </div>
                <span className="mt-5 inline-block text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                  {s.step}
                </span>
                <h3 className="mt-2 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
