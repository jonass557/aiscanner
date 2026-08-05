import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import * as adminPlanController from '../controllers/adminPlanController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Every admin route requires an authenticated admin.
router.use(protect, authorize('admin'));

router.get('/stats', adminController.getAdminStats);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/logs', adminController.listLogs);
router.get('/ai-config', adminController.getAIConfig);

// Runtime settings (API keys, active providers) — editable from the dashboard.
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.post('/settings/test-provider', adminController.testProvider);

// Plan management (CRUD + enable/disable + free trial).
router.get('/plans', adminPlanController.listPlans);
router.post('/plans', adminPlanController.createPlan);
router.patch('/plans/:id', adminPlanController.updatePlan);
router.post('/plans/:id/toggle', adminPlanController.togglePlan);
router.delete('/plans/:id', adminPlanController.deletePlan);

export default router;
