import { Router } from 'express';
import * as marketController from '../controllers/marketController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// All market-data routes require authentication.
router.use(protect);

// Live snapshot (quote + candles) for the real-time chart on the scanner result.
router.get('/market/snapshot', marketController.getSnapshot);

export default router;
