import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Analysis from '../models/Analysis.js';
import { uploadImage, deleteImage } from '../services/uploadService.js';
import { run as runPipeline } from '../services/analysis-engine/pipeline.js';
import { isVisionConfigured } from '../services/vision/index.js';
import { logScan } from '../services/logService.js';
import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * POST /scan
 * The core endpoint. Flow:
 *  1. Verify the user has scan credits (business rule enforced up-front).
 *  2. Upload the image to Cloudinary.
 *  3. Create a pending Analysis record.
 *  4. Run the Computer-Vision pipeline (perception → technical → decision →
 *     explanation + overlay), parse it, and update the record.
 *  5. Decrement the user's scan credit only on success.
 *
 * Credits are consumed only after a successful analysis, so a failed AI call
 * never costs the user a scan.
 */
export const scanChart = asyncHandler(async (req, res) => {
  const user = req.user;

  if (!user.canScan()) {
    throw ApiError.forbidden(
      'You have no scans remaining this month. Please upgrade your plan or wait for your monthly reset.'
    );
  }

  // Guard: never run a mock analysis in production. A fabricated result (the
  // mock always returns "EURUSD") for a real user's chart is worse than a
  // clear error. Checked before upload so we don't waste a Cloudinary call.
  if (config.isProduction && !isVisionConfigured()) {
    throw ApiError.serviceUnavailable(
      "L'analyse IA n'est pas configurée sur le serveur (aucune clé de vision valide). " +
      "Configurez une clé OpenAI, Claude ou Gemini avant de scanner."
    );
  }

  // 1. Upload image
  const { url, publicId } = await uploadImage(req.file.buffer, user._id.toString());

  // 2. Create pending record
  const analysis = await Analysis.create({
    userId: user._id,
    imageUrl: url,
    imagePublicId: publicId,
    status: 'pending',
  });

  try {
    // 3. Run the Computer-Vision pipeline (Engine 1→2→3→4 + overlay).
    const { analysis: result, meta } = await runPipeline({ imageUrl: url });

    // 4. Persist result
    Object.assign(analysis, result, meta, { status: 'completed' });
    await analysis.save();

    // 5. Consume a credit (only on success)
    await user.useScan();

    await logScan('scan_completed', {
      message: `Scan completed: ${result.symbol} ${result.decision}`,
      userId: user._id,
      metadata: { analysisId: analysis._id, provider: meta.aiProvider, decision: result.decision },
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Chart analyzed successfully.',
      data: { analysis, scansRemaining: user.subscription.scansRemaining },
    });
  } catch (err) {
    // Mark record failed; keep it for debugging/history but don't charge a credit.
    analysis.status = 'failed';
    analysis.error = err.message;
    await analysis.save();

    // Best-effort cleanup of the uploaded image on failure.
    await deleteImage(publicId);

    logger.error(`Scan failed for user ${user._id}: ${err.message}`);
    await logScan('scan_failed', {
      message: err.message,
      userId: user._id,
      metadata: { analysisId: analysis._id },
      level: 'error',
    });

    throw ApiError.internal('Chart analysis failed. Please try again. You have not been charged a scan.');
  }
});
