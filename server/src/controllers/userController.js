import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { getPublicPlans, getPlanById } from '../services/planService.js';
import { logAuth } from '../services/logService.js';

/**
 * GET /users/plans  (public)
 * Returns the ACTIVE plan catalog (DB-backed) for the pricing page.
 */
export const getPlans = asyncHandler(async (req, res) => {
  const plans = await getPublicPlans();
  return sendSuccess(res, { data: { plans } });
});

/**
 * PATCH /users/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName } = req.body;
  const user = req.user;
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  await user.save();
  return sendSuccess(res, { message: 'Profile updated.', data: { user } });
});

/**
 * PATCH /users/password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await req.user.constructor.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect.');
  }
  user.password = newPassword;
  await user.save();
  await logAuth('change_password', { message: 'Password changed', userId: user._id, ip: req.ip });
  return sendSuccess(res, { message: 'Password changed successfully.' });
});

/**
 * POST /users/subscription
 * Changes the current user's plan. In production this is gated behind SebPay
 * payment (see paymentController); this endpoint applies free plans directly
 * and honors a plan's free trial when enabled by the admin.
 */
export const changeSubscription = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const planDef = await getPlanById(plan, { activeOnly: true });
  if (!planDef) throw ApiError.badRequest('Invalid or inactive plan.');

  const user = req.user;

  // Paid plans must go through payment unless it's a free plan or an offered trial.
  const trialAvailable = planDef.trial?.enabled && user.trial?.appliedFor !== plan;
  if (planDef.price > 0 && !trialAvailable) {
    throw ApiError.badRequest('Ce plan est payant. Utilisez le paiement Mobile Money pour y souscrire.');
  }

  user.subscription.plan = plan;
  user.subscription.status = 'active';
  user.subscription.scansPerMonth = planDef.scansPerMonth;
  user.subscription.startDate = new Date();
  const end = new Date();
  // Trial → end at trial length; otherwise a month.
  if (trialAvailable) {
    end.setDate(end.getDate() + (planDef.trial.days || 7));
    user.trial = { startedAt: new Date(), appliedFor: plan };
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  user.subscription.endDate = end;
  await user.save();

  await logAuth('change_subscription', {
    message: `Subscribed to ${planDef.name}${trialAvailable ? ' (free trial)' : ''}`,
    userId: user._id,
  });

  return sendSuccess(res, {
    message: trialAvailable
      ? `Essai gratuit de ${planDef.trial.days} jours activé pour ${planDef.name}.`
      : `Subscription changed to ${planDef.name}.`,
    data: { user },
  });
});

/**
 * GET /users/preferences
 * Returns the current user's trading preferences (with schema defaults).
 */
export const getPreferences = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { preferences: req.user.preferences || {} } });
});

// Whitelist of updatable preference keys, with light coercion/validation.
const PREFERENCE_FIELDS = {
  level: (v) => (['beginner', 'intermediate', 'expert'].includes(v) ? v : undefined),
  favoriteStrategy: (v) => (['smc', 'ict', 'price-action', 'custom'].includes(v) ? v : undefined),
  customStrategy: (v) => (typeof v === 'string' ? v.slice(0, 2000) : undefined),
  riskPercent: (v) => (Number.isFinite(+v) ? Math.min(100, Math.max(0.1, +v)) : undefined),
  minRiskReward: (v) => (Number.isFinite(+v) ? Math.min(20, Math.max(0.5, +v)) : undefined),
  favoriteMarkets: (v) => (Array.isArray(v) ? v.map(String).slice(0, 20) : undefined),
  favoriteTimeframes: (v) => (Array.isArray(v) ? v.map(String).slice(0, 20) : undefined),
  language: (v) => (['fr', 'en'].includes(v) ? v : undefined),
};

/**
 * PATCH /users/preferences
 * Merges validated preference fields into the user's profile.
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.preferences) user.preferences = {};

  for (const [key, coerce] of Object.entries(PREFERENCE_FIELDS)) {
    if (req.body[key] !== undefined) {
      const value = coerce(req.body[key]);
      if (value !== undefined) user.preferences[key] = value;
    }
  }

  await user.save();
  return sendSuccess(res, { message: 'Preferences updated.', data: { preferences: user.preferences } });
});
