import { Router } from 'express';
import * as marketController from '../controllers/marketController.js';

const router = Router();

// Live snapshot (quote + candles) for real-time charts across Backtesting, Chart Vision, and Scanner.
// Publicly accessible without requiring auth tokens so chart data never fails on session refresh.
router.get('/market/snapshot', marketController.getSnapshot);

export default router;
