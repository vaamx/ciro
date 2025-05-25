import { 
    Controller, 
    Get, 
    Post, 
    Param, 
    Body, 
    Request, 
    UseGuards, 
    HttpCode, 
    HttpStatus, 
    NotFoundException, 
    BadRequestException, 
    ForbiddenException,
    Logger
} from '@nestjs/common';
import { db } from '../../config/database'; // Will be replaced with proper service
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GetUser } from '../../core/auth/get-user.decorator';
import { User } from '../../core/database/prisma-types'; // Updated to use Prisma types
import { CreateConversationDto, SendMessageDto, ConversationResponseDto, MessageResponseDto } from './dto/conversation.dto';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-session.dto';

@Controller('api/chat/conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);
  
  constructor(private readonly chatService: ChatService) {}
  
  // Add chat completion endpoints
  
  @Post('/completion')
  @HttpCode(HttpStatus.OK)
  async chatCompletion(
    @GetUser() user: User,
    @Body() body: { messages: ChatMessageDto[], model?: string, temperature?: number }
  ): Promise<any> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      throw new BadRequestException('No messages provided');
    }

    try {
      const result = await this.chatService.generateCompletion(body.messages, {
        model: body.model,
        temperature: body.temperature
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error generating chat completion for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  @Get()
  async getConversations(
    @GetUser() user: User
  ): Promise<ConversationResponseDto[]> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      const conversations = await db('conversations')
        .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
        .where('conversation_participants.user_id', user.id)
        .select('conversations.*')
        .orderBy('conversations.updated_at', 'desc');
      
      return conversations;
    } catch (error) {
      this.logger.error(`Error getting conversations for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @GetUser() user: User,
    @Body() createConversationDto: CreateConversationDto
  ): Promise<ConversationResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const { title, participants } = createConversationDto;

    try {
      // Define the variable that will hold our result
      let newConversation: ConversationResponseDto | undefined;
      
      // Start a transaction
      await db.transaction(async (trx) => {
        // Create conversation
        const result = await trx('conversations')
          .insert({
            title,
            created_by: user.id
          })
          .returning('*');
        
        newConversation = result[0];

        // Add participants (including the creator)
        const participantIds = [...new Set([...participants, user.id])]; // Ensure unique IDs
        const participantRecords = participantIds.map(pId => ({
          conversation_id: newConversation!.id,
          user_id: pId
        }));

        await trx('conversation_participants').insert(participantRecords);
      });
      
      // Check if we got a conversation back
      if (!newConversation) {
        throw new Error('Failed to create conversation');
      }
      
      return newConversation;
    } catch (error) {
      this.logger.error(`Error creating conversation for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @Get(':id')
  async getConversationById(
    @GetUser() user: User, 
    @Param('id') conversationId: string
  ): Promise<ConversationResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    if (!conversationId) {
      throw new BadRequestException('Conversation ID is required');
    }

    try {
      // Don't handle requests for the "sessions" path - this should go to ChatSessionsController
      if (conversationId === 'sessions') {
        throw new NotFoundException('Route not found');
      }

      const conversation = await db('conversations')
        .join('conversation_participants', 'conversations.id', 'conversation_participants.conversation_id')
        .where({
          'conversations.id': conversationId,
          'conversation_participants.user_id': user.id
        })
        .select('conversations.*')
        .first();

      if (!conversation) {
        throw new NotFoundException('Conversation not found or access denied');
      }
      
      return conversation;
    } catch (error) {
      this.logger.error(`Error fetching conversation ${conversationId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  @Get(':id/messages')
  async getMessages(
    @GetUser() user: User, 
    @Param('id') conversationId: string
  ): Promise<MessageResponseDto[]> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    try {
      // Check if user is participant
      const isParticipant = await db('conversation_participants')
        .where({ 
          conversation_id: conversationId, 
          user_id: user.id 
        })
        .first();

      if (!isParticipant) {
        throw new ForbiddenException('Access denied');
      }

      const messages = await db('messages')
        .where('conversation_id', conversationId)
        .orderBy('created_at', 'asc');

      return messages;
    } catch (error) {
      this.logger.error(`Error fetching messages for conversation ${conversationId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw error;
    }
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @GetUser() user: User, 
    @Param('id') conversationId: string, 
    @Body() sendMessageDto: SendMessageDto
  ): Promise<MessageResponseDto> {
    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }
    
    const { content } = sendMessageDto;

    try {
      // Check if user is participant
      const isParticipant = await db('conversation_participants')
        .where({ 
          conversation_id: conversationId, 
          user_id: user.id 
        })
        .first();

      if (!isParticipant) {
        throw new ForbiddenException('Access denied');
      }

      // Create the message
      const [message] = await db('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          created_at: db.fn.now()
        })
        .returning('*');
      
      // Update the conversation's last activity
      await db('conversations')
        .where('id', conversationId)
        .update({
          updated_at: db.fn.now()
        });
      
      return message;
    } catch (error) {
      this.logger.error(`Error sending message to conversation ${conversationId} for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 