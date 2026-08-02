import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Public: SebPay webhook (signature-verified inside the controller).
router.post('/webhook/sebpay', paymentController.webhook);

// Authenticated: initiate a checkout + view my payments.
router.use(protect);
router.post('/checkout', paymentController.checkout);
router.get('/', paymentController.listMine);
router.get('/:id', paymentController.getMine);

export default router;
