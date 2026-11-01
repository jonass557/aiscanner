import { Router } from 'express';
import {
  getPublicReviews,
  getAdminReviews,
  createReview,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// Public route for landing page
router.get('/', getPublicReviews);

// Admin routes
router.get('/admin', protect, authorize('admin'), getAdminReviews);
router.post('/', protect, authorize('admin'), createReview);
router.put('/:id', protect, authorize('admin'), updateReview);
router.delete('/:id', protect, authorize('admin'), deleteReview);

export default router;
