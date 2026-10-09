import { Router } from 'express';
import * as scanController from '../controllers/scanController.js';
import * as analysisController from '../controllers/analysisController.js';
import { protect, requireVerified } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Core scan endpoint (verified users only, rate-limited, image upload).
router.post('/scan', protect, requireVerified, scanLimiter, handleUpload, scanController.scanChart);

// Stats + history + exports.
router.get('/analyses/stats', protect, analysisController.getStats);
router.get('/analyses/export/csv', protect, analysisController.exportCSV);
router.get('/analyses', protect, analysisController.listAnalyses);
router.get('/analyses/:id', protect, analysisController.getAnalysis);
router.get('/analyses/:id/export/pdf', protect, analysisController.exportPDF);
router.post('/analyses/:id/feedback', protect, analysisController.submitFeedback);
router.delete('/analyses/:id', protect, analysisController.deleteAnalysis);

export default router;
