import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

// Authentic market pairs for the ticker (scrolling without any buy or sell order)
const TICKER_PAIRS = [
  { symbol: 'EUR/USD', price: '1.08542', change: '+0.28%', isUp: true },
  { symbol: 'GBP/USD', price: '1.29680', change: '+0.15%', isUp: true },
  { symbol: 'XAU/USD', price: '2,738.50', change: '+0.84%', isUp: true },
  { symbol: 'USD/JPY', price: '153.250', change: '-0.12%', isUp: false },
  { symbol: 'NAS100', price: '20,410.20', change: '+0.62%', isUp: true },
  { symbol: 'US30', price: '43,180.50', change: '+0.34%', isUp: true },
  { symbol: 'BTC/USD', price: '68,540.00', change: '+1.45%', isUp: true },
  { symbol: 'ETH/USD', price: '2,615.80', change: '+0.95%', isUp: true },
  { symbol: 'VOLATILITY 75', price: '324,850.00', change: '+0.70%', isUp: true },
  { symbol: 'BOOM 1000', price: '12,450.30', change: '-0.22%', isUp: false },
  { symbol: 'CRASH 1000', price: '8,920.40', change: '+0.45%', isUp: true },
  { symbol: 'AUD/USD', price: '0.65820', change: '-0.08%', isUp: false },
  { symbol: 'EUR/JPY', price: '166.420', change: '+0.18%', isUp: true },
];

