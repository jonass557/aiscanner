import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { getMarketSnapshot } from '../services/marketData/index.js';
import { normalizeTimeframe } from '../services/marketData/timeframe.js';

/**
 * GET /market/snapshot?symbol=&timeframe=
 *
 * Live market snapshot (quote + candles) for a resolved symbol + timeframe.
 * Powers the real-time chart on the scanner result: after a scan detects the
 * pair + timeframe, the client polls this to keep the candles fresh.
 *
 * Never fabricates data silently — the response carries `source` + `isRealData`
 * so the UI can flag simulated data. Returns 404 only when the symbol itself
 * can't be resolved.
 */
export const getSnapshot = asyncHandler(async (req, res) => {
  const { symbol, timeframe } = req.query;
  if (!symbol) throw ApiError.badRequest('A symbol is required.');

  const tf = normalizeTimeframe(timeframe);
  const snapshot = await getMarketSnapshot(symbol, tf, 150);

  if (!snapshot) {
    throw ApiError.notFound(`Symbol "${symbol}" could not be resolved to a known market.`);
  }

  return sendSuccess(res, {
    message: 'Market snapshot.',
    data: { market: snapshot },
  });
});
