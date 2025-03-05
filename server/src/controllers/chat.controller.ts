import { Request, Response } from 'express';
import { Knex } from 'knex';
import { db } from '../infrastructure/database/knex';
import { BadRequestError } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { config } from '../config';
import { OpenAIService } from '../services/openai.service';
import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { pool } from '../config/database';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { RagService } from '../services/rag.service';
import { QdrantService } from '../services/qdrant.service';
import { DocumentProcessorService } from '../services/document-processor.service';

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
    };
  };
}

interface ChatSession {
  id: string;
  user_id: string;
  organization_id: number;
  dashboard_id?: string;
  title: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class ChatController {
  private readonly apiKey: string;
  private readonly orgId: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly db: Knex;
  private readonly openai: OpenAIService;
  private readonly qdrantService: QdrantService;
  private readonly documentProcessor: DocumentProcessorService;

  constructor(openai: OpenAIService, dbInstance?: Knex) {
    // Check for API key in multiple places with fallbacks
    this.apiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey || 'sk-mock-key-for-development';
    this.orgId = process.env.OPENAI_ORG_ID || config.openai?.orgId || '';
    this.db = dbInstance || db;
    this.openai = openai;
    this.qdrantService = QdrantService.getInstance();
    this.documentProcessor = DocumentProcessorService.getInstance();

    // Log the API key state without exposing the actual key
    console.log(`OpenAI API key present: ${!!this.apiKey}`);
    
    // Only throw error in production environment if no key is available
    if (!this.apiKey && process.env.NODE_ENV === 'production') {
      throw new Error('OpenAI API key is required in production environment');
    } else if (!this.apiKey) {
      console.warn('Warning: Using mock OpenAI API key for development. Some functionality may be limited.');
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

        // Add participants
        const participantRecords = participants.map(userId => ({
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

  async sendChatMessage(req: AuthRequest, res: Response) {
    const { content, sessionId, dataSourceIds } = req.body;

    if (!content || !sessionId) {
      return res.status(400).json({ error: 'Content and sessionId are required' });
    }

    try {
      // Verify the session exists and belongs to the user
      const session = await this.db('chat_sessions')
        .where({
          id: sessionId,
          user_id: req.user!.id
        })
        .first();

      if (!session) {
        throw new BadRequestError('Chat session not found');
      }

      // Generate a unique message ID
      const messageId = uuidv4();

      // Store message in database
      await this.db('chat_messages').insert({
        id: messageId,
        session_id: sessionId,
        content,
        role: 'user',
        user_id: req.user!.id,
        created_at: new Date(),
        metadata: {
          dataSourceIds,
          status: 'sent'
        }
      });

      // Update session
      await this.db('chat_sessions')
        .where({ id: sessionId })
        .update({
          last_message: content,
          updated_at: new Date()
        });

      res.json({
        id: messageId,
        sessionId,
        content,
        role: 'user',
        timestamp: Date.now(),
        status: 'sent'
      });
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  async getChatSessions(req: AuthRequest, res: Response) {
    try {
      const { organization_id, dashboard_id } = req.query;
      const user = req.user!;

      // Convert the ID values if necessary
      const orgId = organization_id as string;
      const dashboardId = dashboard_id as string;

      // Check if the user_id column exists in the chat_sessions table
      const hasUserIdColumn = await this.db.schema.hasColumn('chat_sessions', 'user_id');
      console.log('Existing chat_sessions.user_id column exists:', hasUserIdColumn);

      // Check organization_id column type
      const orgIdColumnInfo = await this.db.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'organization_id';
      `);
      
      const orgIdType = orgIdColumnInfo.rows.length > 0 ? orgIdColumnInfo.rows[0].data_type : null;
      
      // For UUID organization_id, we need to create a proper UUID
      let orgUuid;
      if (orgIdType === 'uuid') {
        // Generate a deterministic UUID based on the organization ID
        const { v5: uuidv5 } = require('uuid');
        const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
        orgUuid = uuidv5(`organization-${orgId}`, NAMESPACE);
        console.log(`Converting organization_id ${orgId} to UUID: ${orgUuid}`);
      }

      // Build query
      let query = this.db('chat_sessions')
        .where('organization_id', orgIdType === 'uuid' ? orgUuid : orgId);
      
      if (dashboardId) {
        query = query.where('dashboard_id', dashboardId);
      }
      
      // Only add the user_id condition if the column exists
      if (hasUserIdColumn) {
        query = query.where('user_id', user.id.toString());
      } else {
        // If the column doesn't exist, we can't filter by user_id
        console.log('user_id column does not exist in chat_sessions table, skipping filter');
      }
      
      console.log(`User ID type: ${typeof user.id} Value: ${user.id}`);
      
      const sessions = await query
        .orderBy('updated_at', 'desc');
        
      console.log(`Found ${sessions.length} chat sessions`);
      
      return res.json(sessions);
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      res.status(500).json({ message: 'Database error while fetching chat sessions' });
    }
  }

  async getChatMessages(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const { organization_id, dashboard_id } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Check organization_id column type
      const orgIdColumnInfo = await this.db.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'organization_id';
      `);
      
      const orgIdType = orgIdColumnInfo.rows.length > 0 ? orgIdColumnInfo.rows[0].data_type : null;
      console.log('Organization ID column type:', orgIdType);
      
      // For UUID organization_id, we need to create a proper UUID
      let orgIdValue: string | number = Number(organization_id);
      if (orgIdType === 'uuid') {
        // Generate a deterministic UUID based on the organization ID
        const { v5: uuidv5 } = require('uuid');
        const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
        orgIdValue = uuidv5(`organization-${organization_id}`, NAMESPACE);
        console.log(`Converting organization_id ${organization_id} to UUID: ${orgIdValue}`);
      } else if (isNaN(orgIdValue as number)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Verify the session belongs to the organization
      const session = await this.db('chat_sessions')
        .where({
          id: sessionId,
          organization_id: orgIdValue
        })
        .first();

      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' });
      }

      // Get messages for the session
      const messages = await this.db('chat_messages')
        .where('session_id', sessionId)
        .orderBy('created_at', 'asc');

      // Map message_type to role for client compatibility
      const formattedMessages = messages.map(message => ({
        id: message.id,
        session_id: message.session_id,
        role: message.role, // Use the role column directly as it exists in the table
        content: message.content,
        metadata: message.metadata,
        timestamp: message.created_at.getTime(),
        status: 'complete'
      }));

      return res.json(formattedMessages);
    } catch (error: unknown) {
      console.error('Error getting chat messages:', error);
      return res.status(500).json({ error: 'Failed to get chat messages' });
    }
  }

  async createChatSession(req: AuthRequest, res: Response) {
    try {
      const { title = 'New Chat', organization_id, dashboard_id } = req.body;

      if (!organization_id) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!dashboard_id) {
        return res.status(400).json({ error: 'Dashboard ID is required' });
      }

      // Check if the organization exists
      const orgExists = await this.db('organizations')
        .where('id', organization_id)
        .first();

      if (!orgExists) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Get column information for chat_sessions table
      const columnInfo = await this.db('chat_sessions').columnInfo();
      console.log('Available columns in chat_sessions table:', Object.keys(columnInfo));

      // Check organization_id column type
      const orgIdColumnInfo = await this.db.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'organization_id';
      `);
      
      const orgIdType = orgIdColumnInfo.rows.length > 0 ? orgIdColumnInfo.rows[0].data_type : null;
      console.log('Organization ID column type:', orgIdType);

      // Create a session object with only the columns that exist in the table
      const sessionData: Record<string, any> = {
        title
      };

      // Add columns only if they exist in the database
      if ('organization_id' in columnInfo) {
        if (orgIdType === 'uuid') {
          // For UUID columns, we need to create a proper UUID
          // Generate a deterministic UUID based on the organization ID
          const { v5: uuidv5 } = require('uuid');
          // Use a namespace (can be any valid UUID)
          const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
          // Generate UUID from the organization ID
          const orgUuid = uuidv5(`organization-${organization_id}`, NAMESPACE);
          console.log(`Converting organization_id ${organization_id} to UUID: ${orgUuid}`);
          sessionData.organization_id = orgUuid;
        } else {
          // For other types (integer, text), we can use the value directly
          sessionData.organization_id = organization_id;
        }
      }
      
      if ('dashboard_id' in columnInfo) {
        sessionData.dashboard_id = dashboard_id;
      }
      
      if ('user_id' in columnInfo) {
        sessionData.user_id = req.user.id.toString();
      }
      
      if ('message_count' in columnInfo) {
        sessionData.message_count = 0;
      }
      
      if ('last_message' in columnInfo) {
        sessionData.last_message = '';
      }
      
      // Don't include is_active if it doesn't exist
      if ('is_active' in columnInfo) {
        sessionData.is_active = true;
      }

      console.log('Creating chat session with data:', sessionData);

      // Create a new chat session
      const [session] = await this.db('chat_sessions')
        .insert(sessionData)
        .returning('*');

      return res.status(201).json(session);
    } catch (error) {
      console.error('Error creating chat session:', error);
      return res.status(500).json({ error: 'Failed to create chat session' });
    }
  }

  async updateChatSession(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const { title, organization_id, dashboard_id } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!organization_id || !dashboard_id) {
        return res.status(400).json({ error: 'Organization ID and Dashboard ID are required' });
      }

      // Check if the user_id column exists in the chat_sessions table
      const hasUserIdColumn = await this.db.schema.hasColumn('chat_sessions', 'user_id');

      // Check organization_id column type
      const orgIdColumnInfo = await this.db.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'organization_id';
      `);
      
      const orgIdType = orgIdColumnInfo.rows.length > 0 ? orgIdColumnInfo.rows[0].data_type : null;
      console.log('Organization ID column type:', orgIdType);

      let orgIdValue: string | number = Number(organization_id);
      if (orgIdType === 'uuid') {
        // Convert the numeric organization_id to a UUID
        const { v5: uuidv5 } = require('uuid');
        const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
        orgIdValue = uuidv5(`organization-${organization_id}`, NAMESPACE);
        console.log(`Converting organization_id ${organization_id} to UUID: ${orgIdValue}`);
      } else if (isNaN(orgIdValue as number)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
      }

      // Validate dashboard_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(dashboard_id as string)) {
        return res.status(400).json({ error: 'Invalid Dashboard ID format' });
      }

      // Build the query conditions
      const queryConditions: Record<string, any> = {
        'id': sessionId,
        'organization_id': orgIdValue,
        'dashboard_id': dashboard_id
      };

      // Add user_id condition only if the column exists
      if (hasUserIdColumn) {
        queryConditions['user_id'] = req.user.id.toString();
      }

      const result = await this.db('chat_sessions')
        .where(queryConditions)
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
      const { sessionId } = req.params;
      const { organization_id } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Check if the user_id column exists in the chat_sessions table
      const hasUserIdColumn = await this.db.schema.hasColumn('chat_sessions', 'user_id');

      // Check organization_id column type
      const orgIdColumnInfo = await this.db.raw(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chat_sessions' AND column_name = 'organization_id';
      `);
      
      const orgIdType = orgIdColumnInfo.rows.length > 0 ? orgIdColumnInfo.rows[0].data_type : null;
      console.log('Organization ID column type:', orgIdType);
      
      // For UUID organization_id, we need to create a proper UUID
      let orgIdValue = organization_id as string;
      if (orgIdType === 'uuid') {
        // Generate a deterministic UUID based on the organization ID
        const { v5: uuidv5 } = require('uuid');
        const NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';
        orgIdValue = uuidv5(`organization-${organization_id}`, NAMESPACE);
        console.log(`Converting organization_id ${organization_id} to UUID: ${orgIdValue}`);
      }

      // Build the query conditions
      const queryConditions: Record<string, any> = {
        id: sessionId,
        organization_id: orgIdValue
      };

      // Add user_id condition only if the column exists
      if (hasUserIdColumn) {
        queryConditions.user_id = req.user.id;
      }

      try {
        // Verify the session exists and belongs to the user/organization
        const session = await this.db('chat_sessions')
          .where(queryConditions)
          .first();

        if (!session) {
          return res.status(404).json({ error: 'Chat session not found' });
        }

        // Delete all messages for the session first
        await this.db('chat_messages')
          .where('session_id', sessionId)
          .delete();

        // Then delete the session itself
        await this.db('chat_sessions')
          .where('id', sessionId)
          .delete();

        return res.json({ message: 'Chat session deleted successfully' });
      } catch (error) {
        console.error('Error deleting chat session:', error);
        return res.status(500).json({ error: 'Failed to delete chat session' });
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
      return res.status(500).json({ error: 'Failed to delete chat session' });
    }
  }

  async saveChatHistory(req: AuthRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const { messages, context } = req.body;
      const { id: userId } = req.user;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages must be an array' });
      }
      
      // Begin transaction
      await this.db.transaction(async trx => {
        // Delete existing messages for this session
        await trx('chat_messages')
          .where('session_id', sessionId)
          .delete();
        
        // Insert new messages
        if (messages.length > 0) {
          const messagesToInsert = messages.map((msg, index) => ({
            id: uuidv4(),
            session_id: sessionId,
            role: msg.role,
            content: msg.content,
            metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
            created_at: new Date(),
            updated_at: new Date(),
            position: index
          }));
          
          await trx('chat_messages').insert(messagesToInsert);
        }
        
        // Update session with context if provided
        if (context) {
          await trx('chat_sessions')
            .where('id', sessionId)
            .update({
              metadata: JSON.stringify({ context }),
              updated_at: new Date()
            });
        }
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving chat history:', error);
      return res.status(500).json({ error: 'Failed to save chat history' });
    }
  }

  async regenerateMessage(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.body;
      
      if (!messageId) {
        return res.status(400).json({ error: 'Message ID is required' });
      }
      
      // Get the message to regenerate
      const message = await this.db('chat_messages')
        .where('id', messageId)
        .first();
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Get the preceding user message
      const userMessage = await this.db('chat_messages')
        .where('session_id', message.session_id)
        .where('position', '<', message.position)
        .where('role', 'user')
        .orderBy('position', 'desc')
        .first();
      
      if (!userMessage) {
        return res.status(400).json({ error: 'No preceding user message found for regeneration' });
      }
      
      // Generate new AI response
      const result = await this.openai.generateChatCompletion([
        {
          role: 'user',
          content: userMessage.content,
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.7
      }) as ChatCompletion;
      
      const newContent = result.choices?.[0]?.message?.content || '';
      
      // Update the message with new content
      await this.db('chat_messages')
        .where('id', messageId)
        .update({
          content: newContent,
          updated_at: new Date()
        });
      
      return res.json({
        content: newContent,
        metadata: {
          model: result.model,
          tokens: {
            prompt: result.usage?.prompt_tokens || 0,
            completion: result.usage?.completion_tokens || 0,
            total: result.usage?.total_tokens || 0
          }
        }
      });
    } catch (error) {
      console.error('Error regenerating message:', error);
      return res.status(500).json({ error: 'Failed to regenerate message' });
    }
  }

  private async generateAIResponse(message: string): Promise<OpenAIResponse> {
    try {
      const result = await this.openai.generateChatCompletion([
        {
          role: 'user',
          content: message,
        }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.7
      });
      
      // Safely extract content from result
      let responseContent = "I'm sorry, I couldn't generate a response.";
      let modelName = 'gpt-4o-mini';
      let responseId = uuidv4();
      let usage = {
        prompt: 0,
        completion: 0,
        total: 0
      };
      
      // Safely access response properties
      if (result && typeof result === 'object') {
        // Try to extract the response content
        if ('choices' in result && 
            Array.isArray(result.choices) && 
            result.choices.length > 0 && 
            result.choices[0].message) {
          responseContent = result.choices[0].message.content || responseContent;
        }
        
        // Try to extract other metadata
        if ('id' in result) {
          responseId = result.id as string;
        }
        
        if ('model' in result) {
          modelName = result.model as string;
        }
        
        if ('usage' in result) {
          usage = {
            prompt: result.usage?.prompt_tokens || 0,
            completion: result.usage?.completion_tokens || 0,
            total: result.usage?.total_tokens || 0
          };
        }
      }

      return {
        id: responseId,
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        status: 'complete',
        metadata: {
          model: modelName,
          tokens: usage
        }
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  /**
   * Intelligent query analysis that determines the query characteristics and intent
   * @param query The user query
   * @returns Object with query intent analysis
   */
  private analyzeQueryIntent(query: string): {
    intent: 'analysis' | 'retrieval' | 'exploration' | 'summary' | 'general',
    complexity: 'high' | 'medium' | 'low',
    dataVisualization: boolean,
    entities: string[]
  } {
    if (!query) {
      return {
        intent: 'general',
        complexity: 'low',
        dataVisualization: false,
        entities: []
      };
    }

    const lowerQuery = query.toLowerCase();
    
    // Extract potential entities
    const entities = this.extractPotentialEntitiesFromQuery(query);
    
    // Check for visualization intent
    const visualizationPatterns = [
      /visual/i, /chart/i, /graph/i, /plot/i, /diagram/i, /dashboard/i,
      /pie chart/i, /bar chart/i, /line graph/i, /histogram/i, /heatmap/i,
      /scatter plot/i, /visualize/i, /display/i, /show me/i
    ];
    const needsVisualization = visualizationPatterns.some(pattern => pattern.test(query));
    
    // Check for analytical intent
    const analyticalPatterns = [
      /how many/i, /count/i, /number of/i, /total/i, /sum/i, /average/i, /mean/i,
      /median/i, /trend/i, /growth/i, /compare/i, /correlation/i, /relationship/i,
      /percentage/i, /ratio/i, /proportion/i, /distribution/i, /analyze/i, /analysis/i,
      /statistics/i, /metrics/i, /measure/i, /calculate/i, /computation/i,
      /aggregate/i, /group by/i, /segment/i, /breakdown/i, /categorize/i,
      /vc fund/i, /venture capital/i, /investors/i  // Include VC fund patterns here
    ];
    const isAnalytical = analyticalPatterns.some(pattern => pattern.test(query));
    
    // Check for summarization intent
    const summaryPatterns = [
      /summarize/i, /summary/i, /overview/i, /gist/i, /brief/i, /synopsis/i,
      /outline/i, /recap/i, /key points/i, /main ideas/i, /highlight/i,
      /tldr/i, /brief description/i, /executive summary/i
    ];
    const isSummary = summaryPatterns.some(pattern => pattern.test(query));
    
    // Check for exploration intent
    const explorationPatterns = [
      /explore/i, /discover/i, /find/i, /search/i, /look for/i, /identify/i,
      /are there any/i, /can you find/i, /tell me about/i, /what do you know/i,
      /information on/i, /details about/i, /learn about/i, /more about/i
    ];
    const isExploration = explorationPatterns.some(pattern => pattern.test(query));
    
    // Determine complexity
    let complexity: 'high' | 'medium' | 'low' = 'low';
    
    if ((isAnalytical && entities.length > 2) || (needsVisualization && isAnalytical)) {
      complexity = 'high';
    } else if (isAnalytical || needsVisualization || (isSummary && entities.length > 0)) {
      complexity = 'medium';
    }
    
    // Determine primary intent
    let intent: 'analysis' | 'retrieval' | 'exploration' | 'summary' | 'general' = 'general';
    
    if (isAnalytical) {
      intent = 'analysis';
    } else if (isSummary) {
      intent = 'summary';
    } else if (isExploration) {
      intent = 'exploration';
    } else if (entities.length > 0) {
      intent = 'retrieval';
    }
    
    return {
      intent,
      complexity,
      dataVisualization: needsVisualization,
      entities
    };
  }

  /**
   * Determines whether a query is analytical in nature
   * @param query The user query
   * @returns Whether the query is analytical
   */
  private isAnalyticalQuery(query: string): boolean {
    const analysis = this.analyzeQueryIntent(query);
    return analysis.intent === 'analysis';
  }
  
  /**
   * Detects if a query is asking to count entities of a specific type
   * This is a more general version that can detect counts for any entity type
   * @param query The user query to analyze
   * @returns Information about the entity count query
   */
  private detectEntityCount(query: string): { 
    isCountQuery: boolean;
    entityType?: string;
  } {
    const lowerQuery = query.toLowerCase();
    
    // Count/enumeration patterns
    const countPatterns = [
      /how many/i,
      /count of/i,
      /number of/i,
      /total/i,
      /list all/i,
      /enumerate/i
    ];
    
    const isCountQuery = countPatterns.some(pattern => pattern.test(lowerQuery));
    
    if (!isCountQuery) {
      return { isCountQuery: false };
    }
    
    // Entity type patterns
    const entityTypes = [
      { type: 'organization', patterns: [/company/i, /organization/i, /business/i, /firm/i, /corporation/i, /fund/i, /investor/i] },
      { type: 'person', patterns: [/person/i, /people/i, /individual/i, /employee/i, /founder/i] },
      { type: 'location', patterns: [/location/i, /place/i, /country/i, /city/i, /region/i] },
      { type: 'product', patterns: [/product/i, /service/i, /solution/i, /offering/i] }
    ];
    
    // Try to determine entity type
    let entityType: string | undefined;
    
    for (const category of entityTypes) {
      if (category.patterns.some(pattern => pattern.test(lowerQuery))) {
        entityType = category.type;
        break;
      }
    }
    
    return {
      isCountQuery,
      entityType
    };
  }

  /**
   * Determines whether a query is specifically counting VC funds
   * Maintained for backward compatibility
   * @param query The user query
   * @returns Whether the query is counting VC funds
   */
  private isVCFundCountQuery(query: string): boolean {
    const entityCount = this.detectEntityCount(query);
    
    // Check specifically for fund/investor related terms
    const vcFundTerms = [
      /vc fund/i,
      /venture capital/i,
      /investors/i
    ];
    
    return entityCount.isCountQuery && 
           (entityCount.entityType === 'organization' || 
            vcFundTerms.some(term => term.test(query)));
  }

  /**
   * Detects if a query is asking to count any type of entity (people, organizations, etc.)
   * @param query The user query to analyze
   * @returns Whether the query is asking to count entities and what type
   */
  private isEntityCountQuery(query: string): { isCountQuery: boolean, entityType?: string } {
    const lowerQuery = query.toLowerCase();
    
    // Count/enumeration patterns that work for any entity type
    const countPatterns = [
      /how many/i,
      /count of/i,
      /number of/i,
      /total/i,
      /list all/i,
      /enumerate/i
    ];
    
    const isCountQuery = countPatterns.some(pattern => pattern.test(lowerQuery));
    
    if (!isCountQuery) {
      return { isCountQuery: false };
    }
    
    // Entity type patterns - can be extended with more entity types
    const entityTypes = [
      { type: 'organization', patterns: [/company/i, /organization/i, /business/i, /firm/i, /corporation/i, /fund/i, /investor/i] },
      { type: 'person', patterns: [/person/i, /people/i, /individual/i, /employee/i, /founder/i] },
      { type: 'location', patterns: [/location/i, /place/i, /country/i, /city/i, /region/i] },
      { type: 'product', patterns: [/product/i, /service/i, /solution/i, /offering/i] }
    ];
    
    // Try to determine entity type
    let entityType: string | undefined;
    
    for (const category of entityTypes) {
      if (category.patterns.some(pattern => pattern.test(lowerQuery))) {
        entityType = category.type;
        break;
      }
    }
    
    return {
      isCountQuery,
      entityType
    };
  }

  /**
   * Determines whether a query is asking for a document overview
   * @param query The user query
   * @returns Whether the query is requesting a document overview
   */
  private isDocumentOverviewQuery(query: string): boolean {
    const analysis = this.analyzeQueryIntent(query);
    return analysis.intent === 'summary';
  }

  /**
   * Extract entities from content with comprehensive entity detection
   * @param content Text content to extract entities from
   * @returns Array of extracted entities
   */
  private extractEntitiesFromContent(content: string): string[] {
    if (!content || typeof content !== 'string') {
      return [];
    }
    
    const entities: string[] = [];
    
    // Look for potential named entities (capitalized words or phrases)
    const namedEntityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    const namedEntities = content.match(namedEntityPattern) || [];
    namedEntities.forEach(noun => {
      if (noun.length > 1 && !['I', 'A', 'The'].includes(noun)) {
        entities.push(noun);
      }
    });
    
    // Look for various organization patterns
    const organizationPatterns = [
      // Standard company suffixes
      /([A-Z][a-z]+ (?:Group|Inc|LLC|Corp|Company|Co|Ltd))/g,
      // Investment-related organizations
      /([A-Z][a-z]+ (?:Capital|Ventures|Partners|Investments|Fund|Equity))/g,
      // Non-profit and governmental
      /([A-Z][a-z]+ (?:Foundation|Association|Institute|Agency|Committee|Council))/g,
      // Tech companies
      /([A-Z][a-z]+ (?:Technologies|Systems|Solutions|Software|Networks|Labs))/g
    ];
    
    for (const pattern of organizationPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => entities.push(match));
      }
    }
    
    // Look for person name patterns
    const personPatterns = [
      // Titles with names
      /(?:Dr|Mr|Mrs|Ms|Prof)\.\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
      // Role descriptions
      /(?:CEO|CTO|CFO|COO|President|Director) ([A-Z][a-z]+ [A-Z][a-z]+)/g
    ];
    
    for (const pattern of personPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const namePart = match.split(' ').slice(1).join(' ');
          entities.push(namePart);
        });
      }
    }
    
    // Look for location patterns
    const locationPatterns = [
      // Cities, states, countries with indicators
      /(?:in|at|from|to) ([A-Z][a-z]+ (?:City|State|County|Province|Island))/g,
      // Common location types
      /([A-Z][a-z]+ (?:University|College|Hospital|Airport|Station|Center|Centre))/g
    ];
    
    for (const pattern of locationPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract just the location part without prepositions
          const locationPart = match.replace(/^(?:in|at|from|to) /, '');
          entities.push(locationPart);
        });
      }
    }
    
    // Look for product names
    const productPatterns = [
      // Product with version
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)* (?:v\d+|\d+\.\d+|Pro|Plus|Premium|Enterprise|Basic))/g,
      // Product categories
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)* (?:Platform|Suite|System|Framework|Tool|App|Application))/g
    ];
    
    for (const pattern of productPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => entities.push(match));
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Select the most appropriate model based on query intent analysis
   * @param queryAnalysis The analysis of query intent
   * @returns The most appropriate model for the query
   */
  private selectModelForQuery(queryAnalysis: ReturnType<typeof this.analyzeQueryIntent>): string {
    // Default model for most queries
    const defaultModel = 'gpt-4o-mini';
    
    // Model selection based on intent and complexity
    if (queryAnalysis.complexity === 'high') {
      // For complex analytical queries or multi-dimensional analysis
      return 'gpt-4o';
    } else if (queryAnalysis.intent === 'analysis' && queryAnalysis.complexity === 'medium') {
      // For medium complexity analytical tasks
      return 'o3-mini';
    } else if (queryAnalysis.intent === 'summary' && queryAnalysis.complexity === 'medium') {
      // For medium complexity summarization tasks
      return 'gpt-4o-mini';
    } else if (queryAnalysis.dataVisualization) {
      // When visualization is needed
      return 'o3-mini'; // Better reasoning for visualization description
    }
    
    // Default fallback
    return defaultModel;
  }

  /**
   * Generate the optimal system prompt based on query intent analysis
   * @param queryAnalysis The analysis of query intent
   * @returns Appropriate system prompt for the query
   */
  private generateSystemPrompt(queryAnalysis: ReturnType<typeof this.analyzeQueryIntent>): string {
    let systemPrompt = 'You are a helpful assistant. Provide accurate and informative responses.';
    
    // Add specialized instructions based on intent
    if (queryAnalysis.intent === 'analysis') {
      systemPrompt = `You are an advanced analytics and business intelligence assistant. 
Approach queries analytically, using data-driven insights and statistical reasoning. 
${queryAnalysis.dataVisualization ? 
  'Recommend appropriate visualizations and explain how they would represent the data effectively. Describe charts in detail including axes, data points, and visual elements.' : 
  'Organize information clearly with quantitative assessments when possible.'}
${queryAnalysis.complexity === 'high' ? 
  'Break complex analysis into clear, logical components. Consider multiple dimensions and their interactions.' : 
  'Focus on clear, direct analysis that addresses the specific metrics requested.'}`;
    } else if (queryAnalysis.intent === 'summary') {
      systemPrompt = `You are a document analysis assistant specializing in clear, concise summaries.
Extract key points, identify main themes, and organize information effectively.
${queryAnalysis.entities.length > 0 ? 
  `Pay special attention to these entities: ${queryAnalysis.entities.join(', ')}.` : 
  'Focus on the most relevant information to provide a comprehensive overview.'}`;
    } else if (queryAnalysis.intent === 'exploration') {
      systemPrompt = `You are a research and discovery assistant, helping to explore information and connections.
Present diverse, relevant information in a structured way to facilitate understanding and discovery.
${queryAnalysis.entities.length > 0 ? 
  `Focus your exploration around these entities: ${queryAnalysis.entities.join(', ')}.` : 
  'Cast a wide net initially, then focus on the most relevant aspects based on context.'}`;
    } else if (queryAnalysis.dataVisualization) {
      systemPrompt = `You are a data visualization and analytics expert.
Recommend appropriate visualizations for the data being discussed.
Describe visualization details including: chart type, axes, data points, colors, and annotations.
Explain why your chosen visualization effectively communicates the insights in the data.`;
    }
    
    return systemPrompt;
  }

  public generateCompletion = async (req: AuthRequest, res: Response) => {
    try {
      const { prompt, model, sessionId, files, options, conversationId, data_sources } = req.body;

      if (!prompt) {
        throw new BadRequestError('Prompt is required');
      }

      // Use RAG if data sources are provided
      if (data_sources && Array.isArray(data_sources) && data_sources.length > 0) {
        const ragService = new RagService();
        const ragResult = await ragService.processQuery(prompt, data_sources, sessionId);
        
        // Save RAG result to chat history if sessionId is provided
        if (sessionId) {
          try {
            // Save the user's message
            await this.db('chat_messages').insert({
              session_id: sessionId,
              role: 'user',
              content: prompt,
              created_at: new Date(),
              updated_at: new Date()
            });
            
            // Save the assistant's response
            await this.db('chat_messages').insert({
              session_id: sessionId,
              role: 'assistant',
              content: ragResult.content,
              metadata: {
                sources: ragResult.sources?.map(doc => ({
                  id: doc.id || doc.sourceId,
                  content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
                  sourceName: doc.sourceName
                })),
                model: ragResult.model,
                timestamp: new Date().toISOString()
              },
              created_at: new Date(),
              updated_at: new Date()
            });
            
            // Update the session's last message
            await this.db('chat_sessions')
              .where({ id: sessionId })
              .update({
                last_message: ragResult.content.substring(0, 255), // Truncate for db column limit
                updated_at: new Date()
              });
          } catch (saveError) {
            console.error('Error saving RAG results to chat history:', saveError);
            // Continue even if saving fails
          }
        }
        
        // Return the RAG result to the client
        return res.json({
          id: uuidv4(),
          content: ragResult.content,
          sources: ragResult.sources,
          model: ragResult.model || model || 'gpt-4o-mini'
        });
      }
      
      // Perform intelligent query analysis
      const queryAnalysis = this.analyzeQueryIntent(prompt);
      console.log('Query analysis:', JSON.stringify(queryAnalysis, null, 2));

      // Select the appropriate model based on query analysis
      let selectedModel = model;
      if (!selectedModel) {
        if (queryAnalysis.intent === 'analysis' && queryAnalysis.complexity === 'high') {
          // For complex analytical queries, use a more capable model
          selectedModel = 'gpt-4o';
          console.log('Using gpt-4o model for complex analytical query');
        } else if (queryAnalysis.intent === 'analysis') {
          // For analytical queries, use a model with good reasoning
          selectedModel = 'o3-mini';
          console.log('Using o3-mini model for analytical query');
        } else if (queryAnalysis.intent === 'summary') {
          // For document overview, use a model with good summarization capabilities
          selectedModel = 'gpt-4o-mini';
          console.log('Using gpt-4o-mini model for summary query');
        } else if (queryAnalysis.dataVisualization) {
          // For visualization requests, use a model with good reasoning capabilities
          selectedModel = 'o3-mini';
          console.log('Using o3-mini model for visualization query');
        } else {
          // For regular queries, use a cost-effective model
          selectedModel = 'gpt-4o-mini';
          console.log('Using gpt-4o-mini model for standard query');
        }
      } else {
        console.log(`Using user-specified model: ${selectedModel}`);
      }
      
      // Retrieve previous messages if sessionId is provided
      let messageHistory: ChatCompletionMessageParam[] = [];
      if (sessionId) {
        const previousMessages = await this.db('chat_messages')
          .where({ session_id: sessionId })
          .orderBy('created_at', 'asc')
          .limit(10) // Consider the last 10 messages for context
          .select('*');
        
        messageHistory = previousMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        }));
      }
      
      // Generate system prompt based on query intent
      let systemPrompt = 'You are a helpful assistant. Provide accurate and informative responses.';
      
      if (queryAnalysis.intent === 'analysis') {
        systemPrompt = `You are an advanced analytics and business intelligence assistant.
Approach queries analytically, using data-driven insights and statistical reasoning.
${queryAnalysis.dataVisualization ? 
  'Recommend appropriate visualizations and explain how they would represent the data effectively. Describe charts in detail including axes, data points, and visual elements.' : 
  'Organize information clearly with quantitative assessments when possible.'}
${queryAnalysis.complexity === 'high' ? 
  'Break complex analysis into clear, logical components.' : 
  'Focus on clear, direct analysis that addresses the specific analytical needs.'}`;
      } else if (queryAnalysis.intent === 'summary') {
        systemPrompt = `You are a document analysis assistant specializing in clear, concise summaries.
Extract key points, identify main themes, and organize information effectively.
${queryAnalysis.entities.length > 0 ? 
  `Pay special attention to these entities: ${queryAnalysis.entities.join(', ')}.` : 
  'Focus on the most relevant information to provide a comprehensive overview.'}`;
      } else if (queryAnalysis.dataVisualization) {
        systemPrompt = `You are a data visualization and analytics expert.
Recommend appropriate visualizations for the data being discussed.
Describe visualization details including: chart type, axes, data points, colors, and annotations.
Explain why your chosen visualization effectively communicates the insights in the data.`;
      }
      
      // Add system prompt at the beginning if not already present
      if (messageHistory.length === 0 || messageHistory[0].role !== 'system') {
        messageHistory.unshift({
          role: 'system',
          content: systemPrompt
        });
      } else {
        // Update existing system prompt with our more specialized one
        messageHistory[0].content = systemPrompt;
      }
      
      // Add the current prompt to the message history
      messageHistory.push({
        role: 'user',
        content: prompt
      });

      // Generate completion
      const result = await this.openai.generateChatCompletion(messageHistory, {
        model: selectedModel,
        temperature: options?.temperature || 0.7
      });
      
      // Safely access response properties
      let responseContent = "I couldn't generate a response.";
      let modelName = selectedModel;
      let responseId = uuidv4();
      let usageStats = undefined;
      
      // Check if the result is a proper object with the expected properties
      if (result && typeof result === 'object') {
        // Try to extract the response content
        if ('choices' in result && 
            Array.isArray(result.choices) && 
            result.choices.length > 0 && 
            result.choices[0].message) {
          responseContent = result.choices[0].message.content || responseContent;
        }
        
        // Try to extract other metadata
        if ('id' in result) {
          responseId = result.id as string;
        }
        
        if ('model' in result) {
          modelName = result.model as string;
        }
        
        if ('usage' in result) {
          usageStats = result.usage;
        }
      }
      
      // Save messages to chat history if sessionId is provided
      if (sessionId) {
        try {
          // Save the user's message if it wasn't part of the history already
          if (!messageHistory.some(msg => msg.role === 'user' && msg.content === prompt)) {
            await this.db('chat_messages').insert({
              session_id: sessionId,
              role: 'user',
              content: prompt,
              created_at: new Date(),
              updated_at: new Date()
            });
          }
          
          // Save the assistant's response
          await this.db('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: responseContent,
            metadata: {
              model: modelName,
              tokens: usageStats ? {
                prompt: usageStats.prompt_tokens || 0,
                completion: usageStats.completion_tokens || 0,
                total: usageStats.total_tokens || 0
              } : undefined,
              queryAnalysis,
              timestamp: new Date().toISOString()
            },
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Update the session's last message
          await this.db('chat_sessions')
            .where({ id: sessionId })
            .update({
              last_message: responseContent.substring(0, 255), // Truncate for db column limit
              updated_at: new Date()
            });
            
          console.log(`Saved chat history for session ${sessionId}`);
        } catch (saveError) {
          console.error('Error saving to chat history:', saveError);
          // Continue even if saving fails
        }
      }
      
      // Return response
      return res.json({
        id: responseId,
        content: responseContent,
        model: modelName,
        usage: usageStats,
        queryAnalysis // Include the query analysis in the response
      });
      
    } catch (error) {
      console.error('Error generating completion:', error);
      
      // Handle OpenAI API errors
      if (error instanceof Error) {
        const openaiError = error as any;
        if (openaiError.error?.type === 'invalid_request_error') {
          return res.status(400).json({ 
            error: openaiError.error.message || 'Invalid request to OpenAI API' 
          });
        }
      }
      
      return res.status(500).json({ 
        error: 'Failed to generate completion',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };

  /**
   * Extract potential entities from a query
   */
  private extractPotentialEntitiesFromQuery(query: string): string[] {
    if (!query) return [];
    
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Direct entity extraction from question formats
    if (lowerQuery.includes('about ')) {
      const matches = query.match(/about\s+([A-Z][a-zA-Z\s]+)(?:\?|$|\s+in\s+)/gi);
      if (matches) {
        matches.forEach(match => {
          const entity = match.replace(/about\s+/i, '').replace(/\?$/, '').trim();
          if (entity && entity.length > 1) {
            entities.push(entity);
          }
        });
      }
    }
    
    // For queries asking about counts
    if (/how many|count of|number of/i.test(lowerQuery)) {
      // Extract potential entity after these phrases
      const matches = query.match(/(?:how many|count of|number of)\s+(\w+(?:\s+\w+){0,3})\s+(?:are there|is there|exist|in|for)/i);
      if (matches && matches[1]) {
        entities.push(matches[1].trim());
      }
      
      // Look for entities that follow prepositions
      const entityAfterPrep = query.match(/(?:for|of|about|in)\s+([A-Z][a-zA-Z\s]+)(?:\?|$|\s+)/i);
      if (entityAfterPrep && entityAfterPrep[1]) {
        entities.push(entityAfterPrep[1].trim());
      }
    }
    
    // Extract any proper noun phrases (capitalized words)
    const properNouns = query.match(/\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b/g);
    if (properNouns) {
      properNouns.forEach(noun => {
        if (noun.length > 1 && !['I', 'A', 'The'].includes(noun)) {
          entities.push(noun);
        }
      });
    }
    
    // Common entity names we want to explicitly check for
    const commonEntities = [
      'VC Fund',
      'Venture Capital',
      'South Park Commons'
    ];
    
    for (const entity of commonEntities) {
      if (query.toLowerCase().includes(entity.toLowerCase())) {
        entities.push(entity);
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Count entities in documents
   */
  private countEntitiesInDocuments(documents: any[], potentialEntities: string[] = []): Record<string, number> {
    const entityCounts: Record<string, number> = {};
    
    // Initialize counts for all potential entities
    for (const entity of potentialEntities) {
      entityCounts[entity] = 0;
    }
    
    // Count entities in each document
    for (const doc of documents) {
      const content = doc.content || '';
      
      // Count explicit mentions of the potential entities
      for (const entity of potentialEntities) {
        if (content.toLowerCase().includes(entity.toLowerCase())) {
          entityCounts[entity] = (entityCounts[entity] || 0) + 1;
        }
      }
      
      // Look for other potential entities in the content
      this.extractEntitiesFromContent(content).forEach(entity => {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
      });
      
      // Also check metadata for entities
      if (doc.metadata) {
        ['name', 'title', 'organization', 'company', 'vc_fund', 'entity'].forEach(field => {
          if (doc.metadata[field] && typeof doc.metadata[field] === 'string') {
            const entity = doc.metadata[field].trim();
            entityCounts[entity] = (entityCounts[entity] || 0) + 1;
          }
        });
      }
    }
    
    // Filter out entities with zero counts and common words
    const filteredCounts: Record<string, number> = {};
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'of', 'for', 'in', 'on', 'at', 'to', 'with'];
    
    Object.entries(entityCounts).forEach(([entity, count]) => {
      if (count > 0 && entity.length > 1 && !commonWords.includes(entity.toLowerCase())) {
        filteredCounts[entity] = count;
      }
    });
    
    return filteredCounts;
  }

  private async getRandomDocumentSamples(collectionName: string, limit: number): Promise<any[]> {
    try {
      // Implement a fallback if the service doesn't have getRandomPoints
      if (typeof this.qdrantService.getRandomPoints === 'function') {
        return await this.qdrantService.getRandomPoints(collectionName, limit);
      } else {
        // Fallback: simply return an empty array
        console.warn(`QdrantService.getRandomPoints is not implemented. Returning empty array.`);
        return [];
      }
    } catch (error) {
      console.error(`Error getting random document samples: ${error}`);
      return [];
    }
  }
} 