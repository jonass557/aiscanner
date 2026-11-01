import { Router } from 'express';
import { trackPageView, getAdminAnalytics } from '../controllers/analyticsController.js';
import { protect, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Track page view (public or authenticated)
router.post('/track', optionalAuth, trackPageView);

// Admin analytics dashboard
router.get('/admin', protect, requireAdmin, getAdminAnalytics);

export default router;
