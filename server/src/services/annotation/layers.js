/**
 * Annotation layer catalog (Engine 4 / visual report).
 *
 * A "layer" is a toggleable category of overlay drawn on top of the chart
 * image. Each has a stable id (persisted on every annotation), a human label
 * for the layer panel, a default color, and the default shape used when a
 * detection doesn't specify one. The client can override colors/visibility.
 *
 * `SOURCE_LAYER` maps each technicalAnalysis family to the layer it renders on,
 * so the overlay builder and the frontend agree on grouping.
 */

export const LAYERS = [
  { id: 'orderBlocks', label: 'Order Blocks', color: '#f59e0b', shape: 'rect' },
  { id: 'fvg', label: 'Fair Value Gaps', color: '#8b5cf6', shape: 'rect' },
  { id: 'liquidity', label: 'Liquidity', color: '#06b6d4', shape: 'line' },
  { id: 'premiumDiscount', label: 'Premium / Discount', color: '#ec4899', shape: 'zone' },
  { id: 'supportResistance', label: 'Support / Resistance', color: '#64748b', shape: 'line' },
  { id: 'bos', label: 'BOS / MSS', color: '#22c55e', shape: 'line' },
  { id: 'choch', label: 'CHoCH', color: '#ef4444', shape: 'line' },
  { id: 'structure', label: 'Structure (HH/HL/LH/LL)', color: '#3b82f6', shape: 'label' },
  { id: 'patterns', label: 'Patterns', color: '#14b8a6', shape: 'label' },
  { id: 'entry', label: 'Entry', color: '#2563eb', shape: 'line' },
  { id: 'stopLoss', label: 'Stop Loss', color: '#dc2626', shape: 'line' },
  { id: 'takeProfit', label: 'Take Profit', color: '#16a34a', shape: 'line' },
  { id: 'riskZone', label: 'Risk Zones', color: '#f97316', shape: 'zone' },
];

export const LAYER_BY_ID = new Map(LAYERS.map((l) => [l.id, l]));

/** Map a technicalAnalysis family key → the annotation layer it renders on. */
export const SOURCE_LAYER = {
  orderBlocks: 'orderBlocks',
  fairValueGaps: 'fvg',
  inverseFvg: 'fvg',
  imbalances: 'fvg',
  displacement: 'fvg',
  breakerBlocks: 'orderBlocks',
  mitigationBlocks: 'orderBlocks',

  liquidityZones: 'liquidity',
  equalHighs: 'liquidity',
  equalLows: 'liquidity',
  liquiditySweeps: 'liquidity',
  stopHunts: 'liquidity',
  inducement: 'liquidity',

  premiumZones: 'premiumDiscount',
  discountZones: 'premiumDiscount',
  oteZones: 'premiumDiscount',

  supportLevels: 'supportResistance',
  resistanceLevels: 'supportResistance',
  trendlines: 'supportResistance',
  channels: 'supportResistance',
  consolidations: 'supportResistance',
  breakouts: 'supportResistance',
  fakeBreakouts: 'supportResistance',
  retests: 'supportResistance',
  fibonacci: 'supportResistance',

  bos: 'bos',
  mss: 'bos',
  choch: 'choch',

  higherHighs: 'structure',
  higherLows: 'structure',
  lowerHighs: 'structure',
  lowerLows: 'structure',

  chartPatterns: 'patterns',
  candlePatterns: 'patterns',
};

export default { LAYERS, LAYER_BY_ID, SOURCE_LAYER };
