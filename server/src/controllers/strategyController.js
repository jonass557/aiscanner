import Strategy from '../models/Strategy.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

const DEFAULT_STRATEGIES = [
  {
    key: 'smc',
    name: 'Smart Money Concepts (SMC)',
    category: 'smc',
    description: 'Analyse institutionnelle basée sur la manipulation des banques : Order Blocks, FVG (Fair Value Gaps), prises de liquidités (BSL/SSL) et cassures de structure BOS / CHoCH.',
    rules: [
      'Order Block (OB) Institutionnel non mitigé',
      'Fair Value Gap (FVG / Imbalance)',
      'Prise de liquidité BSL / SSL (Liquidity Sweep)',
      'Cassure de structure (BOS / CHoCH)',
      'Entrée sur retracement OTE 62% - 79%',
    ],
    supplyDemandType: 'order_block_fvg',
    liquidityRules: 'bsl_ssl',
    targetRiskReward: 3.5,
    winRateEstimate: 88,
    isSystem: true,
    isActive: true,
  },
  {
    key: 'support_resistance',
    name: 'Support & Résistance Institutionnel (Price Action)',
    category: 'support_resistance',
    description: 'Analyse chartiste avancée axée sur les barrières horizontales majeures, les zones de rejet de prix, les polarités support/résistance et les liquidités sous les creux/sommets.',
    rules: [
      'Zone de résistance majeure testée ≥ 2 fois',
      'Zone de support clé avec rejet net',
      'Poches de liquidité sous les creux et sommets (Equal Highs/Lows)',
      'Confirmation par bougie de rejet (Pinbar / Bougie d’englobement)',
      'Ratio Risque/Rendement minimum 1:2.5',
    ],
    supplyDemandType: 'support_resistance',
    liquidityRules: 'swing_high_low',
    targetRiskReward: 2.8,
    winRateEstimate: 82,
    isSystem: true,
    isActive: true,
  },
  {
    key: 'ict',
    name: 'ICT Precision (Inner Circle Trader)',
    category: 'ict',
    description: 'Méthodologie de précision algorithmique : sessions Killzone (Londres / NY), manipulations Judas Swing, Market Structure Shift (MSS) et retour vers l’équilibre.',
    rules: [
      'Purge de liquidité de début de session (Judas Swing)',
      'Market Structure Shift (MSS) avec bougie d’expansion',
      'Fair Value Gap (FVG) dans la Killzone horaire',
      'Mitigation de Breaker Block ou Mitigation Block',
      'Prise de profit sur les anciens sommets/creux de session',
    ],
    supplyDemandType: 'order_block_fvg',
    liquidityRules: 'bsl_ssl',
    targetRiskReward: 3.8,
    winRateEstimate: 87,
    isSystem: true,
    isActive: true,
  },
  {
    key: 'trend_following',
    name: 'Trend Momentum & Breakout Confluence',
    category: 'trend',
    description: 'Stratégie de suivi de flux haussier ou baissier avec zones dynamiques de valeur (EMAs), cassures de consolidation et expansion de volatilité.',
    rules: [
      'Alignement de tendance multi-EMA (EMA 21, 50, 200)',
      'Pullback dans la zone de valeur dynamique',
      'Cassure de ligne de tendance avec volume',
      'Stop loss sous le dernier creux ascendant (Higher Low)',
      'Objectif d’extension Fibonacci 161.8%',
    ],
    supplyDemandType: 'dynamic_ema',
    liquidityRules: 'channel_bounds',
    targetRiskReward: 3.0,
    winRateEstimate: 80,
    isSystem: true,
    isActive: true,
  },
];

/**
 * Seed default strategies if collection is empty
 */
const ensureDefaultStrategies = async () => {
  const count = await Strategy.countDocuments();
  if (count === 0) {
    await Strategy.insertMany(DEFAULT_STRATEGIES);
  }
};

/**
 * GET /strategies
 * Returns all active strategies (accessible to all authenticated users).
 */
export const getStrategies = asyncHandler(async (_req, res) => {
  await ensureDefaultStrategies();
  const strategies = await Strategy.find({ isActive: true }).sort({ isSystem: -1, createdAt: 1 });
  return sendSuccess(res, { data: { strategies } });
});

/**
 * GET /strategies/admin (Admin only)
 * Returns all strategies including inactive ones for administration.
 */
export const getAdminStrategies = asyncHandler(async (_req, res) => {
  await ensureDefaultStrategies();
  const strategies = await Strategy.find().populate('createdBy', 'firstName lastName email').sort({ createdAt: -1 });
  return sendSuccess(res, { data: { strategies } });
});

/**
 * POST /strategies (Admin only)
 * Adds a new strategy to the system.
 */
export const createStrategy = asyncHandler(async (req, res) => {
  const {
    name,
    key,
    category,
    description,
    rules,
    supplyDemandType,
    liquidityRules,
    targetRiskReward,
    winRateEstimate,
  } = req.body;

  if (!name || !name.trim()) throw ApiError.badRequest('Le nom de la stratégie est requis.');

  const generatedKey = (key || name).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const existing = await Strategy.findOne({ key: generatedKey });
  if (existing) throw ApiError.conflict('Une stratégie avec cet identifiant ou ce nom existe déjà.');

  const parsedRules = Array.isArray(rules)
    ? rules
    : typeof rules === 'string'
    ? rules.split('\n').map((r) => r.trim()).filter(Boolean)
    : [];

  const strategy = await Strategy.create({
    name: name.trim(),
    key: generatedKey,
    category: category || 'smc',
    description: description || '',
    rules: parsedRules,
    supplyDemandType: supplyDemandType || 'order_block_fvg',
    liquidityRules: liquidityRules || 'bsl_ssl',
    targetRiskReward: Number(targetRiskReward) || 3.0,
    winRateEstimate: Number(winRateEstimate) || 85,
    isSystem: false,
    isActive: true,
    createdBy: req.user._id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Stratégie ajoutée avec succès au système.',
    data: { strategy },
  });
});

/**
 * PUT /strategies/:id (Admin only)
 * Updates an existing strategy.
 */
export const updateStrategy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.rules && typeof updates.rules === 'string') {
    updates.rules = updates.rules.split('\n').map((r) => r.trim()).filter(Boolean);
  }

  const strategy = await Strategy.findByIdAndUpdate(id, updates, { new: true });
  if (!strategy) throw ApiError.notFound('Stratégie introuvable.');

  return sendSuccess(res, {
    message: 'Stratégie mise à jour.',
    data: { strategy },
  });
});

/**
 * DELETE /strategies/:id (Admin only)
 * Deletes a strategy from the database.
 */
export const deleteStrategy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const strategy = await Strategy.findById(id);
  if (!strategy) throw ApiError.notFound('Stratégie introuvable.');

  await Strategy.findByIdAndDelete(id);
  return sendSuccess(res, { message: `Stratégie "${strategy.name}" supprimée avec succès.` });
});
