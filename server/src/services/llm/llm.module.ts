/**
 * LLM Module
 * Provides all LLM-related services and abstractions
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { ModelRegistry } from './registry/model-registry.service';
import { OpenAIProvider } from './providers/openai/openai.provider';
import { AnthropicProvider } from './providers/anthropic/anthropic.provider';
import { LegacyAIAdapter } from './migration/legacy-ai-adapter.service';
import { EmbeddingService } from './embedding.service';
import { LlmAnalysisService } from './services/llm-analysis.service';
import { CacheModule } from './cache/cache.module';
import { MODEL_SELECTOR_SERVICE } from './selector/model-selector.interface';
import { ModelSelectorService } from './selector/model-selector.service';
import { MODEL_SCORER_SERVICE, ModelScorerService } from './selector/scoring/ModelScorerService';

@Global()
@Module({
  imports: [
    CacheModule,
    ConfigModule,
  ],
  providers: [
    ModelRegistry,
    OpenAIProvider,
    AnthropicProvider,
    LLMService,
    LegacyAIAdapter,
    EmbeddingService,
    LlmAnalysisService,
    {
      provide: MODEL_SELECTOR_SERVICE,
      useClass: ModelSelectorService,
    },
    {
      provide: MODEL_SCORER_SERVICE,
      useClass: ModelScorerService,
    },
  ],
  exports: [
    LLMService,
    ModelRegistry,
    OpenAIProvider,
    AnthropicProvider,
    LegacyAIAdapter,
    EmbeddingService,
    LlmAnalysisService,
    MODEL_SELECTOR_SERVICE,
  ],
})
export class LLMModule {
  constructor(
    private readonly llmService: LLMService,
    private readonly openaiProvider: OpenAIProvider,
    private readonly anthropicProvider: AnthropicProvider
  ) {}

  async onModuleInit() {
    console.log('>>> LLM_MODULE: Starting onModuleInit...');
    
    // Initialize and register providers with timeout protection
    try {
      console.log('>>> LLM_MODULE: Initializing OpenAI provider...');
      await Promise.race([
        this.openaiProvider.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI provider initialization timeout after 10 seconds')), 10000)
        )
      ]);
      console.log('>>> LLM_MODULE: OpenAI provider initialized successfully');
      
      // Register the provider with LLMService after successful initialization
      console.log('>>> LLM_MODULE: Registering OpenAI provider with LLMService...');
      this.llmService.registerProvider(this.openaiProvider);
      console.log('>>> LLM_MODULE: OpenAI provider registered successfully');
    } catch (error) {
      console.log('>>> LLM_MODULE: OpenAI provider initialization failed:', (error as Error).message);
    }
    
    try {
      console.log('>>> LLM_MODULE: Initializing Anthropic provider...');
      await Promise.race([
        this.anthropicProvider.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Anthropic provider initialization timeout after 10 seconds')), 10000)
        )
      ]);
      console.log('>>> LLM_MODULE: Anthropic provider initialized successfully');
      
      // Register the provider with LLMService after successful initialization
      console.log('>>> LLM_MODULE: Registering Anthropic provider with LLMService...');
      this.llmService.registerProvider(this.anthropicProvider);
      console.log('>>> LLM_MODULE: Anthropic provider registered successfully');
    } catch (error) {
      console.log('>>> LLM_MODULE: Anthropic provider initialization failed:', (error as Error).message);
    }
    
    console.log('>>> LLM_MODULE: onModuleInit completed');
  }
} 