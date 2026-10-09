import { Router } from 'express';
import * as mtfController from '../controllers/multiTimeframeController.js';
import { protect, requireVerified } from '../middleware/auth.js';
import { handleMultiUpload } from '../middleware/upload.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Multi-timeframe scan (verified users, rate-limited, multi-image upload).
router.post(
  '/multi-timeframe-scan',
  protect,
  requireVerified,
  scanLimiter,
  handleMultiUpload,
  mtfController.scanMultiTimeframe
);

router.get('/multi-timeframe-analyses', protect, mtfController.listMultiTimeframe);
router.get('/multi-timeframe-analyses/:id', protect, mtfController.getMultiTimeframe);
router.delete('/multi-timeframe-analyses/:id', protect, mtfController.deleteMultiTimeframe);

export default router;
