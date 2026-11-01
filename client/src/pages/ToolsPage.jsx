import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Bot, ScanLine, Eye, ShieldCheck, Zap, Layers, PlayCircle, Mic,
  CheckCircle2, Calculator, BookOpen, ArrowRight, Sparkles, Activity,
  Cpu, Compass, ShieldAlert, BarChart3, ChevronRight, Lock
} from 'lucide-react';
import PublicNavbar from '../components/layout/PublicNavbar.jsx';
import PublicFooter from '../components/layout/PublicFooter.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ALL_TOOLS = [
  {
    id: 'robot-trading',
    name: 'Robot de Trading Haute Probabilité',
    nameEn: 'High-Probability AI Trading Robot',
    category: 'automation',
    badge: 'AUTOMATION ULTIME',
    icon: Bot,
    color: 'from-amber-500 to-orange-600',
    accentText: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    keywords: ['Signaux SMC Autonomes', 'SL & TP Automatiques', '92%+ Confiance Visée', 'Zéro Émotion'],
    desc: 'Scanne les marchés en continu selon les algorithmes Smart Money Concepts (SMC/ICT). Émet des signaux ultra précis avec entrée, Stop Loss et Take Profits millimétrés.',
    descEn: 'Continuously scans the markets using institutional SMC/ICT algorithms. Emits high-precision signals with exact Entry, Stop Loss, and Take Profits.',
    path: '/dashboard/robot',
    pro: true,
  },
  {
    id: 'scanner',
    name: 'AI Chart Scanner',
    nameEn: 'AI Chart Scanner',
    category: 'analysis',
    badge: 'VISION MULTIMODALE',
    icon: ScanLine,
    color: 'from-cyan-500 to-blue-600',
    accentText: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    keywords: ['Analyse < 2s', 'Détection Order Blocks', 'Fair Value Gaps (FVG)', 'Verdict Buy/Sell Direct'],
    desc: "Glissez n'importe quelle capture d'écran de TradingView, MT4/MT5 ou Deriv. L'IA déchiffre immédiatement la structure, les zones de liquidité et calcule votre plan de trade.",
    descEn: 'Drop any screenshot from TradingView, MT4/MT5 or Deriv. AI instantly decodes market structure, liquidity pools, and generates your complete trade plan.',
    path: '/dashboard',
    pro: false,
  },
  {
    id: 'chart-vision',
    name: 'Chart Vision Studio',
    nameEn: 'Chart Vision Studio',
    category: 'analysis',
    badge: 'GRAPHIQUE INTERACTIF',
    icon: Eye,
    color: 'from-emerald-500 to-teal-600',
    accentText: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    keywords: ['Flux Institutionnel Live', 'Traçage Auto des Zones', 'Multi-Paires Illimité', 'Lightweight Charts v5'],
    desc: 'Un terminal de trading haute performance affichant les bougies authentiques, zones Supply/Demand automatiques et confluences stratégiques en temps réel.',
    descEn: 'High-performance trading terminal with authentic candlestick rendering, automatic Supply/Demand zones, and real-time strategic confluences.',
    path: '/dashboard/chart-vision',
    pro: false,
  },
  {
    id: 'managed-trading',
    name: 'AI Managed Trading (Gestion d’Ordres)',
    nameEn: 'AI Managed Trading',
    category: 'automation',
    badge: 'GESTION DE POSITION',
    icon: Cpu,
    color: 'from-purple-500 to-indigo-600',
    accentText: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    keywords: ['Connexion Broker API', 'Trailing Stop Dynamique', 'Take Profit Partiel', 'Sécurisation Automatique'],
    desc: "Confiez l'exécution et la protection de vos positions à un algorithme intelligent. Gestion stricte du risque, déplacement automatique du Stop Loss à Breakeven.",
    descEn: 'Entrust execution and risk mitigation to an intelligent algorithm. Dynamic trailing stop, partial take-profits, and automatic Breakeven protection.',
    path: '/dashboard/managed-trading',
    pro: true,
  },
  {
    id: 'trading-delegate',
    name: 'IA Trading Delegate (Surveillance Autonome)',
    nameEn: 'AI Trading Delegate',
    category: 'automation',
    badge: 'SENTINELLE 24/7',
    icon: Compass,
    color: 'from-pink-500 to-rose-600',
    accentText: 'text-pink-400',
    borderColor: 'border-pink-500/30',
    keywords: ['Surveillance Marché 24/7', 'Alertes Instantanées', 'Filtre Haute Probabilité', 'Mode Passif Sécurisé'],
    desc: 'Laissez votre sentinelle IA surveiller les marchés à votre place pendant que vous travaillez ou dormez. Notification immédiate dès validation de votre configuration.',
    descEn: 'Let your AI sentinel watch the markets while you work or sleep. Instant alert as soon as your institutional criteria are met.',
    path: '/dashboard/delegate',
    pro: true,
  },
  {
    id: 'multi-timeframe',
    name: 'Multi-Timeframe Confluence Scanner',
    nameEn: 'Multi-Timeframe Scanner',
    category: 'analysis',
    badge: 'TRIPLE CONFLUENCE',
    icon: Layers,
    color: 'from-indigo-500 to-cyan-600',
    accentText: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    keywords: ['Croisement D1 · H4 · H1 · M15', 'Score Global Pondéré', 'Zéro Contre-Tendance', 'Précision Optimale'],
    desc: "Valide l'alignement des tendances macro avec les points d'entrée micro. Élimine 80% des pièges de marché et des faux départs en filtrant par confluences strictes.",
    descEn: 'Validates macro trend alignment with micro execution triggers. Eliminates 80% of fakeouts and false breakouts through multi-period confluence.',
    path: '/dashboard/multi-timeframe',
    pro: false,
  },
  {
    id: 'backtesting',
    name: 'Backtesting Replay Studio',
    nameEn: 'Backtesting Studio',
    category: 'analysis',
    badge: 'REPLAY TICK-PAR-TICK',
    icon: PlayCircle,
    color: 'from-blue-500 to-teal-500',
    accentText: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    keywords: ['Outil Cut Avancé', 'Historique Multi-Années', 'Replay Fluide', 'Statistiques de Winrate'],
    desc: "Testez et validez vos stratégies sur des années d'historique de marché. Découpez le graphique à n'importe quelle date, simulez vos trades et mesurez votre rentabilité.",
    descEn: 'Backtest and refine your strategies over years of market data. Cut the chart at any historical candle, play back price action, and measure exact winrate.',
    path: '/dashboard/backtesting',
    pro: false,
  },
  {
    id: 'copilote-vocal',
    name: 'IA Mentor & Copilote Vocal Mains Libres',
    nameEn: 'Voice AI Mentor & Copilot',
    category: 'risk',
    badge: 'MAINS LIBRES CONTINU',
    icon: Mic,
    color: 'from-emerald-400 to-cyan-500',
    accentText: 'text-emerald-300',
    borderColor: 'border-emerald-500/30',
    keywords: ['Dialogue Vocal Continu', 'Bilingue Français / Anglais', 'Débriefing Psychologique', 'Explications SMC Directes'],
    desc: "Dialoguez oralement avec votre copilote pendant que vous observez vos écrans. Posez vos questions à voix haute et recevez une analyse vocale claire sans quitter les graphiques.",
    descEn: 'Hands-free voice dialogue with your AI mentor. Ask verbal questions about chart structure and get instant spoken reasoning while keeping your hands on the desk.',
    path: '/dashboard/assistant',
    pro: false,
  },
  {
    id: 'trade-validator',
    name: 'Validateur de Trade IA',
    nameEn: 'AI Trade Validator',
    category: 'risk',
    badge: 'GARDE-FOU ANTI-FOMO',
    icon: ShieldCheck,
    color: 'from-rose-500 to-amber-600',
    accentText: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    keywords: ['Score de Viabilité', 'Filtre Anti-FOMO', 'Checklist SMC Rigoureuse', 'Verdict Autorisé / Refusé'],
    desc: 'Passez chaque trade au crible avant de cliquer sur votre broker. L’IA vérifie si votre configuration respecte les règles strictes de rentabilité et vous évite les pertes évitables.',
    descEn: 'Scan every setup before placing orders on your broker. Objective pre-trade audit ensuring your setup strictly respects institutional criteria.',
    path: '/dashboard/validator',
    pro: false,
  },
  {
    id: 'position-calculator',
    name: 'Calculateur de Position & Risque Prop Firm',
    nameEn: 'Position Size & Risk Calculator',
    category: 'risk',
    badge: 'GESTION DE CAPITAL',
    icon: Calculator,
    color: 'from-teal-500 to-emerald-600',
    accentText: 'text-teal-400',
    borderColor: 'border-teal-500/30',
    keywords: ['Taille de Lot Précise', 'Règles Prop Firm Respectées', 'Calcul de Perte Maximum', 'Tous Instruments'],
    desc: 'Calculez instantanément le lot exact à ouvrir selon votre capital, votre pourcentage de risque (0.5% ou 1%) et la distance de votre Stop Loss. Indispensable pour challenges Prop Firm.',
    descEn: 'Instantly calculate your exact lot size according to capital, risk percentage (0.5% - 1%), and Stop Loss distance. Critical for passing Prop Firm challenges.',
    path: '/dashboard/calculator',
    pro: false,
  },
  {
    id: 'trading-journal',
    name: 'Journal de Trading & Statistiques Intelligentes',
    nameEn: 'Smart Trading Journal',
    category: 'risk',
    badge: 'SUIVI DE PERFORMANCE',
    icon: BookOpen,
    color: 'from-indigo-500 to-purple-600',
    accentText: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    keywords: ['Journalisation Automatique', 'Courbe de Gains', 'Analyse des Erreurs', 'Export PDF & CSV'],
    desc: 'Analysez vos forces et faiblesses avec des graphiques de performance clairs, un historique complet de vos analyses et un suivi rigoureux de votre évolution vers la rentabilité.',
    descEn: 'Track your trading consistency with automatic performance curves, complete analysis logs, win/loss breakdowns, and professional PDF/CSV export.',
    path: '/dashboard/journal',
    pro: false,
  },
];

