import { Router } from 'express';
import * as voiceController from '../controllers/voiceController.js';
import { protect } from '../middleware/auth.js';
import { handleAudioUpload } from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.post('/command', voiceController.handleVoiceCommand);
router.post('/transcribe', handleAudioUpload, voiceController.transcribe);
router.get('/conversations', voiceController.listConversations);
router.get('/conversations/:id', voiceController.getConversation);
router.delete('/conversations/:id', voiceController.deleteConversation);

export default router;
