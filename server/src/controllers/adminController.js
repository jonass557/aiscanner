import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import Analysis from '../models/Analysis.js';
import Log from '../models/Log.js';
import Plan from '../models/Plan.js';
import { PLANS } from '../config/plans.js';
import { logAdmin } from '../services/logService.js';
import config from '../config/index.js';

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
 * Returns current AI provider configuration (keys masked).
 */
export const getAIConfig = asyncHandler(async (req, res) => {
  const mask = (key) => (key ? `${'*'.repeat(8)}${key.slice(-4)}` : null);
  return sendSuccess(res, {
    data: {
      activeProvider: config.ai.provider,
      providers: {
        openai: { model: config.ai.openai.model, configured: Boolean(config.ai.openai.apiKey), keyPreview: mask(config.ai.openai.apiKey) },
        claude: { model: config.ai.claude.model, configured: Boolean(config.ai.claude.apiKey), keyPreview: mask(config.ai.claude.apiKey) },
        gemini: { model: config.ai.gemini.model, configured: Boolean(config.ai.gemini.apiKey), keyPreview: mask(config.ai.gemini.apiKey) },
      },
    },
  });
});
