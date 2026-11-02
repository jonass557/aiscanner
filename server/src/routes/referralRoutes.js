import express from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  getMyReferral,
  requestWithdrawal,
  adminGetWithdrawals,
  adminProcessWithdrawal,
  adminUpdateUserReferral,
} from '../controllers/referralController.js';

const router = express.Router();

// User endpoints
router.get('/my', protect, getMyReferral);
router.post('/withdraw', protect, requestWithdrawal);

// Admin endpoints
router.get('/admin/withdrawals', protect, requireAdmin, adminGetWithdrawals);
router.post('/admin/withdrawals/:id/process', protect, requireAdmin, adminProcessWithdrawal);
router.put('/admin/users/:userId', protect, requireAdmin, adminUpdateUserReferral);

export default router;
