import { Router } from 'express';
import * as scanController from '../controllers/scanController.js';
import * as analysisController from '../controllers/analysisController.js';
import { protect, requireVerified } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All routes require authentication.
router.use(protect);

// Core scan endpoint (verified users only, rate-limited, image upload).
router.post('/scan', requireVerified, scanLimiter, handleUpload, scanController.scanChart);

// Stats + history + exports.
router.get('/analyses/stats', analysisController.getStats);
router.get('/analyses/export/csv', analysisController.exportCSV);
router.get('/analyses', analysisController.listAnalyses);
router.get('/analyses/:id', analysisController.getAnalysis);
router.get('/analyses/:id/export/pdf', analysisController.exportPDF);
router.post('/analyses/:id/feedback', analysisController.submitFeedback);
router.delete('/analyses/:id', analysisController.deleteAnalysis);

export default router;
