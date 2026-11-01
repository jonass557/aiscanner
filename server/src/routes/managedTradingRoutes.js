import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getConfig,
  updateConfig,
  activateAutomation,
  emergencyStop,
  resetEmergency,
  connectBrokerAccount,
  getBrokerAccounts,
  selectBrokerAccount,
  deleteBrokerAccount,
  executeManualOrder,
  getOrders,
  getPositions,
  closePosition,
} from '../controllers/managedTradingController.js';

const router = Router();

// All managed trading actions require authentication
router.use(protect);

// Configuration & Emergency Kill Switch
router.get('/config', getConfig);
router.put('/config', updateConfig);
router.post('/activate-automation', activateAutomation);
router.post('/emergency-stop', emergencyStop);
router.post('/emergency-stop/reset', resetEmergency);

// Broker Accounts
router.get('/broker-accounts', getBrokerAccounts);
router.post('/broker-accounts', connectBrokerAccount);
router.post('/broker-accounts/:id/select', selectBrokerAccount);
router.delete('/broker-accounts/:id', deleteBrokerAccount);

// Orders & Execution
router.post('/orders/execute-manual', executeManualOrder);
router.get('/orders', getOrders);
router.get('/positions', getPositions);
router.post('/positions/:id/close', closePosition);

export default router;
