import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import Analysis from '../models/Analysis.js';
import Log from '../models/Log.js';
import Plan from '../models/Plan.js';
import { PLANS } from '../config/plans.js';
import { logAdmin } from '../services/logService.js';
import config from '../config/index.js';
import * as settingsService from '../services/settings/settingsService.js';

/**
 * GET /admin/stats
 * Global platform statistics for the admin dashboard.
 */
export const getAdminStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    verifiedUsers,
    totalScans,
    scansToday,
    scansThisMonth,
    usersByPlan,
    scansByDecision,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isVerified: true }),
    Analysis.countDocuments(),
    Analysis.countDocuments({ createdAt: { $gte: startOfDay } }),
    Analysis.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.aggregate([{ $group: { _id: '$subscription.plan', count: { $sum: 1 } } }]),
    Analysis.aggregate([{ $group: { _id: '$decision', count: { $sum: 1 } } }]),
    User.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Estimated monthly revenue from active paid plans.
  const planCounts = usersByPlan.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {});
  const estimatedRevenue =
    (planCounts.pro || 0) * PLANS.pro.price + (planCounts.premium || 0) * PLANS.premium.price;

  return sendSuccess(res, {
    data: {
      users: { total: totalUsers, verified: verifiedUsers, byPlan: planCounts },
      scans: {
        total: totalScans,
        today: scansToday,
        thisMonth: scansThisMonth,
        byDecision: scansByDecision.reduce((acc, d) => ({ ...acc, [d._id]: d.count }), {}),
      },
      revenue: { estimatedMonthly: estimatedRevenue, currency: 'USD' },
      recentUsers,
    },
  });
});

/**
 * GET /admin/users
 * Paginated user list with search.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { email: new RegExp(req.query.search, 'i') },
      { firstName: new RegExp(req.query.search, 'i') },
      { lastName: new RegExp(req.query.search, 'i') },
    ];
  }
  if (req.query.plan) filter['subscription.plan'] = req.query.plan;
  if (req.query.role) filter.role = req.query.role;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { users },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /admin/users/:id
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found.');
  const scanCount = await Analysis.countDocuments({ userId: user._id });
  return sendSuccess(res, { data: { user, scanCount } });
});

/**
 * PATCH /admin/users/:id
 * Update a user's plan, status, role, or scan credits. The admin can assign
 * ANY plan (including paid ones) freely — this is an admin override.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  const { plan, status, role, scansPerMonth, addCredits, isVerified } = req.body;

  if (plan) {
    // Admin override: allow assigning any plan, active or not, free or paid.
    const planDoc = await Plan.findOne({ id: plan }).lean();
    if (!planDoc) throw ApiError.badRequest('Invalid plan.');
    user.subscription.plan = planDoc.id;
    user.subscription.scansPerMonth = planDoc.scansPerMonth;
    user.subscription.status = 'active';
    user.subscription.startDate = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    user.subscription.endDate = end;
  }
  if (status) user.subscription.status = status;
  if (role) user.role = role;
  if (typeof scansPerMonth === 'number') user.subscription.scansPerMonth = scansPerMonth;
  if (typeof addCredits === 'number') {
    // Grant credits by reducing scansUsed (never below 0).
    user.subscription.scansUsed = Math.max(0, user.subscription.scansUsed - addCredits);
  }
  if (typeof isVerified === 'boolean') user.isVerified = isVerified;

  await user.save();
  await logAdmin('update_user', {
    message: `Admin updated user ${user.email}`,
    userId: req.user._id,
    metadata: { targetUser: user._id, changes: req.body },
    ip: req.ip,
  });

  return sendSuccess(res, { message: 'User updated.', data: { user } });
});

/**
 * DELETE /admin/users/:id
 */
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw ApiError.badRequest('You cannot delete your own admin account.');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  await Analysis.deleteMany({ userId: user._id });
  await user.deleteOne();

  await logAdmin('delete_user', {
    message: `Admin deleted user ${user.email}`,
    userId: req.user._id,
    metadata: { targetUser: user._id },
    ip: req.ip,
  });

  return sendSuccess(res, { message: 'User and their data deleted.' });
});

/**
 * GET /admin/logs
 * Filterable system logs.
 */
