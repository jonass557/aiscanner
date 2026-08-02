import { Router } from 'express';
import * as tvController from '../controllers/tradeValidatorController.js';
import { protect, requireVerified } from '../middleware/auth.js';
import { handleUpload } from '../middleware/upload.js';
import { scanLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(protect);

router.post(
  '/trade-validator',
  requireVerified,
  scanLimiter,
  // handleUpload is conditional: if a file is present it processes it,
  // otherwise it passes through. We wrap to not error on missing file.
  (req, res, next) => {
    if (req.is('multipart/form-data')) {
      handleUpload(req, res, next);
    } else {
      next();
    }
  },
  tvController.validateTrade
);

router.get('/trade-validations', tvController.listValidations);
router.get('/trade-validations/:id', tvController.getValidation);
router.delete('/trade-validations/:id', tvController.deleteValidation);

export default router;
