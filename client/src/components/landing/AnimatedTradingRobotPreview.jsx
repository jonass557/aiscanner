import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, ShieldAlert, Target, TrendingUp, Cpu, Radar, Activity, CheckCircle2 } from 'lucide-react';

const LIVE_SIGNALS = [
  {
    symbol: 'EUR/USD',
    market: 'Forex Major',
    timeframe: 'H1',
    type: 'BUY',
    confidence: 94,
    entry: '1.08450',
    sl: '1.08180',
    tp1: '1.08950',
    tp2: '1.09350',
    pips: '+90 pips',
    rationale: 'Balayage de liquidité vendeuse + Rejet massif sur Bullish Order Block H1 & FVG.',
    riskReward: '1 : 3.3',
  },
  {
    symbol: 'XAU/USD (Gold)',
    market: 'Métaux Précieux',
    timeframe: 'M15',
    type: 'SELL',
    confidence: 96,
    entry: '2,738.50',
    sl: '2,744.00',
    tp1: '2,725.00',
    tp2: '2,716.00',
    pips: '+225 pips',
    rationale: 'Cassure de structure (CHoCH) baissière après rejet sur Premium Supply Zone institutionnelle.',
    riskReward: '1 : 4.1',
  },
  {
    symbol: 'NAS100 (Nasdaq)',
    market: 'Indice Boursier US',
    timeframe: 'H4',
    type: 'BUY',
    confidence: 92,
    entry: '20,380.00',
    sl: '20,290.00',
    tp1: '20,550.00',
    tp2: '20,720.00',
    pips: '+340 pts',
    rationale: 'Alignement macro H4/D1, clôture au-dessus du Breaker Block haussier avec volume fort.',
    riskReward: '1 : 3.8',
  },
  {
    symbol: 'VOLATILITY 75',
    market: 'Indice Synthétique Deriv',
    timeframe: 'H1',
    type: 'BUY',
    confidence: 95,
    entry: '324,500',
    sl: '321,200',
    tp1: '331,000',
    tp2: '338,500',
    pips: '+14,000 pts',
    rationale: 'Mitigation parfaite de la Discount Demand Zone avec reprise dynamique du flux institutionnel.',
    riskReward: '1 : 4.2',
  },
];

