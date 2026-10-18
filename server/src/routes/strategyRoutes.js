import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  getStrategies,
  getAdminStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
} from '../controllers/strategyController.js';

const router = Router();

// All strategy routes require authentication
router.use(protect);

// Publicly readable by all authenticated users (Chart Vision, Scanner, Replay)
router.get('/', getStrategies);

// Admin-only management routes
router.get('/admin', requireAdmin, getAdminStrategies);
router.post('/', requireAdmin, createStrategy);
router.put('/:id', requireAdmin, updateStrategy);
router.delete('/:id', requireAdmin, deleteStrategy);

export default router;
