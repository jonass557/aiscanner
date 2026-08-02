import { Router } from 'express';
import * as opportunityController from '../controllers/opportunityController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', opportunityController.listOpportunities);
router.get('/meta', opportunityController.getMeta);
router.get('/:id', opportunityController.getOpportunity);

// Manual on-demand scan is admin-only (guards against abuse / cost).
router.post('/scan', authorize('admin'), opportunityController.triggerScan);

export default router;
