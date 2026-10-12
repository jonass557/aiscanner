import { Router } from 'express';
import * as journalController from '../controllers/journalController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', journalController.listJournalEntries);
router.post('/', journalController.createJournalEntry);
router.patch('/:id', journalController.updateJournalEntry);
router.delete('/:id', journalController.deleteJournalEntry);

export default router;
