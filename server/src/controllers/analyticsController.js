import AnalyticsEvent from '../models/AnalyticsEvent.js';
import { asyncHandler } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

const PATH_FEATURE_MAP = {
  '/dashboard': 'Dashboard Accueil',
  '/dashboard/scanner': 'AI Scanner',
  '/dashboard/chart-vision': 'Chart Vision',
  '/dashboard/opportunities': 'Robot (Opportunités)',
  '/dashboard/managed-trading': 'AI Managed Trading',
  '/dashboard/delegate': 'Trading Delegate',
  '/dashboard/backtesting': 'Backtesting Studio',
  '/dashboard/mentor': 'IA Mentor',
  '/dashboard/multi-timeframe': 'Multi-Timeframe Analysis',
  '/dashboard/journal': 'Journal de Trading',
  '/dashboard/trade-validator': 'Validateur de Trade',
  '/dashboard/calculator': 'Calculateur de Position',
  '/dashboard/economic-news': 'Actualités Économiques',
  '/dashboard/voice-assistant': 'Assistant Vocal',
  '/dashboard/subscription': 'Abonnements & Plans',
  '/dashboard/history': 'Historique des Analyses',
  '/dashboard/profile': 'Profil Utilisateur',
  '/dashboard/settings': 'Paramètres',
  '/': 'Page d\'accueil (Landing)',
  '/login': 'Connexion',
  '/register': 'Inscription & Free Trial',
};

const resolveFeatureName = (path) => {
  if (PATH_FEATURE_MAP[path]) return PATH_FEATURE_MAP[path];
  for (const [prefix, name] of Object.entries(PATH_FEATURE_MAP)) {
    if (prefix !== '/' && path.startsWith(prefix)) return name;
  }
  return path.startsWith('/admin') ? 'Administration' : 'Autre Page';
};

const detectDevice = (ua = '') => {
  const s = ua.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(s)) return 'tablet';
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(s)) {
    return 'mobile';
  }
  return 'desktop';
};

/**
 * POST /api/v1/analytics/track
 * Ingests a page view event.
 */
export const trackPageView = asyncHandler(async (req, res) => {
  const { path, featureName, deviceType } = req.body;
  if (!path || typeof path !== 'string') {
    return sendSuccess(res, { data: { tracked: false } });
  }

  const rawUa = req.headers['user-agent'] || '';
  const detectedDevice = deviceType || detectDevice(rawUa);
  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();
  const effectiveFeature = featureName || resolveFeatureName(path);

  // Asynchronous write without blocking
  AnalyticsEvent.create({
    path: path.slice(0, 100),
    featureName: effectiveFeature.slice(0, 80),
    userId: req.user?._id || null,
    ip: clientIp.slice(0, 45),
    deviceType: detectedDevice,
    userAgent: rawUa.slice(0, 200),
  }).catch(() => {});

  return sendSuccess(res, { data: { tracked: true } });
});

/**
 * GET /api/v1/admin/analytics
 * Returns top features, top pages, traffic trends and device breakdown.
 */
export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    totalViews,
    todayViews,
    uniqueVisitorsToday,
    topFeaturesRaw,
    topPagesRaw,
    deviceBreakdownRaw,
    timelineRaw,
  ] = await Promise.all([
    AnalyticsEvent.countDocuments(),
    AnalyticsEvent.countDocuments({ createdAt: { $gte: startOfDay } }),
    AnalyticsEvent.distinct('ip', { createdAt: { $gte: startOfDay } }).then((ips) => ips.length),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: '$featureName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: '$path', count: { $sum: 1 }, feature: { $first: '$featureName' } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          views: { $sum: 1 },
          uniqueIps: { $addToSet: '$ip' },
        },
      },
      {
        $project: {
          date: '$_id',
          views: 1,
          uniqueVisitors: { $size: '$uniqueIps' },
        },
      },
      { $sort: { date: 1 } },
    ]),
  ]);

  const totalPeriodFeatures = topFeaturesRaw.reduce((sum, item) => sum + item.count, 0) || 1;
  const topFeatures = topFeaturesRaw.map((f) => ({
    name: f._id || 'Autre',
    count: f.count,
    percentage: Math.round((f.count / totalPeriodFeatures) * 100),
  }));

  const topPages = topPagesRaw.map((p) => ({
    path: p._id || '/',
    feature: p.feature || resolveFeatureName(p._id),
    count: p.count,
  }));

  const totalDevices = deviceBreakdownRaw.reduce((sum, d) => sum + d.count, 0) || 1;
  const devices = deviceBreakdownRaw.map((d) => ({
    type: d._id || 'desktop',
    count: d.count,
    percentage: Math.round((d.count / totalDevices) * 100),
  }));

  return sendSuccess(res, {
    data: {
      summary: {
        totalViews,
        todayViews,
        uniqueVisitorsToday,
      },
      topFeatures,
      topPages,
      devices,
      timeline: timelineRaw,
    },
  });
});
