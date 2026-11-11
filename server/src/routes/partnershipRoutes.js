import { Router } from 'express';
import * as partnershipController from '../controllers/partnershipController.js';
import { protect, optionalAuth, authorize } from '../middleware/auth.js';

const router = Router();

// Public & optional-auth endpoints (supports both visitors and already-logged-in users)
router.get('/config', partnershipController.getPublicPartnershipConfig);
router.post('/pay', optionalAuth, partnershipController.initiatePartnershipPayment);
router.post('/verify-payment', optionalAuth, partnershipController.verifyPartnershipPayment);
router.post('/complete-registration', optionalAuth, partnershipController.completePartnershipRegistration);

// Partner Dashboard endpoints (auth required)
router.get('/my-dashboard', protect, partnershipController.getMyPartnerDashboard);
router.post('/withdraw', protect, partnershipController.withdrawPartnerEarnings);
router.post('/payout/verify', protect, partnershipController.verifyPartnerPayout);

// Admin Partnership & Revenue Management endpoints
router.get('/admin/overview', protect, authorize('admin'), partnershipController.adminGetPartnershipOverview);
router.put('/admin/config', protect, authorize('admin'), partnershipController.adminUpdatePartnershipConfig);
router.delete('/admin/config', protect, authorize('admin'), partnershipController.adminDeletePartnershipProgram);
router.patch('/admin/partners/:userId/status', protect, authorize('admin'), partnershipController.adminUpdatePartnerStatus);
router.post('/admin/release-commissions', protect, authorize('admin'), partnershipController.adminReleaseDueCommissions);
router.post('/admin/withdraw', protect, authorize('admin'), partnershipController.adminWithdrawRevenuePool);
router.post('/admin/payout/verify', protect, authorize('admin'), partnershipController.adminVerifyPayout);

export default router;
