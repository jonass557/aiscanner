import { Router } from 'express';
import * as newsController from '../controllers/economicNewsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/economic-news', protect, newsController.listEvents);
router.get('/economic-news/upcoming', protect, newsController.upcomingHighImpact);
router.get('/economic-news/:id', protect, newsController.getEvent);
router.post('/economic-news/refresh', protect, authorize('admin'), newsController.refresh);

export default router;
