import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Plan from '../models/Plan.js';
import { listAllPlans } from '../services/planService.js';
import { logAdmin } from '../services/logService.js';

/**
 * Admin plan management — full CRUD over database-backed subscription plans,
 * including enable/disable and free-trial configuration.
 */

const PLAN_FIELDS = ['name', 'price', 'currency', 'scansPerMonth', 'features', 'isActive', 'order'];

/** GET /admin/plans — all plans, including inactive. */
export const listPlans = asyncHandler(async (req, res) => {
  const plans = await listAllPlans();
  return sendSuccess(res, { data: { plans } });
});

/** POST /admin/plans — create a plan. */
export const createPlan = asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    throw ApiError.badRequest('A lowercase slug id is required (letters, digits, dashes).');
  }
  const exists = await Plan.findOne({ id });
  if (exists) throw ApiError.conflict('A plan with this id already exists.');

  const plan = await Plan.create({
    id,
    name: req.body.name || id,
    price: req.body.price ?? 0,
    currency: req.body.currency || 'USD',
    scansPerMonth: req.body.scansPerMonth ?? 5,
    features: Array.isArray(req.body.features) ? req.body.features : [],
    isActive: req.body.isActive ?? true,
    trial: {
      enabled: req.body.trial?.enabled ?? false,
      days: req.body.trial?.days ?? 7,
    },
    order: req.body.order ?? 0,
  });

  await logAdmin('create_plan', { message: `Admin created plan ${id}`, userId: req.user._id, metadata: { planId: id } });
  return sendSuccess(res, { statusCode: 201, message: 'Plan created.', data: { plan } });
});

/** PATCH /admin/plans/:id — update a plan (price, scans, features, trial, isActive…). */
export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({ id: req.params.id });
  if (!plan) throw ApiError.notFound('Plan not found.');

  for (const field of PLAN_FIELDS) {
    if (req.body[field] !== undefined) plan[field] = req.body[field];
  }
  if (req.body.trial !== undefined) {
    if (req.body.trial.enabled !== undefined) plan.trial.enabled = Boolean(req.body.trial.enabled);
    if (req.body.trial.days !== undefined) plan.trial.days = Math.max(0, Number(req.body.trial.days) || 0);
  }

  await plan.save();
  await logAdmin('update_plan', { message: `Admin updated plan ${plan.id}`, userId: req.user._id, metadata: { planId: plan.id, changes: req.body } });
  return sendSuccess(res, { message: 'Plan updated.', data: { plan } });
});

/** POST /admin/plans/:id/toggle — enable/disable a plan. */
export const togglePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({ id: req.params.id });
  if (!plan) throw ApiError.notFound('Plan not found.');
  plan.isActive = !plan.isActive;
  await plan.save();
  await logAdmin('toggle_plan', { message: `Admin ${plan.isActive ? 'enabled' : 'disabled'} plan ${plan.id}`, userId: req.user._id, metadata: { planId: plan.id, isActive: plan.isActive } });
  return sendSuccess(res, { message: `Plan ${plan.isActive ? 'enabled' : 'disabled'}.`, data: { plan } });
});

/** DELETE /admin/plans/:id — delete a plan. */
export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({ id: req.params.id });
  if (!plan) throw ApiError.notFound('Plan not found.');
  await plan.deleteOne();
  await logAdmin('delete_plan', { message: `Admin deleted plan ${plan.id}`, userId: req.user._id, metadata: { planId: plan.id } });
  return sendSuccess(res, { message: 'Plan deleted.' });
});
