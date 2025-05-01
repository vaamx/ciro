import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@config/database';
import { User } from '../../core/database/prisma-types';
import {
  CreateChatSessionDto,
  UpdateChatSessionDto,
  AddMessagesToHistoryDto,
  ChatSessionResponseDto,
  ChatMessageDto
} from './dto/chat-session.dto';

@Injectable()
export class ChatSessionsService {
  private readonly logger = new Logger(ChatSessionsService.name);

  /**
   * Get all chat sessions for a user with optional organization and dashboard filters
   */
  async getChatSessions(
    user: User,
    organizationId?: string,
    dashboardId?: string
  ): Promise<ChatSessionResponseDto[]> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Handle organization_id filter if provided
      const orgId = organizationId ? Number(organizationId) : undefined;
      
      let query = db('chat_sessions').where('user_id', user.id);
      
      if (orgId) {
        // First check if organization exists
        try {
          const orgExists = await db('organizations').where('id', orgId).first();
          
          if (orgExists) {
            query = query.where('organization_id', orgId);
          } else {
            this.logger.warn(`Organization ID ${orgId} not found, ignoring filter`);
          }
        } catch (err) {
          this.logger.warn(`Error checking organization ${orgId}, ignoring filter: ${err}`);
        }
      }
      
      if (dashboardId) {
        query = query.where('dashboard_id', dashboardId);
      }

      const sessions = await query.orderBy('updated_at', 'desc');
      
