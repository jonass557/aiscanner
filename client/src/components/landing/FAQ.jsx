import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

const FAQS_FR = [
  {
    q: 'Comment fonctionne l’essai gratuit ?',
    a: 'L’essai gratuit est disponible sur le Plan 1 Mois sans carte bancaire requise. Vous bénéficiez d’un accès complet à tous les outils IA avec un nombre illimité de scans pendant toute la durée de l’essai.',
  },
  {
    q: 'Quelle est la précision des analyses et du Robot de Trading ?',
    a: 'Nos algorithmes appliquent rigoureusement les concepts Smart Money (SMC/ICT) : repérage des sweeps de liquidité, Fair Value Gaps (FVG) et Order Blocks institutionnels. Un score de probabilité est calculé pour chaque trade, et les signaux sont émis uniquement au-delà d’un ratio Risque/Rendement favorable.',
  },
  {
    q: 'Quels marchés sont pris en charge ?',
    a: 'Tous les marchés majeurs : Forex (majeures et mineures), Métaux (Or XAU/USD, Argent), Indices boursiers (NAS100, US30, SPX500, DAX40), Crypto-monnaies (BTC, ETH, SOL) et Indices Synthétiques Deriv (Volatility 75, Boom 1000, Crash 1000, Step Index).',
  },
  {
    q: 'Comment s’effectuent les paiements après la période d’essai ?',
    a: 'Les paiements sont gérés de façon ultra sécurisée via iKeePay. Vous pouvez payer en Mobile Money (Wave, Orange Money, MTN, Moov) ou par carte bancaire. Les clés et options de paiement sont configurées directement par l’administration.',
  },
  {
    q: 'Puis-je utiliser la plateforme sur téléphone portable ?',
    a: 'Absolument. Toute la plateforme, y compris le terminal de trading interactif, le backtesting replay et le copilote vocal, est 100% optimisée pour smartphones (iPhone et Android) avec une ergonomie tactile native.',
  },
  {
    q: 'Puis-je intégrer mes propres stratégies personnalisées ?',
    a: 'Oui ! Vous pouvez enregistrer vos stratégies personnelles avec vos propres timeframes, indicateurs et règles de gestion des risques. Le robot et l’IA s’adaptent à vos règles à la lettre sans rien inventer.',
  },
];

const FAQS_EN = [
  {
    q: 'How does the free trial work?',
    a: 'The free trial is available immediately on the 1-Month Plan with no credit card required. You get full access to all 11 AI tools with unlimited scans during the entire trial period.',
  },
  {
    q: 'How accurate is the AI Trading Robot and Analysis?',
    a: 'Our models rigorously apply institutional Smart Money Concepts (SMC/ICT) : liquidity sweeps, Fair Value Gaps, and unmitigated Order Blocks. Signals are emitted only with high confidence scores and favorable Risk/Reward ratios.',
  },
  {
    q: 'Which markets and asset classes are supported?',
    a: 'All major financial markets: Forex (majors and crosses), Metals (Gold XAU/USD, Silver), Indices (NAS100, US30, SPX500, DAX40), Crypto (BTC, ETH, SOL), and Deriv Synthetic Indices (Volatility 75, Boom, Crash).',
  },
  {
    q: 'How do payments work after the free trial?',
    a: 'Payments are securely processed via iKeePay supporting Mobile Money (Wave, Orange, MTN, Moov) and debit/credit cards with instant activation.',
  },
  {
    q: 'Can I use the platform on mobile devices?',
    a: 'Yes. The entire platform, including interactive candlestick charts, backtest replay, and hands-free voice copilot, is fully responsive on iOS and Android.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const faqs = isEn ? FAQS_EN : FAQS_FR;

  return (
    <section id="faq" className="relative py-24 bg-slate-950 border-t border-slate-900 overflow-hidden">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
            {isEn ? 'COMMON QUESTIONS' : 'QUESTIONS FRÉQUENTES'}
          </span>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            {isEn ? 'Frequently Asked Questions' : 'Tout Ce Que Vous Devez Savoir'}
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            {isEn ? 'Clear answers to get you started with confidence.' : 'Des réponses transparentes pour démarrer en toute sérénité.'}
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl overflow-hidden transition hover:border-slate-700"
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-white transition hover:text-cyan-300"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-cyan-400 transition-transform duration-300 ${
                    open === i ? 'rotate-180 text-cyan-300' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-800/60"
                  >
                    <p className="p-5 text-xs leading-relaxed text-slate-300">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
