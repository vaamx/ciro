import { Request, Response } from 'express';
import { Knex } from 'knex';
import { db } from '../infrastructure/database/knex';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { OpenAIService } from '../services/openai.service';

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

interface OpenAIResponse {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: number;
  status: 'complete';
  metadata?: {
    model: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    }
  }
}

export class ChatController {
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly db: Knex;
  private readonly openai: OpenAIService;

  constructor(openai: OpenAIService, dbInstance?: Knex) {
    this.openai = openai;
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
      const { organization_id, dashboard_id } = req.query;

      console.log('Fetching chat sessions:', {
        organization_id,
        dashboard_id,
        user_id: req.user.id
      });

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }

      try {
        const query = this.db('chat_sessions')
          .where({
            'user_id': req.user.id,
            'organization_id': orgId,
            'dashboard_id': dashboard_id
          })
          .orderBy('updated_at', 'desc');

        const result = await query;
        console.log('Found chat sessions:', result);
        return res.json(result);
      } catch (dbError) {
        console.error('Database error fetching chat sessions:', dbError);
        return res.status(500).json({ error: 'Database error while fetching chat sessions' });
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  }

  async getChatMessages(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const { organization_id, dashboard_id } = req.query;

      console.log('Fetching messages for session:', {
        sessionId,
        organization_id,
        dashboard_id,
        user_id: req.user.id
      });

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id and sessionId are valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }
      if (!uuidRegex.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid Session ID format' });
      }

      try {
        // Verify session belongs to user and matches organization/dashboard scope
        const sessionCheck = await this.db('chat_sessions')
          .where({
            'id': sessionId,
            'user_id': req.user.id,
            'organization_id': orgId,
            'dashboard_id': dashboard_id
          })
          .first();

        console.log('Session check result:', sessionCheck);

        if (!sessionCheck) {
          return res.status(404).json({ error: 'Session not found or unauthorized' });
        }

        const result = await this.db('chat_messages')
          .where('session_id', sessionId)
          .orderBy('created_at', 'asc');

        console.log('Found messages:', result.length);

        // Transform the messages to include proper timestamp and required fields
        const transformedMessages = result.map(message => ({
          id: message.id,
          role: message.message_type,
          content: message.content,
          status: 'complete',
          timestamp: new Date(message.created_at).getTime(),
          metadata: message.metadata ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata) : undefined
        }));

