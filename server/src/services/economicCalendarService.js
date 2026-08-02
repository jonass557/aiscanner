import EconomicEvent from '../models/EconomicEvent.js';
import { getProvider } from './ai/index.js';
import logger from '../config/logger.js';

/**
 * Economic Calendar service.
 *
 * MVP/zero-config: generates a realistic week of macro events instead of
 * requiring a paid calendar feed. The data-source seam is `fetchRawEvents()` —
 * swap it for a ForexFactory / Trading Economics fetch later without touching
 * storage, AI enrichment, or the scheduler.
 */

const CURRENCY_MARKETS = {
  USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'US30', 'NAS100', 'XAUUSD', 'BTCUSD'],
  EUR: ['EURUSD', 'EURGBP', 'EURJPY', 'GER40'],
  GBP: ['GBPUSD', 'EURGBP', 'GBPJPY', 'UK100'],
  JPY: ['USDJPY', 'EURJPY', 'GBPJPY'],
  CAD: ['USDCAD', 'CADJPY'],
  AUD: ['AUDUSD', 'AUDJPY'],
};

// A pool of recurring, realistic macro releases keyed by currency + impact.
const EVENT_TEMPLATES = [
  { title: 'Non-Farm Payrolls (NFP)', currency: 'USD', impact: 'high' },
  { title: 'CPI m/m', currency: 'USD', impact: 'high' },
  { title: 'FOMC Statement & Rate Decision', currency: 'USD', impact: 'high' },
  { title: 'Unemployment Claims', currency: 'USD', impact: 'medium' },
  { title: 'Retail Sales m/m', currency: 'USD', impact: 'medium' },
  { title: 'ISM Manufacturing PMI', currency: 'USD', impact: 'medium' },
  { title: 'ECB Main Refinancing Rate', currency: 'EUR', impact: 'high' },
  { title: 'German Flash CPI', currency: 'EUR', impact: 'medium' },
  { title: 'ECB Press Conference', currency: 'EUR', impact: 'high' },
  { title: 'BOE Official Bank Rate', currency: 'GBP', impact: 'high' },
  { title: 'UK CPI y/y', currency: 'GBP', impact: 'medium' },
  { title: 'BOJ Policy Rate', currency: 'JPY', impact: 'high' },
  { title: 'Employment Change', currency: 'CAD', impact: 'medium' },
  { title: 'RBA Rate Statement', currency: 'AUD', impact: 'high' },
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtNum = () => (Math.random() * 5).toFixed(1) + '%';

/**
 * DATA SOURCE SEAM. Returns raw calendar rows for the next `days` days.
 * Replace the body with a real HTTP fetch to go live; keep the return shape.
 */
const fetchRawEvents = async (days = 7) => {
  const events = [];
  const now = new Date();

  for (let d = 0; d < days; d += 1) {
    // 2-4 events per day.
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i += 1) {
      const tpl = rand(EVENT_TEMPLATES);
      const dt = new Date(now);
      dt.setDate(now.getDate() + d);
      dt.setHours(8 + Math.floor(Math.random() * 10), rand([0, 30]), 0, 0);

      const externalId = `${tpl.title}-${dt.toISOString().slice(0, 13)}`;
      events.push({
        externalId,
        title: tpl.title,
        currency: tpl.currency,
        country: tpl.currency,
        dateTime: dt,
        impact: tpl.impact,
        forecast: fmtNum(),
        previous: fmtNum(),
        actual: dt < now ? fmtNum() : null,
        affectedMarkets: CURRENCY_MARKETS[tpl.currency] || [],
      });
    }
  }
  return events;
};

/**
 * Refresh the calendar: fetch raw events and upsert them by externalId.
 * @param {number} [days]
 * @returns {Promise<{ upserted: number }>}
 */
export const refreshCalendar = async (days = 7) => {
  const raw = await fetchRawEvents(days);
  let upserted = 0;
  for (const e of raw) {
    const res = await EconomicEvent.updateOne(
      { externalId: e.externalId },
      { $set: e },
      { upsert: true }
    );
    if (res.upsertedCount || res.modifiedCount) upserted += 1;
  }
  logger.info(`Economic calendar refreshed: ${upserted} events upserted.`);
  return { upserted };
};

/**
 * High-impact events happening within the next `hours` hours.
 * @param {number} [hours]
 */
export const getUpcomingHighImpact = async (hours = 24) => {
  const now = new Date();
  const until = new Date(now.getTime() + hours * 3600 * 1000);
  return EconomicEvent.find({
    impact: 'high',
    dateTime: { $gte: now, $lte: until },
  })
    .sort({ dateTime: 1 })
    .lean();
};

/**
 * Enrich an event with an AI impact analysis (cached on the document).
 * @param {Object} event - EconomicEvent mongoose doc
 */
export const enrichWithAIAnalysis = async (event) => {
  if (event.aiAnalysis?.summary) return event; // already analyzed

  const provider = getProvider();
  const prompt = `You are a macro trading analyst. Analyze this upcoming economic release and its likely market impact.

Event: ${event.title}
Currency: ${event.currency}
Impact rating: ${event.impact}
Forecast: ${event.forecast}
Previous: ${event.previous}
Affected markets: ${(event.affectedMarkets || []).join(', ')}

Return ONLY JSON:
{
  "summary": string (2-3 sentences on what this release is and why it matters),
  "expectedImpact": string (e.g. "USD bullish if actual beats forecast, bearish if it misses"),
  "volatilityRisk": "high|medium|low",
  "tradingAdvice": string (1-2 sentences of risk-aware guidance, e.g. avoid entering just before release)
}`;

  try {
    const raw = await provider.chat({
      systemPrompt: 'You are a concise, risk-aware macroeconomic analyst. Respond only with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    });
    const { extractJson } = await import('./ai/responseParser.js');
    const data = extractJson(raw);
    event.aiAnalysis = {
      summary: String(data.summary || '').slice(0, 2000),
      expectedImpact: String(data.expectedImpact || '').slice(0, 500),
      volatilityRisk: ['high', 'medium', 'low'].includes(data.volatilityRisk) ? data.volatilityRisk : event.impact === 'high' ? 'high' : 'medium',
      tradingAdvice: String(data.tradingAdvice || '').slice(0, 1000),
      analyzedAt: new Date(),
    };
    await event.save();
  } catch (err) {
    logger.warn(`AI enrichment failed for event ${event._id}: ${err.message}`);
  }
  return event;
};

// --- Scheduler ---------------------------------------------------------------

let calendarTimer = null;

/**
 * Start the periodic calendar refresh (default hourly).
 */
export const startCalendarRefresh = (intervalMs = 60 * 60 * 1000) => {
  if (calendarTimer) return;
  const tick = () => refreshCalendar().catch((err) => logger.error(`Calendar refresh failed: ${err.message}`));
  setTimeout(tick, 8000); // initial refresh shortly after boot
  calendarTimer = setInterval(tick, intervalMs);
  logger.info(`Economic calendar refresh started (every ${Math.round(intervalMs / 60000)} min).`);
};

export const stopCalendarRefresh = () => {
  if (calendarTimer) {
    clearInterval(calendarTimer);
    calendarTimer = null;
  }
};
