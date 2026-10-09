import { Router } from 'express';
import { requireDbConnection } from '../middleware/dbCheck.js';
import authRoutes from './authRoutes.js';
import scanRoutes from './scanRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import multiTimeframeRoutes from './multiTimeframeRoutes.js';
import mentorRoutes from './mentorRoutes.js';
import opportunityRoutes from './opportunityRoutes.js';
import tradeValidatorRoutes from './tradeValidatorRoutes.js';
import economicNewsRoutes from './economicNewsRoutes.js';
import voiceRoutes from './voiceRoutes.js';
import assistantRoutes from './assistantRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import marketRoutes from './marketRoutes.js';

/**
 * Root API router. Mounts each domain's routes under /api/v1.
 */
const router = Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'AI Chart Scanner API v1', docs: '/api/v1/docs' });
});

// Market snapshot does not require the DB (connects directly to Binance/TwelveData)
router.use('/', marketRoutes); // /market/snapshot

// All routes below require an active MongoDB connection
router.use('/auth', requireDbConnection, authRoutes);
router.use('/users', requireDbConnection, userRoutes);
router.use('/admin', requireDbConnection, adminRoutes);
router.use('/mentor', requireDbConnection, mentorRoutes);
router.use('/opportunities', requireDbConnection, opportunityRoutes);
router.use('/voice', requireDbConnection, voiceRoutes);
router.use('/assistant', requireDbConnection, assistantRoutes);
router.use('/payments', requireDbConnection, paymentRoutes);
router.use('/', requireDbConnection, multiTimeframeRoutes); // /multi-timeframe-scan + /multi-timeframe-analyses
router.use('/', requireDbConnection, tradeValidatorRoutes); // /trade-validator + /trade-validations
router.use('/', requireDbConnection, economicNewsRoutes); // /economic-news
router.use('/', requireDbConnection, scanRoutes); // /scan and /analyses live at the root of v1

export default router;

