import { Request, Response } from 'express';
import { Knex } from 'knex';
import { db } from '../infrastructure/database';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';

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
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ChatController {
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly db: Knex;

  constructor(dbInstance?: Knex) {
    this.db = dbInstance || db;
    this.apiKey = config.openai.apiKey ?? '';
    this.orgId = config.openai.orgId ?? '';

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async getConversations(req: AuthRequest, res: Response) {
    try {
      const conversations = await this.db('conversations')
        .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
        .where('conversation_participants.user_id', req.user.id)
        .select('conversations.*')
        .orderBy('conversations.updated_at', 'desc');

      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  async createConversation(req: AuthRequest, res: Response) {
    try {
      const { title, participants } = req.body;

      if (!title || !participants || !Array.isArray(participants)) {
        throw new BadRequestError('Title and participants array are required');
      }

      // Start a transaction
      await this.db.transaction(async (trx) => {
        // Create conversation
        const [conversation] = await trx('conversations')
          .insert({
            title,
            created_by: req.user.id
          })
          .returning('*');

        // Add participants (including the creator)
        const participantRecords = [
          ...participants,
          req.user.id
        ].map(userId => ({
          conversation_id: conversation.id,
          user_id: userId
        }));

        await trx('conversation_participants')
          .insert(participantRecords);

        res.status(201).json(conversation);
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create conversation' });
      }
    }
  }

  async getConversation(req: AuthRequest, res: Response) {
    try {
      const conversation = await this.db('conversations')
        .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
        .where({
          'conversations.id': req.params.id,
          'conversation_participants.user_id': req.user.id
        })
        .select('conversations.*')
        .first();

      if (!conversation) {
        throw new BadRequestError('Conversation not found or access denied');
      }

      res.json(conversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      if (error instanceof BadRequestError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch conversation' });
      }
    }
  }

  async getMessages(req: AuthRequest, res: Response) {
    try {
      // Check if user is participant
      const isParticipant = await this.db('conversation_participants')
        .where({
          conversation_id: req.params.id,
          user_id: req.user.id
        })
        .first();

      if (!isParticipant) {
        throw new BadRequestError('Access denied');
      }

      const messages = await this.db('messages')
        .where('conversation_id', req.params.id)
        .orderBy('created_at', 'asc');

      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (error instanceof BadRequestError) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch messages' });
      }
    }
  }

  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { content } = req.body;

      if (!content) {
        throw new BadRequestError('Message content is required');
      }

      // Check if user is participant
      const isParticipant = await this.db('conversation_participants')
        .where({
          conversation_id: req.params.id,
          user_id: req.user.id
        })
        .first();

      if (!isParticipant) {
        throw new BadRequestError('Access denied');
      }

      // Create message
      const [message] = await this.db('messages')
        .insert({
          conversation_id: req.params.id,
          user_id: req.user.id,
          content,
          role: 'user'
        })
        .returning('*');

      // Update conversation last activity
      await this.db('conversations')
        .where('id', req.params.id)
        .update({
          updated_at: this.db.fn.now()
        });

      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to send message' });
      }
    }
  }

  async getChatSessions(req: AuthRequest, res: Response) {
    try {
      const result = await this.db('chat_sessions')
        .where('user_id', req.user.id)
        .orderBy('updated_at', 'desc');

      return res.json(result);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  }

  async getChatMessages(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;

      // Verify session belongs to user
      const sessionCheck = await this.db('chat_sessions')
        .where('id', sessionId)
        .andWhere('user_id', req.user.id)
        .first();

      if (!sessionCheck) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      const result = await this.db('chat_messages')
        .where('session_id', sessionId)
        .orderBy('timestamp', 'asc');

      return res.json(result);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  }

  async createChatSession(req: AuthRequest, res: Response) {
    try {
      const { title = 'New Chat' } = req.body;

      const result = await this.db('chat_sessions')
        .insert({
          user_id: req.user.id,
          title
        })
        .returning('*');

      return res.status(201).json(result[0]);
    } catch (error) {
      console.error('Error creating chat session:', error);
      return res.status(500).json({ error: 'Failed to create chat session' });
    }
  }

  async updateChatSession(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const result = await this.db('chat_sessions')
        .where('id', sessionId)
        .andWhere('user_id', req.user.id)
        .update({
          title,
          updated_at: this.db.fn.now()
        })
        .returning('*');

      if (result.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      return res.json(result[0]);
    } catch (error) {
      console.error('Error updating chat session:', error);
      return res.status(500).json({ error: 'Failed to update chat session' });
    }
  }

  async deleteChatSession(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;

      const result = await this.db('chat_sessions')
        .where('id', sessionId)
        .andWhere('user_id', req.user.id)
        .delete()
        .returning('id');

      if (result.length === 0) {
        return res.status(404).json({ error: 'Session not found or unauthorized' });
      }

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting chat session:', error);
      return res.status(500).json({ error: 'Failed to delete chat session' });
    }
  }

  async sendChatMessage(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Verify session belongs to user
      const sessionCheck = await this.db('chat_sessions')
        .where('id', sessionId)
        .andWhere('user_id', req.user.id)
        .first();

      if (!sessionCheck) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      // Begin transaction
      const client = await this.db.transaction();
      try {
        await client('chat_messages')
          .insert({
            session_id: sessionId,
            message_type: 'user',
            content: message
          })
          .returning('*');

        // Generate AI response
        const completion = await this.generateAIResponse(message);
        const aiResponse = completion.choices[0].message.content;

        await client('chat_messages')
          .insert({
            session_id: sessionId,
            message_type: 'assistant',
            content: aiResponse,
            metadata: JSON.stringify({ 
              model: completion.model,
              usage: completion.usage
            })
          })
          .returning('*');

        // Update session
        await client('chat_sessions')
          .where('id', sessionId)
          .update({
            last_message: aiResponse,
            message_count: this.db.raw('message_count + 2'),
            updated_at: this.db.fn.now()
          })
          .returning('*');

        await client.commit();

        return res.json({
          message: aiResponse,
          usage: completion.usage
        });
      } catch (error) {
        await client.rollback();
        throw error;
      }
    } catch (error: unknown) {
      console.error('Error sending chat message:', error);
      if (error instanceof Error && 'response' in error && (error as any).response?.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }
      return res.status(500).json({ error: 'Failed to send chat message' });
    }
  }

  private async generateAIResponse(message: string): Promise<OpenAICompletion> {
    return this.makeOpenAIRequest('/chat/completions', {
      messages: [{ role: 'user', content: message }],
      model: 'gpt-4',
      temperature: 0.7,
      stream: false
    });
  }

  private async makeOpenAIRequest(endpoint: string, body: any): Promise<OpenAICompletion> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(this.orgId && { 'OpenAI-Organization': this.orgId })
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