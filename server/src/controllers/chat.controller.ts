import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { pool } from '../infrastructure/database';

interface OpenAIError {
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface OpenAICompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      refusal: null | string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ChatController {
  private apiKey: string;
  private orgId: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = config.openai.apiKey || '';
    this.orgId = config.openai.orgId || '';

    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    console.log('OpenAI Configuration:', {
      apiKeyPresent: !!this.apiKey,
      organizationPresent: !!this.orgId
    });
  }

  // Get user's chat sessions
  public getChatSessions = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `SELECT * FROM chat_sessions 
         WHERE user_id = $1 
         ORDER BY updated_at DESC`,
        [req.user.id]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      return res.status(500).json({
        error: 'Failed to fetch chat sessions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Get messages for a specific chat session
  public getChatMessages = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Verify session belongs to user
      const sessionCheck = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );

      if (sessionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      const result = await pool.query(
        `SELECT * FROM chat_messages 
         WHERE session_id = $1 
         ORDER BY timestamp ASC`,
        [sessionId]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({
        error: 'Failed to fetch chat messages',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Create a new chat session
  public createChatSession = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title = 'New Chat' } = req.body;

      const result = await pool.query(
        `INSERT INTO chat_sessions (user_id, title) 
         VALUES ($1, $2) 
         RETURNING *`,
        [req.user.id, title]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating chat session:', error);
      return res.status(500).json({
        error: 'Failed to create chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Update chat session
  public updateChatSession = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `UPDATE chat_sessions 
         SET title = $1, updated_at = NOW() 
         WHERE id = $2 AND user_id = $3 
         RETURNING *`,
        [title, sessionId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating chat session:', error);
      return res.status(500).json({
        error: 'Failed to update chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Delete chat session
  public deleteChatSession = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        `DELETE FROM chat_sessions 
         WHERE id = $1 AND user_id = $2 
         RETURNING id`,
        [sessionId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      return res.json({ message: 'Chat session deleted successfully' });
    } catch (error) {
      console.error('Error deleting chat session:', error);
      return res.status(500).json({
        error: 'Failed to delete chat session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Send a message in a chat session
  public sendMessage = async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Verify session belongs to user
      const sessionCheck = await pool.query(
        'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.id]
      );

      if (sessionCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Save user message
        await client.query(
          `INSERT INTO chat_messages (session_id, message_type, content)
           VALUES ($1, $2, $3)`,
          [sessionId, 'user', message]
        );

        // Generate AI response
        const completion = await this.makeOpenAIRequest('/chat/completions', {
          messages: [{ role: 'user', content: message }],
          model: 'gpt-4o',
          temperature: 0.7,
          stream: false
        });

        const aiResponse = completion.choices[0].message.content;

        // Save AI response
        await client.query(
          `INSERT INTO chat_messages (session_id, message_type, content, metadata)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, 'assistant', aiResponse, JSON.stringify({ 
            model: completion.model,
            usage: completion.usage
          })]
        );

        // Update session
        await client.query(
          `UPDATE chat_sessions 
           SET last_message = $1, 
               message_count = message_count + 2,
               updated_at = NOW()
           WHERE id = $2`,
          [aiResponse, sessionId]
        );

        await client.query('COMMIT');

        return res.json({
          message: {
            content: aiResponse,
            metadata: {
              model: completion.model,
              usage: completion.usage
            }
          }
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  private async makeOpenAIRequest(endpoint: string, body: any): Promise<OpenAICompletion> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'OpenAI-Organization': this.orgId
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json() as OpenAIError;
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data as OpenAICompletion;
  }

  // Generate chat completion
  public generateCompletion = async (req: AuthRequest, res: Response) => {
    try {
      const { messages, model = 'gpt-4o', temperature = 0.7, systemPrompt } = req.body;

      // Add system message if provided
      if (systemPrompt) {
        messages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const completion = await this.makeOpenAIRequest('/v1/chat/completions', {
        model,
        messages,
        temperature,
        max_tokens: 500,
        store: true
      });

      res.json({
        message: completion.choices[0].message,
        usage: completion.usage
      });
    } catch (error) {
      console.error('Error generating completion:', error);
      res.status(500).json({ error: 'Failed to generate completion' });
    }
  };

  public regenerateMessage = async (req: AuthRequest, res: Response) => {
    try {
      const { messages, model = 'gpt-4o', temperature = 0.7 } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
      }

      // Remove the last assistant message if it exists
      const lastMessage = messages[messages.length - 1];
      const conversationMessages = lastMessage.role === 'assistant' 
        ? messages.slice(0, -1)
        : messages;

      const completion = await this.makeOpenAIRequest('/chat/completions', {
        messages: conversationMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model,
        temperature,
        stream: false
      });

      return res.json({
        message: completion.choices[0].message,
        usage: completion.usage
      });
    } catch (error) {
      console.error('Message regeneration error:', error);
      return res.status(500).json({
        error: 'Failed to regenerate message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
} 