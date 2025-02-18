import express, { Request, Response, RequestHandler } from 'express';
import { OpenAIService } from '../infrastructure/llm/openai';
import { produceMessage, TOPICS } from '../infrastructure/kafka';
import { pool } from '../infrastructure/database';
import { executeQuery } from '../infrastructure/connectors/factory';
import { ChatController } from '../controllers/chat.controller';
import { authenticate, AuthRequest } from '../middleware/auth';

// Define request parameter types
interface ChatSessionParams {
  sessionId?: string;
}

interface ChatSessionBody {
  title?: string;
}

interface ChatMessageBody {
  message: string;
  dataSource?: string;
}

// Custom RequestHandler type for authenticated routes
type AuthenticatedRequestHandler<P = ChatSessionParams, B = ChatSessionBody> = RequestHandler<
  P,
  any,
  B,
  any,
  { user: { id: number; email: string; role: string; } }
>;

// Custom RequestHandler type for chat messages
type ChatMessageHandler = RequestHandler<
  ChatSessionParams,
  any,
  ChatMessageBody,
  any,
  { user: { id: number; email: string; role: string; } }
>;

const router = express.Router();
const openai = new OpenAIService();
const chatController = new ChatController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all chat sessions for the current user
const getChatSessions = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        title,
        last_message as "lastMessage",
        message_count as "messageCount",
        EXTRACT(EPOCH FROM updated_at) * 1000 as timestamp,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM chat_sessions 
      WHERE user_id = $1 
      ORDER BY updated_at DESC`,
      [userId]
    );

    // Format the sessions for the UI
    const sessions = result.rows.map(session => ({
      id: session.id.toString(),
      title: session.title,
      lastMessage: session.lastMessage || '',
      timestamp: Math.floor(Number(session.timestamp)),
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
};

// Create a new chat session
const createChatSession = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.id;
  const { title = 'New Chat' } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
};

// Update a chat session
const updateChatSession = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.id;
  const { sessionId } = req.params;
  const { title } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [title, sessionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating chat session:', error);
    res.status(500).json({ error: 'Failed to update chat session' });
  }
};

// Delete a chat session
const deleteChatSession = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.id;
  const { sessionId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING *',
      [sessionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
};

// Get chat history
const getChatHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { sessionId } = req.params;
  const userId = req.user.id;
  
  try {
    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    const result = await pool.query(
      `SELECT 
        id::text,
        message_type as role,
        content,
        metadata,
        EXTRACT(EPOCH FROM timestamp) * 1000 as timestamp,
        'complete' as status
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
      [sessionId]
    );
    
    // Transform the messages to match the expected format
    const messages = result.rows.map(msg => {
      let parsedMetadata = null;
      if (msg.metadata) {
        try {
          // Handle case where metadata is already a JSON object
          parsedMetadata = typeof msg.metadata === 'string' 
            ? JSON.parse(msg.metadata)
            : msg.metadata;
        } catch (e) {
          console.error('Error parsing message metadata:', e);
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        status: msg.status,
        timestamp: Math.floor(Number(msg.timestamp)),
        metadata: parsedMetadata
      };
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch chat history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Send a message
const sendMessage = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const { message, dataSource } = req.body;
    const userId = req.user.id;

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    // 1. Save user message
    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // 2. Generate AI response
    const chatResponse = await openai.generateChatResponse(
      [{ role: 'user', content: message }]
    );

    // 3. Save AI response
    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content) VALUES ($1, $2, $3)',
      [sessionId, 'assistant', chatResponse]
    );

    // 4. Update session
    await pool.query(
      'UPDATE chat_sessions SET last_message = $1, message_count = message_count + 2, updated_at = NOW() WHERE id = $2',
      [chatResponse, sessionId]
    );

    res.json({
      content: chatResponse,
      metadata: {
        model: 'gpt-4-turbo-preview'
      }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// Update the route registrations to use our local handlers instead of the controller
router.get('/sessions', getChatSessions);
router.post('/sessions', createChatSession);
router.get('/sessions/:sessionId', getChatHistory);
router.put('/sessions/:sessionId', updateChatSession);
router.delete('/sessions/:sessionId', deleteChatSession);
router.post('/sessions/:sessionId/messages', sendMessage);
router.put('/sessions/:sessionId/history', async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { sessionId } = req.params;
    const { messages } = req.body;
    const userId = req.user.id;

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Session not found or unauthorized' });
    }

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing messages
      await client.query(
        'DELETE FROM chat_messages WHERE session_id = $1',
        [sessionId]
      );

      // Insert new messages
      for (const message of messages) {
        const messageType = message.role === 'assistant' ? 'assistant' : 
                          message.role === 'user' ? 'user' : 
                          message.role === 'error' ? 'error' : 'system';

        // Convert timestamp from milliseconds to PostgreSQL timestamp
        const timestamp = message.timestamp 
          ? new Date(message.timestamp).toISOString()
          : new Date().toISOString();

        await client.query(
          `INSERT INTO chat_messages (
            session_id, 
            message_type, 
            content, 
            metadata,
            timestamp
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            sessionId,
            messageType,
            message.content,
            message.metadata ? JSON.stringify(message.metadata) : null,
            timestamp
          ]
        );
      }

      // Update session with last message and count
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        await client.query(
          `UPDATE chat_sessions 
           SET last_message = $1, 
               message_count = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [lastMessage.content, messages.length, sessionId]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Chat history saved successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving chat history:', error);
    res.status(500).json({ 
      error: 'Failed to save chat history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export the router
export default router; 