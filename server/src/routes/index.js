import { Router } from 'express';
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

/**
 * Root API router. Mounts each domain's routes under /api/v1.
 */
const router = Router();

router.get('/', (req, res) => {
  res.json({ success: true, message: 'AI Chart Scanner API v1', docs: '/api/v1/docs' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/mentor', mentorRoutes);
router.use('/opportunities', opportunityRoutes);
router.use('/voice', voiceRoutes);
router.use('/assistant', assistantRoutes);
router.use('/payments', paymentRoutes);
router.use('/', multiTimeframeRoutes); // /multi-timeframe-scan + /multi-timeframe-analyses
router.use('/', tradeValidatorRoutes); // /trade-validator + /trade-validations
router.use('/', economicNewsRoutes); // /economic-news
router.use('/', scanRoutes); // /scan and /analyses live at the root of v1

export default router;
