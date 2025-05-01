import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatSessionsController } from './chat-sessions.controller';
import { ChatSessionsService } from './chat-sessions.service';
import { ChatService } from './chat.service';

@Module({
  controllers: [
    ChatController, // Declare the controller for this module
    ChatSessionsController,
  ],
  providers: [
    ChatSessionsService,
    ChatService,
  ],
  // Export services if they need to be used by other modules
  exports: [
    ChatSessionsService,
    ChatService,
  ]
})
export class ChatModule {} 