export const listLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.level) filter.level = req.query.level;

  const [logs, total] = await Promise.all([
    Log.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'email').lean(),
    Log.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { logs },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /admin/ai-config
 * Returns current AI/vision/payment provider configuration (keys masked).
 * Reflects EFFECTIVE values (DB overrides via settingsService, else env).
 */
export const getAIConfig = asyncHandler(async (req, res) => {
  const mask = (key) => (key ? `${'*'.repeat(8)}${key.slice(-4)}` : null);
  const val = (k) => settingsService.getValue(k);
  return sendSuccess(res, {
    data: {
      activeProvider: val('ai.provider') || config.ai.provider,
      activeVisionProvider: val('vision.provider') || config.vision.provider,
      activePaymentProvider: val('payments.provider') || config.payments.provider,
      providers: {
        openai: { model: val('ai.openai.model'), configured: Boolean(val('ai.openai.apiKey')), keyPreview: mask(val('ai.openai.apiKey')) },
        claude: { model: val('ai.claude.model'), configured: Boolean(val('ai.claude.apiKey')), keyPreview: mask(val('ai.claude.apiKey')) },
        gemini: { model: val('ai.gemini.model'), configured: Boolean(val('ai.gemini.apiKey')), keyPreview: mask(val('ai.gemini.apiKey')) },
        nvidia: { model: val('ai.nvidia.model'), configured: Boolean(val('ai.nvidia.apiKey')), keyPreview: mask(val('ai.nvidia.apiKey')) },
      },
      payments: {
        sebpay: { configured: Boolean(val('payments.sebpay.secretKey')), keyPreview: mask(val('payments.sebpay.secretKey')) },
      },
    },
  });
});

/**
 * GET /admin/settings
 * Grouped, client-safe view of all editable settings. Secrets are masked and
 * never returned in clear.
 */
export const getSettings = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { settings: settingsService.getPublicSettings() } });
});

/**
 * PUT /admin/settings
 * Upsert a batch of settings: body = { settings: [{ key, value }, ...] }.
 * Only whitelisted keys (settingsService.SETTING_DEFS) are accepted; unknown
 * keys are rejected. Secrets are encrypted at rest by the service.
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body.settings) ? req.body.settings : [];
  if (!entries.length) throw ApiError.badRequest('No settings provided.');

  const allowed = new Set(settingsService.SETTING_DEFS.map((d) => d.key));
  const invalid = entries.filter((e) => !e || !allowed.has(e.key));
  if (invalid.length) {
    throw ApiError.badRequest(`Unknown setting key(s): ${invalid.map((e) => e?.key).join(', ')}`);
  }

  await settingsService.setMany(entries, req.user._id);

  await logAdmin('update_settings', {
    message: `Admin updated ${entries.length} setting(s)`,
    userId: req.user._id,
    // Never log secret values — only which keys changed.
    metadata: { keys: entries.map((e) => e.key) },
    ip: req.ip,
  });

  return sendSuccess(res, {
    message: 'Settings updated.',
    data: { settings: settingsService.getPublicSettings() },
  });
});

/**
 * POST /admin/settings/test-provider
 * Best-effort connectivity check for a provider using its EFFECTIVE key.
 * body = { provider: 'openai'|'claude'|'gemini'|'nvidia' }.
 * Returns { ok, message } without exposing the key.
 */
export const testProvider = asyncHandler(async (req, res) => {
  const provider = String(req.body.provider || '').toLowerCase();
  const apiKey = settingsService.getValue(`ai.${provider}.apiKey`);
  if (!apiKey) {
    return sendSuccess(res, { data: { ok: false, message: 'No API key configured for this provider.' } });
  }

  let ok = false;
  let message = '';
  try {
    if (provider === 'openai' || provider === 'nvidia') {
      const baseUrl = provider === 'nvidia' ? settingsService.getValue('ai.nvidia.baseUrl') : 'https://api.openai.com/v1';
      const r = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
      ok = r.ok;
      message = r.ok ? 'Connection successful.' : `Provider returned HTTP ${r.status}.`;
    } else if (provider === 'claude') {
      // Minimal Messages call; 200 or a 400 "credit"/validation still proves the key is accepted vs 401.
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: settingsService.getValue('ai.claude.model') || 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      ok = r.status !== 401 && r.status !== 403;
      message = ok ? 'Connection successful.' : 'Authentication failed (invalid key).';
    } else if (provider === 'gemini') {
      const model = settingsService.getValue('ai.gemini.model') || 'gemini-1.5-pro';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`);
      ok = r.ok;
      message = r.ok ? 'Connection successful.' : `Provider returned HTTP ${r.status}.`;
    } else {
      throw ApiError.badRequest('Unknown provider.');
    }
  } catch (err) {
    ok = false;
    message = `Connection failed: ${err.message}`;
  }

  return sendSuccess(res, { data: { ok, message } });
});
