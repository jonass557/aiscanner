import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getConfig,
  updateConfig,
  toggleDelegate,
  togglePassiveMode,
  getOpportunities,
  getOpportunityDetail,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerSweep,
} from '../controllers/tradingDelegateController.js';

const router = Router();

// All delegate routes require user authentication
router.use(protect);

router.get('/config', getConfig);
router.put('/config', updateConfig);
router.post('/toggle', toggleDelegate);
router.post('/passive-mode', togglePassiveMode);

router.get('/opportunities', getOpportunities);
router.get('/opportunities/:id', getOpportunityDetail);

router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.post('/notifications/read-all', markAllNotificationsRead);

router.post('/sweep', triggerSweep);

export default router;