      // Parse metadata if it's stored as a string
      return sessions.map(session => this.parseSessionMetadata(session));
    } catch (error) {
      this.logger.error(`Error fetching chat sessions for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return empty array instead of throwing to maintain UI stability
      return [];
    }
  }

  /**
   * Create a new chat session
   */
  async createChatSession(
    user: User,
    createChatSessionDto: CreateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const { title, organization_id, dashboard_id } = createChatSessionDto;
    
    try {
      // Create a default title if none provided
      const sessionTitle = title || 'New Chat Session';
      
      // Check if provided organization_id exists
      let finalOrgId = null;
      if (organization_id) {
        try {
          const orgExists = await db('organizations').where('id', organization_id).first();
          
          if (orgExists) {
            finalOrgId = organization_id;
          } else {
            this.logger.warn(`Organization ID ${organization_id} not found, using null`);
          }
        } catch (err) {
          this.logger.warn(`Error checking organization ${organization_id}, using null: ${err}`);
        }
      }
      
      // Check if is_active column exists
      let hasIsActiveColumn = false;
      try {
        hasIsActiveColumn = await db.schema.hasColumn('chat_sessions', 'is_active');
      } catch (err) {
        this.logger.warn('Could not check for is_active column');
      }
      
      const insertData: any = {
        user_id: user.id,
        title: sessionTitle,
        organization_id: finalOrgId,
        dashboard_id: dashboard_id || null,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
        metadata: JSON.stringify({ history: [] })
      };
      
      // Only add is_active if the column exists
      if (hasIsActiveColumn) {
        insertData.is_active = true;
      }

      const [session] = await db('chat_sessions').insert(insertData).returning('*');

      return this.parseSessionMetadata(session);
    } catch (error) {
      this.logger.error(`Error creating chat session for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Throw a more specific error for debugging
      if (error instanceof Error) {
        throw new BadRequestException(`Failed to create chat session: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get a chat session by ID
   */
  async getChatSessionById(
    user: User,
    sessionId: string
  ): Promise<ChatSessionResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Check if ID is a local ID (starts with 'local_')
      const isLocalId = sessionId.startsWith('local_');
      
      let session;
      if (isLocalId) {
        // For local IDs, use a client-side only approach
        session = {
          id: sessionId,
          title: 'Local Session',
          user_id: user.id.toString(),
          created_at: new Date(),
          updated_at: new Date(),
          metadata: { history: [] }
        };
      } else {
        // For server IDs, query the database
        session = await db('chat_sessions')
          .where({
            id: sessionId,
            user_id: user.id
          })
          .first();
        
        if (!session) {
          throw new NotFoundException('Chat session not found');
        }
        
        session = this.parseSessionMetadata(session);
      }

      return session;
    } catch (error) {
      this.logger.error(`Error fetching chat session ${sessionId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Update a chat session
   */
  async updateChatSession(
    user: User,
    sessionId: string,
    updateChatSessionDto: UpdateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const { title, is_active, metadata } = updateChatSessionDto;
    
    try {
      // Check if session exists and belongs to user
      const session = await db('chat_sessions')
        .where({
          id: sessionId,
          user_id: user.id
        })
        .first();
      
      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      const updateData: any = {
        updated_at: db.fn.now()
      };

      if (title !== undefined) updateData.title = title;
      
      // Check if is_active column exists before updating it
      if (is_active !== undefined) {
        const hasIsActive = await db.schema.hasColumn('chat_sessions', 'is_active');
        if (hasIsActive) {
          updateData.is_active = is_active;
        }
      }
      
      if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);

      const [updatedSession] = await db('chat_sessions')
        .where('id', sessionId)
        .update(updateData)
        .returning('*');
      
      return this.parseSessionMetadata(updatedSession);
    } catch (error) {
      this.logger.error(`Error updating chat session ${sessionId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Delete a chat session
   */
  async deleteChatSession(
    user: User,
    sessionId: string
  ): Promise<void> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Check if session exists and belongs to user
      const session = await db('chat_sessions')
        .where({
          id: sessionId,
          user_id: user.id
        })
        .first();
      
      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      await db('chat_sessions')
        .where('id', sessionId)
        .delete();
    } catch (error) {
      this.logger.error(`Error deleting chat session ${sessionId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Add messages to a chat session's history
   */
  async addMessagesToHistory(
    user: User,
    sessionId: string,
    addMessagesDto: AddMessagesToHistoryDto
  ): Promise<ChatSessionResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    if (!addMessagesDto.messages || !Array.isArray(addMessagesDto.messages) || addMessagesDto.messages.length === 0) {
      throw new BadRequestException('No messages provided');
    }

    try {
      // If local ID, simulate success and return dummy response
      if (sessionId.startsWith('local_')) {
        return {
          id: sessionId,
          title: 'Local Session',
          user_id: user.id.toString(),
          created_at: new Date(),
          updated_at: new Date(),
          metadata: {
            history: addMessagesDto.messages
          }
        };
      }

      // Check if session exists and belongs to user
      const session = await db('chat_sessions')
        .where({
          id: sessionId,
          user_id: user.id
        })
        .first();
      
      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      // Parse existing metadata
      let metadata: any = {};
      try {
        metadata = typeof session.metadata === 'string' 
          ? JSON.parse(session.metadata) 
          : session.metadata || {};
      } catch (e) {
        this.logger.warn(`Failed to parse existing metadata as JSON for session ${sessionId}`);
        metadata = {};
      }

      // Ensure history array exists
      if (!metadata.history) {
        metadata.history = [];
      }

      // Add new messages
      // Add timestamps if missing
      const messagesWithTimestamps = addMessagesDto.messages.map(message => ({
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }));
      
      metadata.history = [...metadata.history, ...messagesWithTimestamps];

      // Update session with new metadata
      const [updatedSession] = await db('chat_sessions')
        .where('id', sessionId)
        .update({
          updated_at: db.fn.now(),
          metadata: JSON.stringify(metadata)
        })
        .returning('*');
      
      return this.parseSessionMetadata(updatedSession);
    } catch (error) {
      this.logger.error(`Error adding messages to session ${sessionId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get messages from a chat session's history
   */
  async getMessages(
    user: User,
    sessionId: string
  ): Promise<ChatMessageDto[]> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // If local ID, return empty history
      if (sessionId.startsWith('local_')) {
        return [];
      }

      // Check if session exists and belongs to user
      const session = await db('chat_sessions')
        .where({
          id: sessionId,
          user_id: user.id
        })
        .first();
      
      if (!session) {
        throw new NotFoundException('Chat session not found');
      }

      // Parse metadata to get history
      let metadata: any = {};
      try {
        metadata = typeof session.metadata === 'string' 
          ? JSON.parse(session.metadata) 
          : session.metadata || {};
      } catch (e) {
        this.logger.warn(`Failed to parse metadata as JSON for session ${sessionId}`);
        metadata = {};
      }

      return metadata.history || [];
    } catch (error) {
      this.logger.error(`Error fetching messages for session ${sessionId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Helper to parse session metadata from string to object if needed
   */
  private parseSessionMetadata(session: any): ChatSessionResponseDto {
    if (!session) return session;
    
    if (session && typeof session.metadata === 'string') {
      try {
        session.metadata = JSON.parse(session.metadata);
      } catch (e) {
        this.logger.warn(`Failed to parse metadata as JSON for session ${session.id}`);
        session.metadata = { history: [] };
      }
    }
    
    return session;
  }
} 