import { Router } from 'express';
import * as marketController from '../controllers/marketController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Live snapshot (quote + candles) for the real-time chart on the scanner result.
router.get('/market/snapshot', protect, marketController.getSnapshot);

export default router;
