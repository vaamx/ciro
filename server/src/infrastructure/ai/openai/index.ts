export * from './config';
export * from './errors';
export * from './base-service';
export * from './chat-service';
export * from './embeddings-service';

// Factory function to create services with shared configuration
import { OpenAIConfig } from './config';
import { ChatService } from './chat-service';
import { EmbeddingsService } from './embeddings-service';

export interface OpenAIServices {
  chat: ChatService;
  embeddings: EmbeddingsService;
}

export function createOpenAIServices(config: OpenAIConfig): OpenAIServices {
  return {
    chat: new ChatService(config),
    embeddings: new EmbeddingsService(config),
  };
} 