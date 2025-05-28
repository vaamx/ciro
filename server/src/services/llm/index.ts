/**
 * LLM Service Exports
 */

// Main service
export { LLMService } from './llm.service';
export { LLMModule } from './llm.module';

// Registry
export { ModelRegistry } from './registry/model-registry.service';

// Providers
export { OpenAIProvider } from './providers/openai/openai.provider';
export { AnthropicProvider } from './providers/anthropic/anthropic.provider';

// Services
export { EmbeddingService } from './embedding.service';

// Migration
export { LegacyAIAdapter } from './migration/legacy-ai-adapter.service';

// Interfaces
export * from './interfaces/llm-provider.interface';

// Types
export * from './types';

// Re-export commonly used types for convenience
export type {
  ChatMessage,
  LLMOptions,
  LLMResponse,
  EmbeddingResponse,
  ModelMetadata,
  ModelRequirements,
  TaskType,
  TaskComplexity,
  ModelCapability
} from './types'; 