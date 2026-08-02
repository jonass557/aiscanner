import { Router } from 'express';
import * as assistantController from '../controllers/assistantController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/conversations', assistantController.listConversations);
router.post('/conversations', assistantController.createConversation);
router.get('/conversations/:id', assistantController.getConversation);
router.post('/conversations/:id/message', assistantController.sendMessage);
router.delete('/conversations/:id', assistantController.deleteConversation);

export default router;
