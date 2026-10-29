import { Router } from 'express';
import { calculateSize, getSpecs } from '../controllers/calculatorController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Specs can be viewed publicly or authenticated
router.get('/specs', getSpecs);
router.get('/specs/:symbol', getSpecs);

// Position size calculation can be used with or without authentication
router.post('/position-size', optionalAuth, calculateSize);

export default router;
