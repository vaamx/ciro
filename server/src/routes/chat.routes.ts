import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const chatController = new ChatController();

// Chat routes
router.post('/completion', authenticate, chatController.generateCompletion);
router.post('/regenerate', authenticate, chatController.regenerateMessage);

export default router; 