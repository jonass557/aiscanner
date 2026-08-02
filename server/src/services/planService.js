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

/**
 * Insert the config plans into the DB if the collection is empty.
 * Idempotent: safe to call on every boot.
 */
export const seedPlans = async () => {
  try {
    const count = await Plan.countDocuments();
    if (count > 0) return;
    const docs = Object.values(PLANS).map((p, i) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: p.currency,
      scansPerMonth: p.scansPerMonth,
      features: p.features,
      isActive: true,
      trial: { enabled: false, days: 7 },
      order: i,
    }));
    await Plan.insertMany(docs);
    logger.info(`Seeded ${docs.length} subscription plans into the database.`);
  } catch (err) {
    logger.warn(`Plan seeding skipped: ${err.message}`);
  }
};

// Config fallback shaped like a Plan document.
const fromConfig = (id) => {
  const p = PLANS[id];
  if (!p) return null;
  return { ...p, isActive: true, trial: { enabled: false, days: 7 }, order: 0 };
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
  return Object.values(PLANS).map((p, i) => ({ ...fromConfig(p.id), _id: p.id, order: i }));
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
