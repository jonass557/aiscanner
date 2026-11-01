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

// Read all available strategies (System + User's personal)
router.get('/', getStrategies);

// Admin-only global management view
router.get('/admin', requireAdmin, getAdminStrategies);

// Create, update, delete strategies (Admins for system strategies, users for their own)
router.post('/', createStrategy);
router.put('/:id', updateStrategy);
router.delete('/:id', deleteStrategy);

export default router;
