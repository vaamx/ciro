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
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types'; // Placeholder path
import {
  CreateChatSessionDto,
  UpdateChatSessionDto,
  AddMessagesToHistoryDto,
  ChatSessionResponseDto
} from './dto/chat-session.dto';

@Controller('api/chat/sessions')
@UseGuards(JwtAuthGuard)
export class ChatSessionsController {
  private readonly logger = new Logger(ChatSessionsController.name);

  constructor(private readonly chatSessionsService: ChatSessionsService) {}

  @Get()
  async getChatSessions(
    @GetUser() user: User,
    @Query('organization_id') organizationId?: string,
    @Query('dashboard_id') dashboardId?: string
  ): Promise<ChatSessionResponseDto[]> {
    return this.chatSessionsService.getChatSessions(user, organizationId, dashboardId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createChatSession(
    @GetUser() user: User,
    @Body() createChatSessionDto: CreateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.createChatSession(user, createChatSessionDto);
  }

  @Get(':id')
  async getChatSessionById(
    @GetUser() user: User,
    @Param('id') sessionId: string
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.getChatSessionById(user, sessionId);
  }

  @Put(':id')
  async updateChatSession(
    @GetUser() user: User,
    @Param('id') sessionId: string,
    @Body() updateChatSessionDto: UpdateChatSessionDto
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.updateChatSession(user, sessionId, updateChatSessionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChatSession(
    @GetUser() user: User,
    @Param('id') sessionId: string
  ): Promise<void> {
    return this.chatSessionsService.deleteChatSession(user, sessionId);
  }

  @Post(':id/messages')
  async addMessagesToHistory(
    @GetUser() user: User,
    @Param('id') sessionId: string,
    @Body() addMessagesDto: AddMessagesToHistoryDto
  ): Promise<ChatSessionResponseDto> {
    return this.chatSessionsService.addMessagesToHistory(user, sessionId, addMessagesDto);
  }

  @Get(':id/messages')
  async getMessages(
    @GetUser() user: User,
    @Param('id') sessionId: string
  ): Promise<any[]> {
    return this.chatSessionsService.getMessages(user, sessionId);
  }

  @Put(':id/history')
  async updateSessionHistory(
    @GetUser() user: User,
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