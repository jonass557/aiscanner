import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, Layers, Radar, Bot, ClipboardCheck, Mic, ArrowRight,
  Sparkles, CheckCircle2, TrendingUp, ShieldAlert, Cpu, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';

const TOOLS = [
  {
    id: 'scanner',
    name: 'AI Chart Scanner',
    tag: 'Vision Multimodale Instantanée',
    icon: ScanLine,
    color: 'from-cyan-500 to-blue-600',
    accentText: 'text-cyan-400',
    borderColor: 'border-cyan-500/40',
    desc: "Glissez n'importe quelle capture d'écran TradingView, MT4 ou MT5. Notre moteur de vision identifie immédiatement la paire, le timeframe, les Order Blocks, Fair Value Gaps (FVG), cassures de structure (BOS/CHoCH) et génère un plan de trade millimétré (Entrée, Stop Loss, 3 Take Profits).",
    highlights: [
      'Vision multimodale < 2s par Gemini 3.8 Flash',
      'Détection automatique des zones Premium & Discount',
      'Verdict direct (BUY / SELL) sans hésitation',
      'Calcul automatique du Ratio Risque / Rendement',
    ],
    mockPreview: {
      title: 'Scan EURUSD — Timeframe H1',
      verdict: 'BUY',
      score: '89%',
      entry: '1.08420',
      sl: '1.08150',
      tp: '1.09200',
      confluences: ['Order Block H1 non mitigé', 'Balayage de liquidité (Sweep)', 'BOS haussier confirmé'],
    },
  },
  {
    id: 'mtf',
    name: 'Multi-Timeframe Scanner',
    tag: 'Triple Confluence H4 · H1 · M15',
    icon: Layers,
    color: 'from-indigo-500 to-purple-600',
    accentText: 'text-indigo-400',
    borderColor: 'border-indigo-500/40',
    desc: "Ne tradez plus jamais à contre-courant. Chargez simultanément vos graphiques H4, H1 et M15. L'IA croise les tendances majeures et affine les points d'entrée sur les unités de temps inférieures pour maximiser votre ratio gain/perte.",
    highlights: [
      'Alignement des biais macro et micro en une seule passe',
      'Réduction drastique des faux signaux de marché',
      'Synchronisation intelligente des flux de données',
      'Score de confluence global pondéré',
    ],
    mockPreview: {
      title: 'Confluence Triple TF — XAUUSD (Gold)',
      verdict: 'BUY',
      score: '93%',
      entry: '2345.50',
      sl: '2338.00',
      tp: '2368.00',
      confluences: ['H4 : Tendance haussière saine', 'H1 : FVG testé', 'M15 : Entrée sur Breaker Block'],
    },
  },
  {
    id: 'voice',
    name: 'Copilote Vocal Mains Libres',
    tag: 'IA Conversationnelle 100% Vocale',
    icon: Mic,
    color: 'from-emerald-500 to-teal-600',
    accentText: 'text-emerald-400',
    borderColor: 'border-emerald-500/40',
    desc: "Parlez à votre assistant de trading les yeux rivés sur vos écrans, sans jamais toucher votre souris ou votre clavier. Posez vos questions à voix haute (« Où placer mon Stop Loss ? », « Analyse le Bitcoin ») et recevez des réponses audio précises et argumentées.",
    highlights: [
      'Mode Mains Libres Continu avec détection de silence',
      'Synthèse vocale naturelle à débit fluide',
      'Compréhension contextuelle de vos positions en cours',
      'Accessible partout sur la plateforme en 1 clic',
    ],
    mockPreview: {
      title: 'Dialogue Vocal Mains Libres',
      verdict: 'VOCAL',
      score: '100%',
      entry: 'Question orale',
      sl: 'Réponse vocale',
      tp: 'Explication SMC',
      confluences: [
        'User : "Pourquoi proposes-tu un achat ?"',
        'IA : "Le prix a balayé la liquidité sous les plus bas asiatiques puis a rejeté le Fair Value Gap H1."',
      ],
    },
  },
  {
    id: 'radar',
    name: 'Opportunity Scanner Live',
    tag: 'Radar Automatisé Multi-Marchés',
    icon: Radar,
    color: 'from-amber-500 to-orange-600',
    accentText: 'text-amber-400',
    borderColor: 'border-amber-500/40',
    desc: "L'IA surveille en temps réel le Forex, les Crypto-monnaies, les Indices boursiers et les Indices Synthétiques Deriv. Dès qu'une configuration SMC de haute précision se forme, elle apparaît classée par taux de probabilité.",
    highlights: [
      'Scan permanent du panier de marchés majeurs',
      'Classement par score de confiance prédictif',
      'Alertes sur retournements et continuations de tendance',
      'Filtres personnalisés par marché et horizon de temps',
    ],
    mockPreview: {
      title: 'Radar Live — 18 opportunités détectées',
      verdict: 'OPP',
      score: '87%',
      entry: 'BTCUSD',
      sl: '64,200$',
      tp: '66,800$',
      confluences: ['SMC Liquidity Grab', 'R:R supérieur à 1:3.2', 'Volume institutionnel détecté'],
    },
  },
  {
    id: 'validator',
    name: 'Trade & Risk Validator',
    tag: 'Bouclier de Capital & Gestion du Risque',
    icon: ClipboardCheck,
    color: 'from-rose-500 to-pink-600',
    accentText: 'text-rose-400',
    borderColor: 'border-rose-500/40',
    desc: "Avant d'appuyer sur le bouton d'exécution de votre courtier, soumettez votre trade à l'IA. Elle vérifie votre ratio R:R, la proximité d'annonces économiques à fort impact et l'alignement mathématique de votre stop loss.",
    highlights: [
      'Validation stricte de la conformité du money management',
      'Prise en compte des annonces économiques (NFP, CPI, FED)',
      'Calculateur précis de taille de lot par pourcentage de risque',
      'Verdict de sécurité avant engagement du capital',
    ],
    mockPreview: {
      title: 'Contrôle Risque — NASDAQ (NAS100)',
      verdict: 'VALIDÉ',
      score: '91%',
      entry: '18650',
      sl: '18590 (-0.8%)',
      tp: '18830 (+3.0%)',
      confluences: ['R:R validé à 1:3.0', 'Aucune annonce NFP dans les 4h', 'Risque par trade : 1.0%'],
    },
  },
];

