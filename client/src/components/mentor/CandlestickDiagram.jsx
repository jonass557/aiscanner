import { useState } from 'react';
import { Layers, Sparkles, TrendingUp, TrendingDown, Eye, CheckCircle2 } from 'lucide-react';

/**
 * Real Japanese Candlestick Diagram Component for AI Mentor.
 * Renders SVG charts with authentic candlestick bodies, high/low wicks,
 * institutional annotations (BOS, CHoCH, Order Blocks, FVGs, Sweeps).
 */

const PRESET_DIAGRAMS = {
  bos_continuation: {
    id: 'bos_continuation',
    title: 'Break of Structure (BOS) Haussier',
    badge: 'Structure de Marché',
    description: 'Une cassure franche du plus haut précédent par une clôture de bougie, confirmant la continuation de la tendance acheteuse.',
    width: 640,
    height: 320,
    zones: [
      { top: 215, height: 40, label: 'Order Block Haussier (OB Non-Mitigé)', color: 'rgba(99, 102, 241, 0.25)', borderColor: '#6366f1' },
    ],
    lines: [
      { y: 110, x1: 180, x2: 440, label: 'BOS (Break of Structure)', color: '#22c55e', style: 'dashed' },
    ],
    candles: [
      { x: 50, open: 260, close: 220, high: 210, low: 270, isBullish: true, label: 'Creux [HL]' },
      { x: 95, open: 220, close: 170, high: 160, low: 225, isBullish: true },
      { x: 140, open: 170, close: 120, high: 110, low: 175, isBullish: true, label: 'Sommet [HH]' },
      { x: 185, open: 120, close: 160, high: 115, low: 170, isBullish: false },
      { x: 230, open: 160, close: 200, high: 155, low: 210, isBullish: false },
      { x: 275, open: 200, close: 235, high: 195, low: 245, isBullish: false, label: 'Rejet OB' },
      { x: 320, open: 235, close: 180, high: 175, low: 240, isBullish: true },
      { x: 365, open: 180, close: 130, high: 125, low: 185, isBullish: true },
      { x: 410, open: 130, close: 85, high: 80, low: 135, isBullish: true, label: 'Clôture au-dessus du BOS' },
      { x: 455, open: 85, close: 50, high: 45, low: 90, isBullish: true, label: 'Nouveau [HH]' },
      { x: 500, open: 50, close: 75, high: 45, low: 85, isBullish: false },
      { x: 545, open: 75, close: 105, high: 70, low: 115, isBullish: false, label: 'Pullback sain' },
    ],
  },

  choch_reversal: {
    id: 'choch_reversal',
    title: 'Change of Character (CHoCH) & Balayage de Liquidité',
    badge: 'Renversement Institutionnel',
    description: 'Balayage de liquidité (Turtle Soup) au-dessus du plus haut, suivi d\'un déplacement agressif qui brise le dernier creux protecteur (CHoCH).',
    width: 640,
    height: 320,
    zones: [
      { top: 50, height: 35, label: 'Liquidité Achat (Buy-Side Liquidity BSL)', color: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' },
      { top: 110, height: 40, label: 'Order Block Baissier (Entrée)', color: 'rgba(168, 85, 247, 0.25)', borderColor: '#a855f7' },
    ],
    lines: [
      { y: 220, x1: 220, x2: 440, label: 'CHoCH (Change of Character)', color: '#ef4444', style: 'dashed' },
    ],
    candles: [
      { x: 50, open: 200, close: 150, high: 140, low: 205, isBullish: true },
      { x: 95, open: 150, close: 100, high: 90, low: 155, isBullish: true, label: 'High 1' },
      { x: 140, open: 100, close: 170, high: 95, low: 180, isBullish: false },
      { x: 185, open: 170, close: 220, high: 165, low: 225, isBullish: false, label: 'Creux clé [HL]' },
      { x: 230, open: 220, close: 130, high: 125, low: 225, isBullish: true },
      { x: 275, open: 130, close: 80, high: 45, low: 135, isBullish: true, label: 'Mèche de Balayage (Sweep)' },
      { x: 320, open: 80, close: 160, high: 75, low: 165, isBullish: false, label: 'Déplacement baissier fort' },
      { x: 365, open: 160, close: 240, high: 155, low: 245, isBullish: false, label: 'Cassure [CHoCH]' },
      { x: 410, open: 240, close: 180, high: 175, low: 245, isBullish: true },
      { x: 455, open: 180, close: 125, high: 115, low: 185, isBullish: true, label: 'Retest OB' },
      { x: 500, open: 125, close: 205, high: 120, low: 215, isBullish: false, label: 'Vente Validée' },
      { x: 545, open: 205, close: 275, high: 200, low: 285, isBullish: false, label: 'Cible TP' },
    ],
  },

  fvg_imbalance: {
    id: 'fvg_imbalance',
    title: 'Fair Value Gap (FVG / Imbalance Institutionnelle)',
    badge: 'Déséquilibre des Ordres',
    description: 'Déséquilibre à 3 bougies : l\'espace entre la mèche haute de la bougie 1 et la mèche basse de la bougie 3 crée une inefficacité que l\'algorithme revient combler.',
    width: 640,
    height: 320,
    zones: [
      { top: 125, height: 60, label: 'Fair Value Gap (FVG Haussier non-comblé)', color: 'rgba(234, 179, 8, 0.25)', borderColor: '#eab308' },
    ],
    lines: [
      { y: 125, x1: 95, x2: 440, label: 'Bas Bougie 3 (Borne Haute FVG)', color: '#eab308', style: 'dotted' },
      { y: 185, x1: 50, x2: 440, label: 'Haut Bougie 1 (Borne Basse FVG)', color: '#eab308', style: 'dotted' },
    ],
    candles: [
      { x: 80, open: 230, close: 195, high: 185, low: 235, isBullish: true, label: 'Bougie 1' },
      { x: 150, open: 195, close: 70, high: 60, low: 200, isBullish: true, label: 'Bougie 2 (Impulsion HFT)' },
      { x: 220, open: 70, close: 40, high: 30, low: 125, isBullish: true, label: 'Bougie 3' },
      { x: 290, open: 40, close: 75, high: 35, low: 85, isBullish: false },
      { x: 360, open: 75, close: 135, high: 70, low: 140, isBullish: false, label: 'Comblement partiel' },
      { x: 430, open: 135, close: 175, high: 130, low: 180, isBullish: false, label: 'Atténuation 50% (CE)' },
      { x: 500, open: 175, close: 100, high: 90, low: 180, isBullish: true, label: 'Rebond Impulsif' },
      { x: 560, open: 100, close: 35, high: 25, low: 105, isBullish: true, label: 'Continuation' },
    ],
  },

  order_block_mitigation: {
    id: 'order_block_mitigation',
    title: 'Order Block (OB) Institutionnel & Mitigation',
    badge: 'Empreinte Institutionnelle',
    description: 'La dernière bougie baissière avant un mouvement haussier puissant qui brise la structure (BOS). L\'institution revient pour clôturer ses ordres résiduels en perte.',
    width: 640,
    height: 320,
    zones: [
      { top: 195, height: 45, label: 'Bullish Order Block Zone', color: 'rgba(16, 185, 129, 0.25)', borderColor: '#10b981' },
    ],
    lines: [
      { y: 195, x1: 90, x2: 500, label: 'Open / Haut de l\'Order Block', color: '#10b981', style: 'dashed' },
    ],
    candles: [
      { x: 70, open: 160, close: 190, high: 155, low: 195, isBullish: false },
      { x: 120, open: 190, close: 235, high: 185, low: 240, isBullish: false, label: 'OB Candle (Dernière rouge)' },
      { x: 170, open: 235, close: 145, high: 135, low: 240, isBullish: true, label: 'Impulsion Forte' },
      { x: 220, open: 145, close: 85, high: 75, low: 150, isBullish: true, label: 'BOS Confirmé' },
      { x: 270, open: 85, close: 55, high: 45, low: 90, isBullish: true },
      { x: 320, open: 55, close: 95, high: 50, low: 105, isBullish: false },
      { x: 370, open: 95, close: 145, high: 90, low: 150, isBullish: false },
      { x: 420, open: 145, close: 205, high: 140, low: 215, isBullish: false, label: 'Retest / Mitigation' },
      { x: 470, open: 205, close: 130, high: 125, low: 215, isBullish: true, label: 'Rejet Franc' },
      { x: 520, open: 130, close: 65, high: 55, low: 135, isBullish: true, label: 'Objectif Atteint' },
    ],
  },
};

export default function CandlestickDiagram({ initialPreset = 'bos_continuation', customTitle = null }) {
  const [activePreset, setActivePreset] = useState(initialPreset);
  const data = PRESET_DIAGRAMS[activePreset] || PRESET_DIAGRAMS.bos_continuation;

  const candleWidth = 18;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-[#090d16] text-white p-4 shadow-xl overflow-hidden">
      {/* Top Header & Preset Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Eye className="h-3.5 w-3.5" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              {data.badge}
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-black text-gray-100 mt-1">
            {customTitle || data.title}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 max-w-xl">
            {data.description}
          </p>
        </div>

        {/* Preset Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
          {Object.values(PRESET_DIAGRAMS).map((preset) => (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm ${
                activePreset === preset.id
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20'
                  : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {preset.title.split('(')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas with Real Japanese Candlesticks */}
      <div className="relative mt-3 w-full overflow-x-auto select-none">
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="w-full h-auto min-w-[560px] max-h-[340px]"
          style={{ background: 'radial-gradient(ellipse at center, #101726 0%, #080c14 100%)' }}
        >
          {/* Subtle Grid Lines */}
          <line x1="0" y1="80" x2={data.width} y2="80" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="160" x2={data.width} y2="160" stroke="#1e293b" strokeDasharray="3 3" />
          <line x1="0" y1="240" x2={data.width} y2="240" stroke="#1e293b" strokeDasharray="3 3" />

          {/* Shaded Institutional Zones (Order Block, FVG, BSL, SSL) */}
          {data.zones.map((zone, idx) => (
            <g key={idx}>
              <rect
                x="0"
                y={zone.top}
                width={data.width}
                height={zone.height}
                fill={zone.color}
                stroke={zone.borderColor}
                strokeWidth="1"
                strokeDasharray="4 2"
                opacity="0.85"
              />
              <text
                x="12"
                y={zone.top + 16}
                fill={zone.borderColor}
                fontSize="11"
                fontWeight="bold"
                letterSpacing="0.5"
              >
                {zone.label}
              </text>
            </g>
          ))}

          {/* Level Lines (BOS, CHoCH, Equilibrium) */}
          {data.lines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={line.x1}
                y1={line.y}
                x2={line.x2}
                y2={line.y}
                stroke={line.color}
                strokeWidth="1.8"
                strokeDasharray={line.style === 'dashed' ? '5 3' : '2 2'}
              />
              <rect
                x={line.x2 - 120}
                y={line.y - 12}
                width="115"
                height="18"
                rx="4"
                fill="#0f172a"
                stroke={line.color}
                strokeWidth="1"
              />
              <text
                x={line.x2 - 62}
                y={line.y + 1}
                fill={line.color}
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Real Japanese Candlesticks with Wicks and Bodies */}
          {data.candles.map((c, i) => {
            const isGreen = c.isBullish;
            const candleColor = isGreen ? '#22c55e' : '#ef4444';
            const bodyTop = Math.min(c.open, c.close);
            const bodyHeight = Math.max(4, Math.abs(c.open - c.close));

            return (
              <g key={i} className="hover:opacity-80 cursor-pointer transition">
                {/* Upper & Lower Wick */}
                <line
                  x1={c.x}
                  y1={c.high}
                  x2={c.x}
                  y2={c.low}
                  stroke={candleColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Candle Solid Body */}
                <rect
                  x={c.x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  rx="2"
                  fill={candleColor}
                  stroke={candleColor}
                  strokeWidth="1"
                />

                {/* Label annotation if present */}
                {c.label && (
                  <g>
                    <line
                      x1={c.x}
                      y1={isGreen ? c.low + 4 : c.high - 4}
                      x2={c.x}
                      y2={isGreen ? c.low + 18 : c.high - 18}
                      stroke="#94a3b8"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <rect
                      x={c.x - 55}
                      y={isGreen ? c.low + 20 : c.high - 34}
                      width="110"
                      height="16"
                      rx="3"
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="0.8"
                    />
                    <text
                      x={c.x}
                      y={isGreen ? c.low + 32 : c.high - 22}
                      fill="#e2e8f0"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {c.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend & Educational Annotations */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-800/80 pt-2.5 text-[11px] text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-2.5 rounded-sm bg-emerald-500" />
            <span>Bougie Acheteuse (Bullish)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-2.5 rounded-sm bg-red-500" />
            <span>Bougie Vendeuse (Bearish)</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-emerald-400 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Vraies Bougies Japonaises & Empreintes Institutionnelles</span>
        </div>
      </div>
    </div>
  );
}