        return res.json(transformedMessages);
      } catch (dbError) {
        console.error('Database error fetching chat messages:', dbError);
        return res.status(500).json({ error: 'Database error while fetching chat messages' });
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  }

  async createChatSession(req: AuthRequest, res: Response) {
    try {
      const { title = 'New Chat', organization_id, dashboard_id } = req.body;

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }

      try {
        const result = await this.db('chat_sessions')
          .insert({
            user_id: req.user.id,
            organization_id: orgId,
            dashboard_id,
            title,
            message_count: 0,
            created_at: this.db.fn.now(),
            updated_at: this.db.fn.now()
          })
          .returning('*');

        return res.status(201).json(result[0]);
      } catch (dbError) {
        console.error('Database error creating chat session:', dbError);
        return res.status(500).json({ error: 'Database error while creating chat session' });
      }
    } catch (error) {
      console.error('Error creating chat session:', error);
      return res.status(500).json({ error: 'Failed to create chat session' });
    }
  }

  async updateChatSession(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const { title } = req.body;
      const { organization_id, dashboard_id } = req.query;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }

      const result = await this.db('chat_sessions')
        .where({
          'id': sessionId,
          'user_id': req.user.id,
          'organization_id': orgId,
          'dashboard_id': dashboard_id
        })
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
      const { organization_id, dashboard_id } = req.query;

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }

      const result = await this.db('chat_sessions')
        .where({
          'id': sessionId,
          'user_id': req.user.id,
          'organization_id': orgId,
          'dashboard_id': dashboard_id
        })
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
      const { organization_id, dashboard_id } = req.query;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id and sessionId are valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }
      if (!uuidRegex.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid Session ID format' });
      }

      try {
        // Verify session belongs to user and matches organization/dashboard scope
        const sessionCheck = await this.db('chat_sessions')
          .where({
            'id': sessionId,
            'user_id': req.user.id,
            'organization_id': orgId,
            'dashboard_id': dashboard_id
          })
          .first();

        if (!sessionCheck) {
          return res.status(403).json({ error: 'Session not found or unauthorized' });
        }

        // Begin transaction
        const client = await this.db.transaction();
        try {
          const userMessage = await client('chat_messages')
            .insert({
              session_id: sessionId,
              message_type: 'user',
              content: message,
              created_at: this.db.fn.now(),
              updated_at: this.db.fn.now()
            })
            .returning('*');

          // Generate AI response
          const completion = await this.generateAIResponse(message);
          const aiResponse = completion.content;

          const aiMessage = await client('chat_messages')
            .insert({
              session_id: sessionId,
              message_type: 'assistant',
              content: aiResponse,
              metadata: JSON.stringify({ 
                model: completion.metadata?.model,
                usage: completion.metadata?.tokens
              }),
              created_at: this.db.fn.now(),
              updated_at: this.db.fn.now()
            })
            .returning('*');

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
            userMessage: userMessage[0],
            aiMessage: aiMessage[0],
            usage: completion.metadata?.tokens
          });
        } catch (error) {
          await client.rollback();
          throw error;
        }
      } catch (dbError) {
        console.error('Database error sending chat message:', dbError);
        return res.status(500).json({ error: 'Database error while sending chat message' });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  private async generateAIResponse(message: string): Promise<OpenAIResponse> {
    try {
      const response = await this.openai.generateChatCompletion([
        {
          id: Date.now().toString(),
          role: 'user',
          content: message,
          timestamp: Date.now(),
          status: 'complete'
        }
      ], {
        model: 'gpt-4',
        temperature: 0.7,
        stream: false
      });

      const responseData = await response.json() as OpenAIResponse;
      
      if (!response.ok) {
        const errorData = responseData as OpenAIError;
        throw new Error(errorData.error?.message || 'OpenAI API error');
      }

      return responseData;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  // Generate chat completion
  public generateCompletion = async (req: AuthRequest, res: Response) => {
    try {
      const { messages, model = 'gpt-4', temperature = 0.7, systemPrompt } = req.body;

      // Add system message if provided
      if (systemPrompt) {
        messages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const completion = await this.generateAIResponse(messages[messages.length - 1].content);

      res.json({
        message: {
          role: completion.role,
          content: completion.content
        },
        usage: completion.metadata?.tokens
      });
    } catch (error) {
      console.error('Error generating completion:', error);
      res.status(500).json({ error: 'Failed to generate completion' });
    }
  };

  public regenerateMessage = async (req: AuthRequest, res: Response) => {
    try {
      const { messages, model = 'gpt-4', temperature = 0.7 } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
      }

      // Remove the last assistant message if it exists
      const lastMessage = messages[messages.length - 1];
      const conversationMessages = lastMessage.role === 'assistant' 
        ? messages.slice(0, -1)
        : messages;

      const completion = await this.generateAIResponse(conversationMessages[conversationMessages.length - 1].content);

      return res.json({
        message: {
          role: completion.role,
          content: completion.content
        },
        usage: completion.metadata?.tokens
      });
    } catch (error) {
      console.error('Message regeneration error:', error);
      return res.status(500).json({
        error: 'Failed to regenerate message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  async saveChatHistory(req: AuthRequest, res: Response) {
    try {
      const sessionId = req.params.sessionId;
      const { messages } = req.body;
      const { organization_id, dashboard_id } = req.query;

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Cast organization_id to number and validate dashboard_id is a valid UUID
      const orgId = Number(organization_id);
      if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id and sessionId are valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }
      if (!uuidRegex.test(sessionId)) {
        return res.status(400).json({ error: 'Invalid Session ID format' });
      }

      // Verify session belongs to user and matches organization/dashboard scope
      const sessionCheck = await this.db('chat_sessions')
        .where({
          'id': sessionId,
          'user_id': req.user.id,
          'organization_id': orgId,
          'dashboard_id': dashboard_id
        })
        .first();

      if (!sessionCheck) {
        return res.status(403).json({ error: 'Session not found or unauthorized' });
      }

      // Begin transaction
      const client = await this.db.transaction();
      try {
        // Delete existing messages
        await client('chat_messages')
          .where('session_id', sessionId)
          .delete();

        // Insert new messages
        for (const message of messages) {
          await client('chat_messages')
            .insert({
              session_id: sessionId,
              message_type: message.role,
              content: message.content,
              metadata: message.metadata ? JSON.stringify(message.metadata) : null,
              created_at: new Date(message.timestamp),
              updated_at: this.db.fn.now()
            });
        }

        // Update session
        await client('chat_sessions')
          .where('id', sessionId)
          .update({
            message_count: messages.length,
            last_message: messages[messages.length - 1]?.content || '',
            updated_at: this.db.fn.now()
          });

        await client.commit();
        return res.json({ success: true });
      } catch (error) {
        await client.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error saving chat history:', error);
      return res.status(500).json({ error: 'Failed to save chat history' });
    }
  }
} 