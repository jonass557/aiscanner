import { Router } from 'express';
import * as newsController from '../controllers/economicNewsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/economic-news', newsController.listEvents);
router.get('/economic-news/upcoming', newsController.upcomingHighImpact);
router.get('/economic-news/:id', newsController.getEvent);
router.post('/economic-news/refresh', authorize('admin'), newsController.refresh);

export default router;
