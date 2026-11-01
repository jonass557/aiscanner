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
 * Returns all active system strategies PLUS personal strategies created by the current user.
 */
export const getStrategies = asyncHandler(async (req, res) => {
  await ensureDefaultStrategies();
  const userId = req.user?._id;
  const filter = {
    isActive: true,
    $or: [{ isSystem: true }, { createdBy: null }],
  };
  if (userId) {
    filter.$or.push({ createdBy: userId });
  }

  const raw = await Strategy.find(filter)
    .populate('createdBy', 'firstName lastName email')
    .sort({ isSystem: -1, createdAt: -1 })
    .lean();

  const strategies = raw.map((s) => ({
    ...s,
    isOwner: Boolean(
      req.user?.role === 'admin' ||
      (userId && s.createdBy && (s.createdBy._id || s.createdBy).toString() === userId.toString())
    ),
  }));

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
 * POST /strategies
 * Adds a new strategy to the system. Authenticated users can save their personal strategies,
 * and administrators can create system-wide or custom strategies.
 */
export const createStrategy = asyncHandler(async (req, res) => {
  const {
    name,
    key,
    category,
    description,
    rules,
    timeframes,
    indicators,
    session,
    market,
    tradingPlan,
    supplyDemandType,
    liquidityRules,
    targetRiskReward,
    winRateEstimate,
    isSystem,
  } = req.body;

  if (!name || !name.trim()) throw ApiError.badRequest('Le nom de la stratégie est requis.');

  const baseKey = (key || name).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 30);
  const userSuffix = req.user?._id ? `_${req.user._id.toString().slice(-6)}` : '';
  const finalKey = `${baseKey}${userSuffix}_${Date.now().toString().slice(-4)}`;

  const parsedRules = Array.isArray(rules)
    ? rules
    : typeof rules === 'string'
    ? rules.split('\n').map((r) => r.trim()).filter(Boolean)
    : [];

  const parsedTimeframes = Array.isArray(timeframes)
    ? timeframes
    : typeof timeframes === 'string'
    ? timeframes.split(/[,;\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
    : ['H1'];

  const parsedIndicators = Array.isArray(indicators)
    ? indicators
    : typeof indicators === 'string'
    ? indicators.split(/[,;\n]+/).map((i) => i.trim()).filter(Boolean)
    : [];

  const isAdmin = req.user?.role === 'admin';

  const strategy = await Strategy.create({
    name: name.trim(),
    key: finalKey,
    category: category || 'custom',
    description: description || '',
    rules: parsedRules,
    timeframes: parsedTimeframes.length > 0 ? parsedTimeframes : ['H1'],
    indicators: parsedIndicators,
    session: session || 'Toutes',
    market: market || '',
    tradingPlan: tradingPlan || '',
    supplyDemandType: supplyDemandType || 'order_block_fvg',
    liquidityRules: liquidityRules || 'bsl_ssl',
    targetRiskReward: Number(targetRiskReward) || 3.0,
    winRateEstimate: Number(winRateEstimate) || 85,
    isSystem: isAdmin ? Boolean(isSystem) : false,
    isActive: true,
    createdBy: req.user._id,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Stratégie enregistrée avec succès.',
    data: { strategy: { ...strategy.toObject(), isOwner: true } },
  });
});

/**
 * PUT /strategies/:id
 * Updates an existing strategy (Owner or Admin).
 */
export const updateStrategy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const strategy = await Strategy.findById(id);
  if (!strategy) throw ApiError.notFound('Stratégie introuvable.');

  const isOwner = strategy.createdBy && strategy.createdBy.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Vous ne pouvez modifier que les stratégies que vous avez créées.');
  }

  const updates = { ...req.body };
  if (updates.rules && typeof updates.rules === 'string') {
    updates.rules = updates.rules.split('\n').map((r) => r.trim()).filter(Boolean);
  }
  if (updates.timeframes && typeof updates.timeframes === 'string') {
    updates.timeframes = updates.timeframes.split(/[,;\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  }
  if (updates.indicators && typeof updates.indicators === 'string') {
    updates.indicators = updates.indicators.split(/[,;\n]+/).map((i) => i.trim()).filter(Boolean);
  }
  if (!isAdmin) {
    delete updates.isSystem; // Prevent non-admins from changing system flag
  }

  const updated = await Strategy.findByIdAndUpdate(id, updates, { new: true });

  return sendSuccess(res, {
    message: 'Stratégie mise à jour avec succès.',
    data: { strategy: { ...updated.toObject(), isOwner: true } },
  });
});

/**
 * DELETE /strategies/:id
 * Deletes a strategy from the database (Owner or Admin).
 */
export const deleteStrategy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const strategy = await Strategy.findById(id);
  if (!strategy) throw ApiError.notFound('Stratégie introuvable.');

  const isOwner = strategy.createdBy && strategy.createdBy.equals(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden('Vous ne pouvez supprimer que les stratégies que vous avez créées.');
  }
  if (strategy.isSystem && !isAdmin) {
    throw ApiError.forbidden('Les stratégies système de base ne peuvent être supprimées que par un administrateur.');
  }

  await Strategy.findByIdAndDelete(id);
  return sendSuccess(res, { message: `Stratégie "${strategy.name}" supprimée avec succès.` });
});
