import { Module } from '@nestjs/common';
import { OpenAIService } from './services/ai/openai.service';
import { SocketService } from './services/util/socket.service';
import { ServiceRegistry } from './services/core/service-registry';

/**
 * Module that registers all injectable services
 * This automatically provides dependency injection for converted services
 */
@Module({
  providers: [
    OpenAIService,
    ServiceRegistry,
    SocketService
  ],
  exports: [
    OpenAIService,
    ServiceRegistry,
    SocketService
  ]
})
export class ServicesModule {}
  