export default function AnimatedTradingRobotPreview({ isEn = false }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
      setActiveIdx((prev) => (prev + 1) % LIVE_SIGNALS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const signal = LIVE_SIGNALS[activeIdx];
  const isBuy = signal.type === 'BUY';

  return (
    <div className="relative mx-auto max-w-4xl rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-3.5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
      {/* Top Terminal Bar with Robot Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 bg-slate-950/60 rounded-xl">
        <div className="flex items-center gap-3">
          {/* Animated Robot Avatar */}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 shadow-lg shadow-cyan-500/30 text-white">
            <Bot className="h-6 w-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-cyan-400">
                {isEn ? 'AI TRADING ROBOT · HIGH PROBABILITY' : 'ROBOT DE TRADING IA · HAUTE PROBABILITÉ'}
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/30 animate-pulse">
                LIVE 24/7
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isEn ? 'Autonomous institutional market scanning' : 'Surveillance autonome des flux institutionnels'}
            </p>
          </div>
        </div>

        {/* Market Selector Chips */}
        <div className="flex items-center gap-1.5">
          {LIVE_SIGNALS.map((s, idx) => (
            <button
              key={s.symbol}
              onClick={() => setActiveIdx(idx)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                activeIdx === idx
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {s.symbol.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Animated Chart Canvas on Left + Robot Signal on Right */}
      <div className="mt-3 grid gap-3 lg:grid-cols-12">
        {/* Animated Candlestick Chart Canvas */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4 lg:col-span-7 flex flex-col justify-between min-h-[290px]">
          {/* Subtle Chart Header */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-2">
            <div className="flex items-center gap-2 font-mono font-bold text-slate-200">
              <span className="text-cyan-400">{signal.symbol}</span>
              <span className="text-slate-500">·</span>
              <span>{signal.timeframe}</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">SMC Liquidity Sweep</span>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-cyan-300 font-mono">
              <Activity className="h-3.5 w-3.5 animate-pulse" /> +0.84% Vol
            </span>
          </div>

          {/* SVG Candlestick Pattern */}
          <div className="relative my-auto h-44 w-full">
            {/* Order Block overlay box */}
            <div
              className={`absolute left-8 right-16 rounded border ${
                isBuy
                  ? 'top-24 h-12 border-emerald-500/30 bg-emerald-500/10'
                  : 'top-8 h-12 border-rose-500/30 bg-rose-500/10'
              } flex items-center px-3`}
            >
              <span className={`text-[10px] font-mono font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isBuy ? 'Demand Order Block (Unmitigated)' : 'Supply Order Block (Premium)'}
              </span>
            </div>

            {/* Simulated Live Candlesticks */}
            <svg className="h-full w-full" viewBox="0 0 400 160" preserveAspectRatio="none">
              {/* Background grid */}
              <line x1="0" y1="40" x2="400" y2="40" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="400" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Dynamic Candlesticks */}
              {/* Candle 1 (bear) */}
              <line x1="30" y1="35" x2="30" y2="85" stroke="#ef4444" strokeWidth="1.5" />
              <rect x="25" y="45" width="10" height="30" fill="#ef4444" rx="1" />

              {/* Candle 2 (bear) */}
              <line x1="55" y1="65" x2="55" y2="105" stroke="#ef4444" strokeWidth="1.5" />
              <rect x="50" y="75" width="10" height="25" fill="#ef4444" rx="1" />

              {/* Candle 3 (sweep wick down) */}
              <line x1="80" y1="85" x2="80" y2="140" stroke="#ef4444" strokeWidth="1.5" />
              <rect x="75" y="95" width="10" height="20" fill="#ef4444" rx="1" />

              {/* Candle 4 (bullish pinbar / reversal) */}
              <line x1="105" y1="90" x2="105" y2="135" stroke="#10b981" strokeWidth="1.5" />
              <rect x="100" y="95" width="10" height="15" fill="#10b981" rx="1" />

              {/* Candle 5 (bullish expansion) */}
              <line x1="130" y1="70" x2="130" y2="115" stroke="#10b981" strokeWidth="1.5" />
              <rect x="125" y="75" width="10" height="35" fill="#10b981" rx="1" />

              {/* Candle 6 (pullback to OB) */}
              <line x1="155" y1="60" x2="155" y2="100" stroke="#ef4444" strokeWidth="1.5" />
              <rect x="150" y="65" width="10" height="25" fill="#ef4444" rx="1" />

              {/* Candle 7 (bull impulse) */}
              <line x1="180" y1="45" x2="180" y2="90" stroke="#10b981" strokeWidth="1.5" />
              <rect x="175" y="50" width="10" height="35" fill="#10b981" rx="1" />

              {/* Candle 8 (bull) */}
              <line x1="205" y1="35" x2="205" y2="75" stroke="#10b981" strokeWidth="1.5" />
              <rect x="200" y="40" width="10" height="28" fill="#10b981" rx="1" />

              {/* Candle 9 (consolidate) */}
              <line x1="230" y1="30" x2="230" y2="65" stroke="#ef4444" strokeWidth="1.5" />
              <rect x="225" y="38" width="10" height="18" fill="#ef4444" rx="1" />

              {/* Candle 10 (impulse breakout) */}
              <line x1="255" y1="20" x2="255" y2="60" stroke="#10b981" strokeWidth="1.5" />
              <rect x="250" y="24" width="10" height="30" fill="#10b981" rx="1" />

              {/* Candle 11 (live forming candle) */}
              <line x1="280" y1="12" x2="280" y2="45" stroke="#10b981" strokeWidth="1.8" />
              <rect x="275" y="16" width="10" height="22" fill="#10b981" rx="1" className="animate-pulse" />

              {/* Entry Price Dashed Line */}
              <line x1="0" y1="95" x2="400" y2="95" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" />
              {/* Take Profit Line */}
              <line x1="0" y1="20" x2="400" y2="20" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
              {/* Stop Loss Line */}
              <line x1="0" y1="135" x2="400" y2="135" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            {/* Floating Price Targets on Chart */}
            <div className="absolute right-2 top-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 ring-1 ring-emerald-500/40">
              TP: {signal.tp2}
            </div>
            <div className="absolute right-2 top-20 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-cyan-300 ring-1 ring-cyan-500/40">
              ENTRY: {signal.entry}
            </div>
            <div className="absolute right-2 bottom-3 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-rose-400 ring-1 ring-rose-500/40">
              SL: {signal.sl}
            </div>
          </div>

          {/* Bottom Live Scan Status */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2 font-mono">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
              Algorithme SMC v4.2 · Tick 12ms
            </span>
            <span className="text-emerald-400 font-bold">R:R {signal.riskReward}</span>
          </div>
        </div>

        {/* Robot Live Signal Card on Right */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 lg:col-span-5 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={signal.symbol}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              {/* Signal Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-slate-400">{signal.market}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black tracking-wide ${
                    isBuy
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                      : 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50'
                  }`}
                >
                  🚨 {signal.type} {signal.symbol.split(' ')[0]}
                </span>
              </div>

              {/* Confidence Score Gauge */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {isEn ? 'AI Confidence Score' : 'Score de Confiance IA'}
                  </span>
                  <span className="font-black text-cyan-300 text-sm font-mono">{signal.confidence}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700"
                    style={{ width: `${signal.confidence}%` }}
                  />
                </div>
              </div>

              {/* Order Entry, SL, TP Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">{isEn ? 'Entry' : 'Entrée'}</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-cyan-300">{signal.entry}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Stop Loss</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-rose-400">{signal.sl}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Take Profit</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-emerald-400">{signal.tp2}</p>
                </div>
              </div>

              {/* AI Strategic Rationale */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 text-xs text-slate-300">
                <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  {isEn ? 'Institutional Execution Plan:' : 'Plan Exécuté par le Robot :'}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{signal.rationale}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Robot Guarantee Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Stop Loss Automatique
            </span>
            <span className="text-slate-300 font-bold">{signal.pips}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