export default function AnimatedTradingRobotPreview({ isEn = false }) {
  const [pulseTick, setPulseTick] = useState(0);

  // Subtle tick animation for the live candlestick flow
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((p) => p + 1);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
      {/* 1. Header: Status & Live Candlestick Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 bg-slate-950/70 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              {isEn ? 'LIVE CANDLESTICK STREAM · TIME FRAME H1' : 'FLUX DE BOUGIES JAPONAISES EN DIRECT · TIMEFRAME H1'}
            </span>
            <p className="text-[11px] text-slate-400">
              {isEn ? 'Real-time market price action' : 'Action des prix en temps réel sans interférence'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>EUR/USD · 1.08542</span>
        </div>
      </div>

      {/* 2. Simple Pure Candlestick Chart (NO orders, NO buy/sell lines, NO SL/TP) */}
      <div className="relative mt-3 h-64 w-full overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 p-3">
        {/* SVG Japanese Candlestick Chart */}
        <svg className="h-full w-full" viewBox="0 0 600 220" preserveAspectRatio="none">
          {/* Subtle Horizontal Grid lines */}
          <line x1="0" y1="45" x2="600" y2="45" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="90" x2="600" y2="90" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="135" x2="600" y2="135" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="180" x2="600" y2="180" stroke="#1e293b" strokeDasharray="3 3" />

          {/* Candle 1 (bearish red) */}
          <line x1="25" y1="50" x2="25" y2="105" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="20" y="60" width="10" height="35" fill="#ef4444" rx="1" />

          {/* Candle 2 (bearish red) */}
          <line x1="50" y1="85" x2="50" y2="135" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="45" y="95" width="10" height="30" fill="#ef4444" rx="1" />

          {/* Candle 3 (bullish green with wick) */}
          <line x1="75" y1="110" x2="75" y2="160" stroke="#10b981" strokeWidth="1.5" />
          <rect x="70" y="125" width="10" height="25" fill="#10b981" rx="1" />

          {/* Candle 4 (bearish red) */}
          <line x1="100" y1="120" x2="100" y2="175" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="95" y="130" width="10" height="35" fill="#ef4444" rx="1" />

          {/* Candle 5 (bullish green impulse) */}
          <line x1="125" y1="95" x2="125" y2="155" stroke="#10b981" strokeWidth="1.5" />
          <rect x="120" y="105" width="10" height="40" fill="#10b981" rx="1" />

          {/* Candle 6 (bullish green continuation) */}
          <line x1="150" y1="70" x2="150" y2="120" stroke="#10b981" strokeWidth="1.5" />
          <rect x="145" y="80" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 7 (pullback bear red) */}
          <line x1="175" y1="80" x2="175" y2="130" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="170" y="90" width="10" height="25" fill="#ef4444" rx="1" />

          {/* Candle 8 (bullish green) */}
          <line x1="200" y1="65" x2="200" y2="115" stroke="#10b981" strokeWidth="1.5" />
          <rect x="195" y="75" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 9 (bullish green expansion) */}
          <line x1="225" y1="40" x2="225" y2="95" stroke="#10b981" strokeWidth="1.5" />
          <rect x="220" y="50" width="10" height="35" fill="#10b981" rx="1" />

          {/* Candle 10 (small red consolidation) */}
          <line x1="250" y1="45" x2="250" y2="85" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="245" y="52" width="10" height="20" fill="#ef4444" rx="1" />

          {/* Candle 11 (bear red) */}
          <line x1="275" y1="60" x2="275" y2="115" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="270" y="70" width="10" height="32" fill="#ef4444" rx="1" />

          {/* Candle 12 (bull green rejection) */}
          <line x1="300" y1="75" x2="300" y2="130" stroke="#10b981" strokeWidth="1.5" />
          <rect x="295" y="85" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 13 (bull green) */}
          <line x1="325" y1="55" x2="325" y2="105" stroke="#10b981" strokeWidth="1.5" />
          <rect x="320" y="65" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 14 (bull green) */}
          <line x1="350" y1="35" x2="350" y2="85" stroke="#10b981" strokeWidth="1.5" />
          <rect x="345" y="45" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 15 (bear red) */}
          <line x1="375" y1="45" x2="375" y2="95" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="370" y="55" width="10" height="25" fill="#ef4444" rx="1" />

          {/* Candle 16 (bull green) */}
          <line x1="400" y1="30" x2="400" y2="80" stroke="#10b981" strokeWidth="1.5" />
          <rect x="395" y="40" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 17 (bull green impulse) */}
          <line x1="425" y1="20" x2="425" y2="70" stroke="#10b981" strokeWidth="1.5" />
          <rect x="420" y="28" width="10" height="32" fill="#10b981" rx="1" />

          {/* Candle 18 (bear red) */}
          <line x1="450" y1="35" x2="450" y2="85" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="445" y="45" width="10" height="26" fill="#ef4444" rx="1" />

          {/* Candle 19 (bull green) */}
          <line x1="475" y1="25" x2="475" y2="75" stroke="#10b981" strokeWidth="1.5" />
          <rect x="470" y="32" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 20 (bull green) */}
          <line x1="500" y1="18" x2="500" y2="65" stroke="#10b981" strokeWidth="1.5" />
          <rect x="495" y="24" width="10" height="30" fill="#10b981" rx="1" />

          {/* Candle 21 (bear red) */}
          <line x1="525" y1="28" x2="525" y2="75" stroke="#ef4444" strokeWidth="1.5" />
          <rect x="520" y="36" width="10" height="24" fill="#ef4444" rx="1" />

          {/* Candle 22 (live forming candle with pulsing glow) */}
          <line x1="550" y1="14" x2="550" y2="58" stroke="#10b981" strokeWidth="2" />
          <rect
            x="545"
            y={20 + (pulseTick % 2) * 2}
            width="10"
            height="26"
            fill="#10b981"
            rx="1"
            className="animate-pulse"
          />

          {/* Live Price Horizontal Line */}
          <line x1="0" y1="35" x2="600" y2="35" stroke="#06b6d4" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        </svg>

        {/* Live floating price badge on right */}
        <div className="absolute right-3 top-7 rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 ring-1 ring-cyan-500/40">
          1.08542
        </div>
      </div>

      {/* 3. Physical Real Robot Illustration Section Below Chart */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Detailed SVG Illustration of a Physical Real Autonomous Trading Robot */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 shadow-xl overflow-hidden">
              {/* High-tech Physical Humanoid Robot Drawing */}
              <svg viewBox="0 0 100 100" className="h-20 w-20">
                {/* Robot Antenna / Communications Mast */}
                <line x1="50" y1="10" x2="50" y2="20" stroke="#06b6d4" strokeWidth="2" />
                <circle cx="50" cy="9" r="3" fill="#06b6d4" className="animate-pulse" />

                {/* Robot Head Chassis (Metallic Android) */}
                <rect x="34" y="20" width="32" height="26" rx="6" fill="#334155" stroke="#06b6d4" strokeWidth="1.5" />
                <rect x="36" y="22" width="28" height="22" rx="4" fill="#1e293b" />

                {/* Robot Optical Visor & Scanners */}
                <rect x="40" y="28" width="20" height="8" rx="2" fill="#0f172a" />
                <circle cx="45" cy="32" r="2.5" fill="#38bdf8" className="animate-pulse" />
                <circle cx="55" cy="32" r="2.5" fill="#38bdf8" className="animate-pulse" />

                {/* Robot Neck Joint */}
                <rect x="46" y="46" width="8" height="5" rx="1" fill="#64748b" />

                {/* Robot Torso / Chassis */}
                <path d="M 28 51 L 72 51 L 68 82 L 32 82 Z" fill="#334155" stroke="#475569" strokeWidth="1.5" />
                <path d="M 32 54 L 68 54 L 64 78 L 36 78 Z" fill="#1e293b" />

                {/* Robot AI Power Core (Glowing Reactor) */}
                <circle cx="50" cy="65" r="7" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                <circle cx="50" cy="65" r="4" fill="#38bdf8" className="animate-ping" />
                <circle cx="50" cy="65" r="3" fill="#10b981" />

                {/* Robot Mechanical Shoulder Joints & Arms */}
                <circle cx="26" cy="55" r="4" fill="#64748b" />
                <path d="M 26 58 L 22 75 L 25 86" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" fill="none" />
                <circle cx="74" cy="55" r="4" fill="#64748b" />
                <path d="M 74 58 L 78 75 L 75 86" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" fill="none" />

                {/* Tactile Robotic Grippers */}
                <circle cx="25" cy="88" r="2.5" fill="#38bdf8" />
                <circle cx="75" cy="88" r="2.5" fill="#38bdf8" />
              </svg>

              {/* Ambient Glow */}
              <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-cyan-300 ring-1 ring-cyan-500/40">
                  ROBOT PHYSIQUE AUTONOME
                </span>
                <span className="text-[10px] font-mono text-emerald-400">ACTIF 24/7</span>
              </div>
              <h4 className="mt-1 text-sm font-bold text-white">
                {isEn ? 'Hardware Algorithmic Trading Unit' : 'Unité Algorithmique Haute Précision'}
              </h4>
              <p className="mt-0.5 text-xs text-slate-400 max-w-md">
                {isEn
                  ? 'Autonomous execution processor scanning global currency pairs and synthetic indices continuous tick-by-tick.'
                  : 'Processeur d’analyse observant en continu les fluctuations multi-marchés sur Forex, Métaux et Indices Synthétiques.'}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-right">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
              <p className="text-[10px] uppercase font-mono text-slate-400">Moteur</p>
              <p className="text-xs font-bold text-white font-mono">SMC Engine v4.2</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
              <p className="text-[10px] uppercase font-mono text-slate-400">Fréquence</p>
              <p className="text-xs font-bold text-cyan-400 font-mono">Tick 15ms</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Scrolling Currency Pairs Marquee (NO buy/sell orders, pure pairs & quotes) */}
      <div className="mt-3 relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/90 py-2.5">
        {/* Continuous ticker tape */}
        <div className="flex items-center space-x-6 animate-ticker whitespace-nowrap">
          {TICKER_PAIRS.concat(TICKER_PAIRS).map((item, idx) => (
            <div key={idx} className="inline-flex items-center gap-2 text-xs font-mono">
              <span className="font-bold text-slate-200">{item.symbol}</span>
              <span className="text-slate-400">{item.price}</span>
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                  item.isUp ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {item.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {item.change}
              </span>
              <span className="text-slate-700">|</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