export default function ToolsShowcase() {
  const [activeTab, setActiveTab] = useState(TOOLS[0].id);
  const activeTool = TOOLS.find((t) => t.id === activeTab) || TOOLS[0];

  return (
    <section id="tools" className="relative overflow-hidden py-28 bg-slate-950/80">
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-full max-w-7xl bg-cyan-500/5 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Titre section */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" /> Écosystème IA de Trading
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Des outils d'élite conçus pour <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">dominer les marchés</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            Fini les heures passées à tracer des lignes approximatives. Découvrez les outils automatisés qui transforment votre manière d'analyser et de trader.
          </p>
        </div>

        {/* Boutons d'onglets */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5">
          {TOOLS.map((t) => {
            const isSelected = t.id === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isSelected
                    ? 'border border-cyan-400/50 bg-slate-800 text-white shadow-lg shadow-cyan-500/20'
                    : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? t.accentText : 'text-slate-400'}`} />
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Carte détaillée de l'outil sélectionné */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTool.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className={`mt-10 grid gap-8 rounded-3xl border ${activeTool.borderColor} bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl lg:grid-cols-12`}
          >
            {/* Colonne Gauche : Descriptif & Points clés */}
            <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${activeTool.accentText}`}>
                    {activeTool.tag}
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{activeTool.name}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                  {activeTool.desc}
                </p>

                <div className="mt-6 space-y-3">
                  {activeTool.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${activeTool.accentText}`} />
                      <span className="text-sm font-medium text-slate-200">{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Link
                  to="/register?join=true"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-95"
                >
                  Essayer {activeTool.name} gratuitement <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Colonne Droite : Simulation visuelle interactive */}
            <div className="flex items-center justify-center lg:col-span-5">
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-5 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-300">{activeTool.mockPreview.title}</span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/40">
                    {activeTool.mockPreview.verdict} · {activeTool.mockPreview.score}
                  </span>
                </div>

                {/* Valeurs clés */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                    <p className="text-[10px] uppercase text-slate-400">Entrée</p>
                    <p className="mt-1 font-mono font-bold text-cyan-300">{activeTool.mockPreview.entry}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                    <p className="text-[10px] uppercase text-slate-400">Stop Loss</p>
                    <p className="mt-1 font-mono font-bold text-rose-400">{activeTool.mockPreview.sl}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
                    <p className="text-[10px] uppercase text-slate-400">Take Profit</p>
                    <p className="mt-1 font-mono font-bold text-emerald-400">{activeTool.mockPreview.tp}</p>
                  </div>
                </div>

                {/* Confluences détectées */}
                <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Signaux &amp; Confluences IA :
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                    {activeTool.mockPreview.confluences.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Moteur : Gemini 3.8 Flash Vision</span>
                  <span className="font-mono text-emerald-400">Temps de réponse : 1.4s</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Link to Dedicated Tools Page */}
        <div className="mt-12 text-center">
          <Link
            to="/tools"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900/90 px-8 py-3.5 text-sm font-bold text-cyan-300 shadow-lg shadow-cyan-500/10 transition hover:bg-slate-800 hover:text-white hover:border-cyan-400"
          >
            <span>Explorer la suite complète des 11 outils IA</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
