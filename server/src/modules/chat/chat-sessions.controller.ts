import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  HttpCode,
  Logger,
  ParseIntPipe,
  ValidationPipe
} from '@nestjs/common';
import { ChatSessionsService } from './chat-sessions.service';
import { ChatService } from './chat.service';
import { GetUser } from '../../core/auth/get-user.decorator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { users } from '../../core/database/prisma-types'; // Placeholder path
import {
  CreateChatSessionDto,
  UpdateChatSessionDto,
  AddMessagesToHistoryDto,
  ChatSessionResponseDto,
  ChatMessageDto
} from './dto/chat-session.dto';

@Controller('chat/sessions')
@UseGuards(JwtAuthGuard)
export class ChatSessionsController {
  private readonly logger = new Logger(ChatSessionsController.name);

  constructor(
    private readonly chatSessionsService: ChatSessionsService,
    private readonly chatService: ChatService
  ) {}

  @Get()
  async getChatSessions(
    @GetUser() user: users,
    @Query('organization_id') organizationId?: string,
    @Query('dashboard_id') dashboardId?: string
  ): Promise<ChatSessionResponseDto[]> {
    return this.chatSessionsService.getChatSessions(user, organizationId, dashboardId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createChatSession(
    @GetUser() user: users,
    @Body() createChatSessionDto: CreateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.createChatSession(user, createChatSessionDto);
  }

  @Get(':id')
  async getChatSessionById(
    @GetUser() user: users,
    @Param('id') sessionId: string
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.getChatSessionById(user, sessionId);
  }

  @Put(':id')
  async updateChatSession(
    @GetUser() user: users,
    @Param('id') sessionId: string,
    @Body() updateChatSessionDto: UpdateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.updateChatSession(user, sessionId, updateChatSessionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChatSession(
    @GetUser() user: users,
    @Param('id') sessionId: string
  ): Promise<void> {
    return this.chatSessionsService.deleteChatSession(user, sessionId);
  }

  @Post(':id/messages')
  async addMessagesToHistory(
    @GetUser() user: users,
    @Param('id') sessionId: string,
    @Body() addMessagesDto: AddMessagesToHistoryDto
  ): Promise<any> {
    // First, add the user messages to the session
    const updatedSession = await this.chatSessionsService.addMessagesToHistory(user, sessionId, addMessagesDto);
    
    // Check if the last message is from a user, and if so, generate an AI response
    const userMessages = addMessagesDto.messages.filter(msg => msg.role === 'user');
    
    if (userMessages.length > 0) {
      try {
        this.logger.log(`Generating AI response for session ${sessionId} after adding ${userMessages.length} user message(s)`);
        
        // Get the full conversation history
        const conversationHistory = await this.chatSessionsService.getMessages(user, sessionId);
        
        // Generate AI response using the enhanced ChatService
        const aiResponse = await this.chatService.generateCompletion(conversationHistory, {
          conversationId: sessionId,
          userId: user.id.toString(),
          enableRAG: true,
          useHistory: true,
          maxHistoryTurns: 5,
          temperature: 0.7
        });

        // Add AI response back to the session
        const assistantMessage: ChatMessageDto = {
          role: 'assistant',
          content: aiResponse.content,
          timestamp: new Date().toISOString(),
          metadata: {
            model: aiResponse.model,
            path: aiResponse.path,
            usage: aiResponse.metadata.usage,
            sourceDocuments: aiResponse.metadata.sourceDocuments,
            routing: aiResponse.metadata.routing
          }
        };

        // Add the AI response to the session
        await this.chatSessionsService.addMessagesToHistory(user, sessionId, {
          messages: [assistantMessage]
        });

        this.logger.log(`Successfully generated and added AI response for session ${sessionId}`);
        
        // Return the AI response content instead of the session object
        return {
          content: aiResponse.content,
          metadata: {
            model: aiResponse.model,
            path: aiResponse.path,
            usage: aiResponse.metadata.usage,
            sourceDocuments: aiResponse.metadata.sourceDocuments,
            routing: aiResponse.metadata.routing
          }
        };
        
      } catch (error) {
        this.logger.error(`Failed to generate AI response for session ${sessionId}: ${(error as Error).message}`, (error as Error).stack);
        
        // Return an error response instead of failing the entire request
        return {
          content: 'I apologize, but I encountered an error while processing your request. Please try again.',
          metadata: {
            error: true,
            errorMessage: (error as Error).message
          }
        };
      }
    }
    
    // If no user messages, just return the session (shouldn't happen in normal flow)
    return updatedSession;
  }

  @Get(':id/messages')
  async getMessages(
    @GetUser() user: users,
    @Param('id') sessionId: string
  ): Promise<any[]> {
    return this.chatSessionsService.getMessages(user, sessionId);
  }

  @Put(':id/history')
  async updateSessionHistory(
    @GetUser() user: users,
    @Param('id') sessionId: string,
    @Body() historyData: any,
    @Query('organization_id') organizationId?: string
  ): Promise<ChatSessionResponseDto> {
    try {
      this.logger.log(`Updating history for session ${sessionId} with organization ${organizationId || 'none'}`);
      
      // For local sessions, return a mock response
      if (sessionId.startsWith('local_')) {
        return {
          id: sessionId,
          title: 'Local Session',
          user_id: user.id?.toString(),
          organization_id: organizationId ? parseInt(organizationId) : null,
          created_at: new Date(),
          updated_at: new Date(),
          metadata: { history: historyData || [] }
        };
      }
      
      return this.chatSessionsService.updateChatSession(user, sessionId, {
        metadata: { history: historyData }
      });
    } catch (error) {
      this.logger.error(`Error updating session history for ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 