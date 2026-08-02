import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Public: plan catalog for pricing page.
router.get('/plans', userController.getPlans);

// Authenticated user actions.
router.patch('/profile', protect, userController.updateProfile);
router.patch('/password', protect, userController.changePassword);
router.post('/subscription', protect, userController.changeSubscription);
router.get('/preferences', protect, userController.getPreferences);
router.patch('/preferences', protect, userController.updatePreferences);

export default router;
