import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../utils/logger-factory';
import { db } from '../../config/database';
import { OpenAIService } from '../ai/openai.service';

/**
 * Interface for a conversation message
 */
export interface ConversationMessage {
  id?: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Service for managing conversation history and sessions
 */
@Injectable()
export class ConversationService {
  private readonly logger = createServiceLogger('ConversationService');
  private openaiService: OpenAIService;
  

  private constructor(
    private readonly openAIService: OpenAIService,
    ) {
    this.logger.info('ConversationService initialized');
    this.openaiService = this.openAIService;
  }

  /**
   * Get the singleton instance of the service
   */
  

  /**
   * Save a new message to the conversation history
   * @param message Message to save
   * @returns ID of the saved message
   */
  async saveMessage(message: ConversationMessage): Promise<string> {
    try {
      const [id] = await db('conversation_messages').insert({
        session_id: message.sessionId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp || new Date(),
        metadata: message.metadata ? JSON.stringify(message.metadata) : null
      });
      
      this.logger.info(`Saved message ${id} to session ${message.sessionId}`);
      return String(id);
    } catch (error) {
      this.logger.error(`Error saving message: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   * @param sessionId Session ID
   * @param limit Optional limit on number of messages to retrieve
   * @returns Array of conversation messages
   */
  async getConversationHistory(
    sessionId: string,
    limit?: number
  ): Promise<ConversationMessage[]> {
    try {
      let query = db('conversation_messages')
        .where({ session_id: sessionId })
        .orderBy('timestamp', 'asc');
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const messages = await query;
      
      // Format messages to match ConversationMessage interface
      return messages.map(msg => ({
        id: String(msg.id),
        sessionId: msg.session_id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined
      }));
    } catch (error) {
      this.logger.error(`Error getting conversation history: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create a new conversation session
   * @param metadata Optional metadata for the session
   * @returns ID of the created session
   */
  async createSession(
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const [id] = await db('conversation_sessions').insert({
        created_at: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null
      });
      
      this.logger.info(`Created new conversation session ${id}`);
      return String(id);
    } catch (error) {
      this.logger.error(`Error creating session: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get session information
   * @param sessionId Session ID
   * @returns Session information or null if not found
   */
  async getSession(
    sessionId: string
  ): Promise<{ id: string; createdAt: Date; metadata?: Record<string, any> } | null> {
    try {
      const session = await db('conversation_sessions')
        .where({ id: sessionId })
        .first();
      
      if (!session) {
        return null;
      }
      
      return {
        id: String(session.id),
        createdAt: new Date(session.created_at),
        metadata: session.metadata ? JSON.parse(session.metadata) : undefined
      };
    } catch (error) {
      this.logger.error(`Error getting session: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Format conversation history for AI context
   * @param sessionId Session ID
   * @param limit Optional limit on number of messages to include
   * @returns Array of messages formatted for the AI
   */
  async getFormattedHistoryForAI(
    sessionId: string,
    limit?: number
  ): Promise<Array<{ role: string; content: string }>> {
    try {
      const messages = await this.getConversationHistory(sessionId, limit);
      
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    } catch (error) {
      this.logger.error(`Error formatting history for AI: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
} 