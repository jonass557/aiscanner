import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import EconomicEvent from '../models/EconomicEvent.js';
import { refreshCalendar, getUpcomingHighImpact, enrichWithAIAnalysis } from '../services/economicCalendarService.js';

/**
 * GET /economic-news
 * Filterable calendar listing. Query: from, to, impact, currency, market, page, limit.
 */
export const listEvents = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  const filter = {};
  if (req.query.impact) filter.impact = req.query.impact;
  if (req.query.currency) filter.currency = req.query.currency.toUpperCase();
  if (req.query.market) filter.affectedMarkets = req.query.market.toUpperCase();

  if (req.query.from || req.query.to) {
    filter.dateTime = {};
    if (req.query.from) filter.dateTime.$gte = new Date(req.query.from);
    if (req.query.to) filter.dateTime.$lte = new Date(req.query.to);
  } else {
    // Default window: from 1 day ago to 7 days ahead.
    const now = new Date();
    filter.dateTime = {
      $gte: new Date(now.getTime() - 24 * 3600 * 1000),
      $lte: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
    };
  }

  const [items, total] = await Promise.all([
    EconomicEvent.find(filter).sort({ dateTime: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    EconomicEvent.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { events: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /economic-news/upcoming
 * High-impact events within the next N hours (default 24). Used by the
 * dashboard warning banner.
 */
export const upcomingHighImpact = asyncHandler(async (req, res) => {
  const hours = Math.min(168, Math.max(1, parseInt(req.query.hours, 10) || 24));
  const events = await getUpcomingHighImpact(hours);
  return sendSuccess(res, { data: { events, count: events.length } });
});

/**
 * GET /economic-news/:id
 * Event detail, enriched with AI analysis on first access.
 */
export const getEvent = asyncHandler(async (req, res) => {
  const event = await EconomicEvent.findById(req.params.id);
  if (!event) throw ApiError.notFound('Event not found.');
  await enrichWithAIAnalysis(event);
  return sendSuccess(res, { data: { event } });
});

/**
 * POST /economic-news/refresh  (admin)
 * Force a calendar refresh.
 */
export const refresh = asyncHandler(async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.body.days, 10) || 7));
  const result = await refreshCalendar(days);
  return sendSuccess(res, { message: 'Calendar refreshed.', data: result });
});
