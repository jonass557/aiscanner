import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import MultiTimeframeAnalysis from '../models/MultiTimeframeAnalysis.js';
import { uploadImage, deleteImage } from '../services/uploadService.js';
import { analyzeMultiTimeframe, assertVisionReady } from '../services/ai/index.js';
import { logScan } from '../services/logService.js';
import logger from '../config/logger.js';

// Timeframes ordered low -> high so the model gets a consistent top-down frame.
const TF_ORDER = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];
const tfRank = (tf) => {
  const i = TF_ORDER.indexOf(String(tf).toUpperCase());
  return i === -1 ? 999 : i;
};

/**
 * POST /multi-timeframe-scan
 * Accepts 2..6 chart images (field "images") plus a parallel "timeframes"
 * array labeling each image. Flow mirrors the single scan:
 *  1. Enforce scan credits.
 *  2. Upload every image.
 *  3. Create a pending record.
 *  4. Run one multi-image AI analysis, parse, persist.
 *  5. Consume a single credit on success.
 */
export const scanMultiTimeframe = asyncHandler(async (req, res) => {
  const user = req.user;

  const files = req.files || [];
  // timeframes may arrive as an array or a single string (multipart).
  let timeframes = req.body.timeframes;
  if (typeof timeframes === 'string') timeframes = [timeframes];
  timeframes = Array.isArray(timeframes) ? timeframes : [];

  if (files.length < 2) {
    throw ApiError.badRequest('Please provide at least 2 timeframe charts to compare.');
  }
  if (files.length > 6) {
    throw ApiError.badRequest('You can compare at most 6 timeframes at once.');
  }
  if (timeframes.length !== files.length) {
    throw ApiError.badRequest('Each chart must have a matching timeframe label.');
  }

  if (!user.canScan()) {
    throw ApiError.forbidden(
      'You have no scans remaining this month. Please upgrade your plan or wait for your monthly reset.'
    );
  }

  // Guard: never run a mock analysis in production (fabricated results).
  try {
    assertVisionReady();
  } catch (err) {
    throw ApiError.serviceUnavailable(err.message);
  }

  // 1. Upload every image, keeping its timeframe label. Sort low -> high.
  const uploaded = [];
  try {
    for (let i = 0; i < files.length; i += 1) {
      const { url, publicId } = await uploadImage(files[i].buffer, user._id.toString());
      uploaded.push({ timeframe: String(timeframes[i]).toUpperCase(), url, publicId });
    }
  } catch (err) {
    await Promise.all(uploaded.map((u) => deleteImage(u.publicId)));
    logger.error(`Multi-TF upload failed for user ${user._id}: ${err.message}`);
    throw ApiError.internal('Failed to upload one or more charts. Please try again.');
  }

  uploaded.sort((a, b) => tfRank(a.timeframe) - tfRank(b.timeframe));

  // 2. Create pending record
  const record = await MultiTimeframeAnalysis.create({
    userId: user._id,
    timeframes: uploaded.map((u) => ({ timeframe: u.timeframe, imageUrl: u.url, imagePublicId: u.publicId })),
    status: 'pending',
  });

  try {
    // 3. Run AI analysis across all images
    const { analysis, meta } = await analyzeMultiTimeframe({
      images: uploaded.map((u) => ({ url: u.url, label: u.timeframe })),
      timeframes: uploaded.map((u) => u.timeframe),
    });

    // 4. Merge the model's per-timeframe reads back onto our uploaded images
    //    (keep our image URLs; take the analysis fields from the model).
    const byTf = new Map(analysis.timeframes.map((t) => [String(t.timeframe).toUpperCase(), t]));
    const mergedTimeframes = uploaded.map((u) => {
      const a = byTf.get(u.timeframe) || {};
      return {
        timeframe: u.timeframe,
        imageUrl: u.url,
        imagePublicId: u.publicId,
        trend: a.trend || 'ranging',
        marketStructure: a.marketStructure || '',
        keyLevels: a.keyLevels || [],
        bias: a.bias || 'NEUTRAL',
      };
    });

    Object.assign(record, {
      symbol: analysis.symbol,
      market: analysis.market,
      broker: analysis.broker,
      currentPrice: analysis.currentPrice,
      timeframes: mergedTimeframes,
      alignmentStatus: analysis.alignmentStatus,
      confluenceScore: analysis.confluenceScore,
      dominantBias: analysis.dominantBias,
      conflicts: analysis.conflicts,
      recommendation: analysis.recommendation,
      summary: analysis.summary,
      ...meta,
      status: 'completed',
    });
    await record.save();

    // 5. Consume a single credit (only on success)
    await user.useScan();

    await logScan('mtf_scan_completed', {
      message: `Multi-TF scan: ${analysis.symbol} ${analysis.alignmentStatus} (${analysis.confluenceScore}%)`,
      userId: user._id,
      metadata: { analysisId: record._id, provider: meta.aiProvider, timeframes: uploaded.map((u) => u.timeframe) },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Multi-timeframe analysis complete.',
      data: { analysis: record, scansRemaining: user.subscription.scansRemaining },
    });
  } catch (err) {
    record.status = 'failed';
    record.error = err.message;
    await record.save();

    await Promise.all(uploaded.map((u) => deleteImage(u.publicId)));

    logger.error(`Multi-TF scan failed for user ${user._id}: ${err.message}`);
    await logScan('mtf_scan_failed', {
      message: err.message,
      userId: user._id,
      metadata: { analysisId: record._id },
      level: 'error',
    });

    throw ApiError.internal('Multi-timeframe analysis failed. Please try again. You have not been charged a scan.');
  }
});

/**
 * GET /multi-timeframe-analyses
 * Paginated history of the current user's multi-timeframe analyses.
 */
export const listMultiTimeframe = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };
  if (req.query.symbol) filter.symbol = new RegExp(req.query.symbol, 'i');
  if (req.query.alignmentStatus) filter.alignmentStatus = req.query.alignmentStatus;

  const [items, total] = await Promise.all([
    MultiTimeframeAnalysis.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MultiTimeframeAnalysis.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { analyses: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /multi-timeframe-analyses/:id
 */
export const getMultiTimeframe = asyncHandler(async (req, res) => {
  const analysis = await MultiTimeframeAnalysis.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();
  if (!analysis) throw ApiError.notFound('Analysis not found.');
  return sendSuccess(res, { data: { analysis } });
});

/**
 * DELETE /multi-timeframe-analyses/:id
 */
export const deleteMultiTimeframe = asyncHandler(async (req, res) => {
  const analysis = await MultiTimeframeAnalysis.findOne({ _id: req.params.id, userId: req.user._id });
  if (!analysis) throw ApiError.notFound('Analysis not found.');

  await Promise.all((analysis.timeframes || []).map((t) => deleteImage(t.imagePublicId)));
  await analysis.deleteOne();

  return sendSuccess(res, { message: 'Analysis deleted.' });
});
