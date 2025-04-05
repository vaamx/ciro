import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { OpenAIService } from '../services/ai/openai.service';
import { ServiceRegistry } from '../services/core/service-registry';
// import { produceMessage, TOPICS } from '../infrastructure/kafka';
import { db } from '../config/database';
// import { executeQuery } from '../infrastructure/connectors/factory';
import { ChatController } from '../controllers/chat.controller';
import { authenticate, AuthRequest } from '../middleware/auth';
import { BadRequestError } from '../utils/errors';

// Define request parameter types
interface ChatMessageBody {
  message: string;
  dataSource?: string;
}

const router = express.Router();
const chatController = new ChatController(db);

// Get OpenAIService from ServiceRegistry
const openAIService = ServiceRegistry.resolve(OpenAIService);

// Apply authentication middleware to all routes
router.use(authenticate as unknown as RequestHandler);

// Get all conversations for the authenticated user
const getConversations: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversations = await db('conversations')
      .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
      .where('conversation_participants.user_id', authReq.user.id)
      .select('conversations.*')
      .orderBy('conversations.updated_at', 'desc');

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

// Create a new conversation
const createConversation: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { title, participants } = authReq.body;

    if (!title || !participants || !Array.isArray(participants)) {
      throw new BadRequestError('Title and participants array are required');
    }

    // Start a transaction
    await db.transaction(async (trx) => {
      // Create conversation
      const [conversation] = await trx('conversations')
        .insert({
          title,
          created_by: authReq.user.id
        })
        .returning('*');

      // Add participants (including the creator)
      const participantRecords = [
        ...participants,
        authReq.user.id
      ].map(userId => ({
        conversation_id: conversation.id,
        user_id: userId
      }));

      await trx('conversation_participants')
        .insert(participantRecords);

      res.status(201).json(conversation);
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

// Get conversation by ID
const getConversationById: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const conversation = await db('conversations')
      .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
      .where({
        'conversations.id': req.params.id,
        'conversation_participants.user_id': authReq.user.id
      })
      .select('conversations.*')
      .first();

    if (!conversation) {
      throw new BadRequestError('Conversation not found or access denied');
    }

    res.json(conversation);
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(404).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

// Get messages for a conversation
const getMessages: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is participant
    const isParticipant = await db('conversation_participants')
      .where({
        conversation_id: req.params.id,
        user_id: authReq.user.id
      })
      .first();

    if (!isParticipant) {
      throw new BadRequestError('Access denied');
    }

    const messages = await db('messages')
      .where('conversation_id', req.params.id)
      .orderBy('created_at', 'asc');

    res.json(messages);
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(403).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

// Send a message
const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { content } = authReq.body;

    if (!content) {
      throw new BadRequestError('Message content is required');
    }

    // Check if user is participant
    const isParticipant = await db('conversation_participants')
      .where({
        conversation_id: req.params.id,
        user_id: authReq.user.id
      })
      .first();

    if (!isParticipant) {
      throw new BadRequestError('Access denied');
    }

    // Create message
    const [message] = await db('messages')
      .insert({
        conversation_id: req.params.id,
        user_id: authReq.user.id,
        content,
        role: 'user'
      })
      .returning('*');

    // Update conversation last activity
    await db('conversations')
      .where('id', req.params.id)
      .update({
        updated_at: db.fn.now()
      });

    res.status(201).json(message);
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
};

// Setup routes
router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversationById);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);

export default router; 