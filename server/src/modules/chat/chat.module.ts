import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatSessionsController } from './chat-sessions.controller';
import { ChatSessionsService } from './chat-sessions.service';
import { ChatService } from './chat.service';
import { LLMModule } from '../../services/llm/llm.module';
import { ServicesModule } from '../../services.module';
import { DualPathModule } from '../dual-path/dual-path.module';

@Module({
  imports: [
    ConfigModule,
    LLMModule,
    forwardRef(() => ServicesModule),
    forwardRef(() => DualPathModule),
  ],
  controllers: [
    ChatController,
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