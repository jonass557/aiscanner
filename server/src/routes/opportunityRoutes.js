import { Router } from 'express';
import * as opportunityController from '../controllers/opportunityController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', opportunityController.listOpportunities);
router.get('/meta', opportunityController.getMeta);
router.get('/:id', opportunityController.getOpportunity);

// Manual on-demand scan with personal strategy and live market data.
router.post('/scan', opportunityController.triggerScan);

export default router;
