import { Router } from '../types/express-types';
import { ChatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';
import { openAIService } from '../services/openai.service';
import { db } from '../infrastructure/database';
import { RequestHandler } from '../types/express-types';
import { redirectRagQueries } from '../middleware/redirect-rag-queries';

const router = Router();
const chatController = new ChatController(openAIService, db);

// Chat routes
router.post('/completion', authenticate, chatController.generateCompletion.bind(chatController) as RequestHandler);
router.post('/regenerate', authenticate, chatController.regenerateMessage.bind(chatController) as RequestHandler);
router.get('/sessions', authenticate, chatController.getChatSessions.bind(chatController) as RequestHandler);
router.get('/sessions/:sessionId', authenticate, chatController.getChatMessages.bind(chatController) as RequestHandler);
router.get('/sessions/:sessionId/messages', authenticate, chatController.getChatMessages.bind(chatController) as RequestHandler);
router.post('/sessions', authenticate, chatController.createChatSession.bind(chatController) as RequestHandler);
router.put('/sessions/:sessionId', authenticate, chatController.updateChatSession.bind(chatController) as RequestHandler);
router.put('/sessions/:sessionId/history', authenticate, chatController.saveChatHistory.bind(chatController) as RequestHandler);
router.delete('/sessions/:sessionId', authenticate, chatController.deleteChatSession.bind(chatController) as RequestHandler);
router.post('/sessions/:sessionId/messages', authenticate, redirectRagQueries, chatController.sendChatMessage.bind(chatController) as RequestHandler);

export default router;