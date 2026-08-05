import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import TradeValidation from '../models/TradeValidation.js';
import { uploadImage, deleteImage } from '../services/uploadService.js';
import { getProvider, assertVisionReady } from '../services/ai/index.js';
import { TV_SYSTEM_PROMPT, buildTradeValidatorPrompt, TV_OUTPUT_SCHEMA } from '../services/ai/tradeValidatorPrompt.js';
import { parseTradeValidationResponse } from '../services/ai/tradeValidatorParser.js';
import { logScan } from '../services/logService.js';
import logger from '../config/logger.js';

/**
 * POST /trade-validator
 * Two modes:
 *  - screenshot: image upload, AI reads the plan from the chart.
 *  - parameters: explicit entry/SL/TP values sent in JSON body.
 * Consumes 1 scan credit.
 */
export const validateTrade = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user.canScan()) {
    throw ApiError.forbidden('No scans remaining. Please upgrade your plan.');
  }

  // Guard: never run a mock analysis in production (fabricated results).
  try {
    assertVisionReady();
  } catch (err) {
    throw ApiError.serviceUnavailable(err.message);
  }

  let inputMode = 'screenshot';
  let imageUrl = null;
  let imagePublicId = null;
  let tradeParams = null;
  let providerImageUrl = null;

  if (req.file) {
    // Screenshot mode
    const uploaded = await uploadImage(req.file.buffer, user._id.toString());
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
    providerImageUrl = uploaded.url;
  } else if (req.body && req.body.entry != null) {
    // Parameters mode
    inputMode = 'parameters';
    tradeParams = {
      entry: Number(req.body.entry) || null,
      stopLoss: Number(req.body.stopLoss) || null,
      takeProfit1: Number(req.body.takeProfit1) || null,
      takeProfit2: req.body.takeProfit2 ? Number(req.body.takeProfit2) : null,
      strategy: String(req.body.strategy || ''),
      riskPercent: req.body.riskPercent ? Number(req.body.riskPercent) : null,
      accountBalance: req.body.accountBalance ? Number(req.body.accountBalance) : null,
    };
  } else {
    throw ApiError.badRequest('Provide either a chart screenshot or trade parameters (entry, stopLoss, etc.).');
  }

  const symbol = req.body.symbol || 'Unknown';
  const timeframe = req.body.timeframe || 'Unknown';

  const record = await TradeValidation.create({
    userId: user._id,
    symbol,
    timeframe,
    inputMode,
    imageUrl,
    imagePublicId,
    tradeParams,
    status: 'pending',
  });

  try {
    const provider = getProvider();
    const startedAt = Date.now();

    const userPrompt =
      buildTradeValidatorPrompt({
        symbol,
        timeframe,
        entry: tradeParams?.entry,
        stopLoss: tradeParams?.stopLoss,
        takeProfit1: tradeParams?.takeProfit1,
        takeProfit2: tradeParams?.takeProfit2,
        strategy: tradeParams?.strategy,
        riskPercent: tradeParams?.riskPercent,
        accountBalance: tradeParams?.accountBalance,
      }) + `\n\nReturn ONLY a JSON object with this exact shape:\n${TV_OUTPUT_SCHEMA}`;

    // validateTrade() runs vision analysis when an image is present, else a
    // text-only chat. The mock provider returns a schema-valid sample.
    const raw = await provider.validateTrade({
      imageUrl: providerImageUrl,
      systemPrompt: TV_SYSTEM_PROMPT,
      userPrompt,
    });

    const validation = parseTradeValidationResponse(raw);
    const processingTime = Date.now() - startedAt;

    Object.assign(record, validation, {
      processingTime,
      aiProvider: provider.name,
      aiModel: provider.model,
      status: 'completed',
    });
    await record.save();

    await user.useScan();

    await logScan('trade_validated', {
      message: `Trade validated: ${validation.decision} (${validation.confidenceScore}%)`,
      userId: user._id,
      metadata: { validationId: record._id, symbol, decision: validation.decision },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Trade validated.',
      data: { validation: record, scansRemaining: user.subscription.scansRemaining },
    });
  } catch (err) {
    record.status = 'failed';
    record.error = err.message;
    await record.save();
    if (imagePublicId) await deleteImage(imagePublicId);
    logger.error(`Trade validation failed for user ${user._id}: ${err.message}`);
    throw ApiError.internal('Trade validation failed. Please try again. You have not been charged a scan.');
  }
});

/** GET /trade-validations */
export const listValidations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { userId: req.user._id };
  if (req.query.decision) filter.decision = req.query.decision;
  if (req.query.symbol) filter.symbol = new RegExp(req.query.symbol, 'i');

  const [items, total] = await Promise.all([
    TradeValidation.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TradeValidation.countDocuments(filter),
  ]);

  return sendSuccess(res, { data: { validations: items }, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

/** GET /trade-validations/:id */
export const getValidation = asyncHandler(async (req, res) => {
  const v = await TradeValidation.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!v) throw ApiError.notFound('Validation not found.');
  return sendSuccess(res, { data: { validation: v } });
});

/** DELETE /trade-validations/:id */
export const deleteValidation = asyncHandler(async (req, res) => {
  const v = await TradeValidation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!v) throw ApiError.notFound('Validation not found.');
  if (v.imagePublicId) await deleteImage(v.imagePublicId);
  await v.deleteOne();
  return sendSuccess(res, { message: 'Validation deleted.' });
});
