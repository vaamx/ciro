import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { OpenAIService } from '../services/openai.service';
import { db } from '../infrastructure/database';
import { ChatController } from '../controllers/chat.controller';
import { authenticate, AuthRequest } from '../middleware/auth';
import { BadRequestError } from '../utils/errors';

const router = express.Router();
const openai = OpenAIService.getInstance();
const chatController = new ChatController(openai, db);

// Apply authentication middleware to all routes
router.use(authenticate);

// Get chat sessions for the authenticated user
router.get('/sessions', chatController.getChatSessions.bind(chatController) as RequestHandler);

// Get chat messages for a session
router.get('/sessions/:sessionId/messages', chatController.getChatMessages.bind(chatController) as RequestHandler);

// Create a new chat session
router.post('/sessions', chatController.createChatSession.bind(chatController) as RequestHandler);

// Update a chat session
router.put('/sessions/:sessionId', chatController.updateChatSession.bind(chatController) as RequestHandler);

// Save chat history
router.put('/sessions/:sessionId/history', chatController.saveChatHistory.bind(chatController) as RequestHandler);

// Delete a chat session
router.delete('/sessions/:sessionId', chatController.deleteChatSession.bind(chatController) as RequestHandler);

// Send a message to a chat session
router.post('/sessions/:sessionId/messages', chatController.sendChatMessage.bind(chatController) as RequestHandler);

// Generate chat completion
router.post('/completion', chatController.generateCompletion.bind(chatController) as RequestHandler);

// Regenerate message
router.post('/regenerate', chatController.regenerateMessage.bind(chatController) as RequestHandler);

export default router; 