export default function ToolsPage() {
  const [filter, setFilter] = useState('all');
  const { lang } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isEn = lang === 'en';

  const filteredTools = ALL_TOOLS.filter((t) => filter === 'all' || t.category === filter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <PublicNavbar />

      <main className="pt-28 pb-24">
        {/* Ambient Top Glows */}
        <div className="pointer-events-none fixed -top-32 left-1/3 h-96 w-96 rounded-full bg-cyan-500/15 blur-[140px]" />
        <div className="pointer-events-none fixed top-48 right-1/4 h-96 w-96 rounded-full bg-indigo-500/15 blur-[140px]" />

        <div className="mx-auto max-w-7xl px-6">
          {/* Top Back Button */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
            >
              <ArrowRight className="h-4 w-4 rotate-180 text-cyan-400" />
              {isEn ? 'Back to Home' : 'Retour à l’accueil'}
            </Link>
          </div>

          {/* Header Section */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              {isEn ? 'THE COMPLETE AI TRADING SUITE' : 'SUITE COMPLÈTE D’INTELLIGENCE ARTIFICIELLE'}
            </span>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">
              {isEn ? '11 AI Tools Built to ' : '11 Outils IA Conçus pour '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                {isEn ? 'Dominate Financial Markets' : 'Dominer les Marchés'}
              </span>
            </h1>

            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              {isEn
                ? 'From autonomous trading robots to multimodal chart vision and voice copilots, unlock the exact tools used by top prop firm traders.'
                : 'Des robots de trading autonomes à la vision graphique multimodale et au copilote vocal, exploitez les outils d’élite utilisés par les traders les plus rentables.'}
            </p>

            {/* Filter Tabs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'all', label: isEn ? 'All AI Tools (11)' : 'Tous les Outils IA (11)' },
                { id: 'automation', label: isEn ? 'Robots & Automation' : 'Robots & Automatisation' },
                { id: 'analysis', label: isEn ? 'Chart & Vision Analysis' : 'Analyse & Vision Graphique' },
                { id: 'risk', label: isEn ? 'Risk & Copilot' : 'Risque & Copilote' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    filter === tab.id
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filteredTools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <motion.div
                    key={tool.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className={`group relative flex flex-col justify-between rounded-2xl border ${tool.borderColor} bg-slate-900/70 p-6 backdrop-blur-md transition-all hover:border-cyan-500/50 hover:bg-slate-900/95 hover:shadow-xl hover:shadow-cyan-500/10`}
                  >
                    <div>
                      {/* Top Bar with Badge & Icon */}
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[10px] font-mono font-bold tracking-wider text-cyan-400 border border-slate-700/60">
                          {tool.badge}
                        </span>
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tool.color} text-white shadow-lg`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>

                      {/* Tool Title */}
                      <h3 className="mt-4 text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {isEn ? tool.nameEn : tool.name}
                      </h3>

                      {/* Description */}
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">
                        {isEn ? tool.descEn : tool.desc}
                      </p>

                      {/* Impact Keywords Pills */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {tool.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-slate-300 border border-slate-800/80"
                          >
                            <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Button */}
                    <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-400">
                        {tool.pro ? '🌟 Plan Souscription' : '⚡ Inclus Essai Gratuit'}
                      </span>
                      <Link
                        to={isAuthenticated ? tool.path : '/register?join=true'}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-cyan-500 hover:text-slate-950 group-hover:bg-cyan-500 group-hover:text-slate-950"
                      >
                        {isAuthenticated ? (isEn ? 'Open Tool' : 'Lancer l’outil') : (isEn ? 'Try Free' : 'Tester Gratuitement')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Bottom Banner CTA */}
          <div className="mt-16 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 p-8 text-center backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white sm:text-3xl">
              {isEn ? 'Ready to Upgrade Your Trading with Artificial Intelligence?' : 'Prêt à Transformer Votre Trading avec l’Intelligence Artificielle ?'}
            </h2>
            <p className="mt-2 text-sm text-slate-300 max-w-xl mx-auto">
              {isEn
                ? 'Start with our free trial on the 1-Month Plan. Access all institutional tools with unlimited scans.'
                : 'Commencez dès aujourd’hui avec l’essai gratuit sur le Plan 1 Mois. Accédez à tous les outils d’élite sans restriction.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/#pricing"
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/25 transition hover:brightness-110"
              >
                {isEn ? 'Start Free Trial' : 'Démarrer l’Essai Gratuit'}
              </a>
              <a
                href="/#pricing"
                className="rounded-xl border border-slate-700 bg-slate-900 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/50"
              >
                {isEn ? 'View All Plans' : 'Voir les Plans d’Abonnement'}
              </a>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
