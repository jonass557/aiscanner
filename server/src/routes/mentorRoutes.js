import { Router } from 'express';
import * as mentorController from '../controllers/mentorController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/conversations', mentorController.listConversations);
router.post('/conversations', mentorController.createConversation);
router.get('/conversations/:id', mentorController.getConversation);
router.post('/conversations/:id/message', mentorController.sendMessage);
router.post('/conversations/:id/exercise/submit', mentorController.submitExercise);
router.post('/conversations/:id/lesson/select', mentorController.selectLesson);
router.delete('/conversations/:id', mentorController.deleteConversation);

export default router;
