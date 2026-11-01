import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { getMarketSnapshot } from '../services/marketData/index.js';
import { normalizeTimeframe } from '../services/marketData/timeframe.js';

// High-concurrency in-memory snapshot cache & in-flight coalescing
const snapshotCache = new Map();
const inFlightPromises = new Map();
const SNAPSHOT_CACHE_TTL_MS = 10000; // 10 seconds TTL protects against 429 rate-limiting

/**
 * GET /market/snapshot?symbol=&timeframe=
 *
 * Live market snapshot (quote + candles) for a resolved symbol + timeframe.
 * Powers the real-time chart on the scanner result, Chart Vision, and Backtesting.
 *
 * Hardened for high traffic:
 * 1) In-memory cache returns cached snapshots in < 1ms for concurrent user requests.
 * 2) In-flight request coalescing ensures only 1 upstream query runs per (symbol, timeframe).
 */
export const getSnapshot = asyncHandler(async (req, res) => {
  const { symbol, timeframe } = req.query;
  if (!symbol) throw ApiError.badRequest('A symbol is required.');

  const tf = normalizeTimeframe(timeframe);
  const requestedLimit = Number(req.query.limit);
  // Support high-depth / multi-year history requests up to 15000 bars for backtesting
  const candleLimit = requestedLimit === 0 || req.query.limit === 'max'
    ? 15000
    : Math.min(Math.max(requestedLimit || 200, 30), 15000);

  const cacheKey = `${String(symbol).toUpperCase()}|${tf}|${candleLimit}`;
  const now = Date.now();

  const cached = snapshotCache.get(cacheKey);
  if (cached && (now - cached.timestamp < SNAPSHOT_CACHE_TTL_MS)) {
    return sendSuccess(res, {
      message: 'Market snapshot (cached).',
      data: { market: cached.snapshot },
    });
  }

  let fetchPromise = inFlightPromises.get(cacheKey);
  if (!fetchPromise) {
    fetchPromise = getMarketSnapshot(symbol, tf, candleLimit)
      .then((snap) => {
        if (snap) {
          snapshotCache.set(cacheKey, { snapshot: snap, timestamp: Date.now() });
          // Limit cache map size to 1000 entries
          if (snapshotCache.size > 1000) {
            const firstKey = snapshotCache.keys().next().value;
            snapshotCache.delete(firstKey);
          }
        }
        return snap;
      })
      .finally(() => {
        inFlightPromises.delete(cacheKey);
      });

    inFlightPromises.set(cacheKey, fetchPromise);
  }

  const snapshot = await fetchPromise;

  if (!snapshot) {
    throw ApiError.notFound(`Symbol "${symbol}" could not be resolved to a known market.`);
  }

  return sendSuccess(res, {
    message: 'Market snapshot.',
    data: { market: snapshot },
  });
});
