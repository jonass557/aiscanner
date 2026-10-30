import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Public: Webhooks (callbacks from iKeePay and SebPay)
router.post('/webhook/ikeepay', paymentController.ikeepayWebhook);
router.post('/webhook/sebpay', paymentController.webhook);

// Public or auth: payment configuration (active provider, public keys, options)
router.get('/config', paymentController.getPaymentConfig);

// Authenticated routes
router.use(protect);
router.post('/ikeepay/initiate', paymentController.initiateIkeepay);
router.post('/ikeepay/verify', paymentController.verifyIkeepay);
router.post('/checkout', paymentController.checkout);
router.get('/', paymentController.listMine);
router.get('/:id', paymentController.getMine);

export default router;
