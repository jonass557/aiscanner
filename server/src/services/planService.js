import Plan from '../models/Plan.js';
import { PLANS } from '../config/plans.js';
import logger from '../config/logger.js';

/**
 * Plan service — the single seam for reading plans. Database-backed so the
 * admin panel can manage plans at runtime, with the config file (`plans.js`)
 * used only to SEED an empty collection on first boot.
 *
 * Every read falls back gracefully to the config defaults if the DB is empty
 * or unreachable, so the app (and tests) never break for lack of a DB seed.
 */

export const DEFAULT_PLANS = [
  {
    id: '1mois',
    name: 'Plan 1 Mois',
    price: 7000,
    currency: 'XOF',
    scansPerMonth: -1,
    features: [
      'Essai gratuit 7 jours inclus',
      'Scans de graphiques 100% illimités (∞)',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision',
      'IA Trading Delegate & Surveillance live',
      'IA Mentor bilingue FR/EN',
      'Support prioritaire WhatsApp',
    ],
    isActive: true,
    trial: { enabled: true, days: 7 },
    promo: { enabled: false, price: 3000, durationMonths: 1, description: 'Offre spéciale 1er mois' },
    order: 1,
  },
  {
    id: '2mois',
    name: 'Plan 2 Mois',
    price: 13000,
    currency: 'XOF',
    scansPerMonth: -1,
    features: [
      'Tarif préférentiel 2 mois',
      'Scans de graphiques 100% illimités (∞)',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision',
      'IA Managed Trading & Détection institutionnelle',
      'Backtesting Studio & Replay illimité',
      'Support prioritaire WhatsApp 24/7',
    ],
    isActive: true,
    trial: { enabled: false, days: 0 },
    promo: { enabled: false, price: 10000, durationMonths: 2, description: 'Promotion 2 mois' },
    order: 2,
  },
  {
    id: '6mois',
    name: 'Plan 6 Mois',
    price: 35000,
    currency: 'XOF',
    scansPerMonth: -1,
    features: [
      'Offre Semestrielle VIP (-30% de réduction)',
      'Scans de graphiques 100% illimités (∞)',
      'Accès complet à tous les 11 outils IA',
      'Signaux institutionnels en direct 24/7',
      'Stratégies sur mesure & direct robot execution',
      'Audit personnalisé des positions',
      'Ligne directe WhatsApp VIP',
    ],
    isActive: true,
    trial: { enabled: false, days: 0 },
    promo: { enabled: false, price: 28000, durationMonths: 6, description: 'Promotion Semestrielle VIP' },
    order: 3,
  },
];

/**
 * Insert the 3 default plans (1 mois, 2 mois, 6 mois) into DB if missing.
 * Idempotent: safe to call on every boot.
 */
export const seedPlans = async () => {
  try {
    for (const p of DEFAULT_PLANS) {
      const exists = await Plan.findOne({ id: p.id });
      if (!exists) {
        await Plan.create(p);
      }
    }
  } catch (err) {
    logger.warn(`Plan seeding skipped: ${err.message}`);
  }
};

// Config fallback shaped like a Plan document.
const fromConfig = (id) => {
  const p = PLANS[id];
  if (!p) return null;
  return { ...p, isActive: true, trial: p.trial || { enabled: false, days: 0 }, order: 0 };
};

/**
 * Public plan catalog — active plans only, ordered. Falls back to config.
 */
export const getPublicPlans = async () => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ order: 1, price: 1 }).lean();
    if (plans.length) return plans;
  } catch (err) {
    logger.warn(`getPublicPlans DB read failed: ${err.message}`);
  }
  return DEFAULT_PLANS;
};

/**
 * All plans (incl. inactive) — for the admin panel.
 */
export const listAllPlans = async () => {
  const plans = await Plan.find().sort({ order: 1, price: 1 }).lean();
  return plans;
};

/**
 * Resolve one plan by id. Returns a plain object (DB doc or config fallback).
 * @param {string} id
 * @param {Object} [opts]
 * @param {boolean} [opts.activeOnly=false] - null if the plan is inactive
 */
export const getPlanById = async (id, { activeOnly = false } = {}) => {
  try {
    const plan = await Plan.findOne({ id }).lean();
    if (plan) {
      if (activeOnly && !plan.isActive) return null;
      return plan;
    }
  } catch (err) {
    logger.warn(`getPlanById DB read failed: ${err.message}`);
  }
  return fromConfig(id);
};

export default { seedPlans, getPublicPlans, listAllPlans, getPlanById };
