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
    // Initialize and register providers
    await this.openaiProvider.initialize();
    await this.anthropicProvider.initialize();
    
    this.llmService.registerProvider(this.openaiProvider);
    this.llmService.registerProvider(this.anthropicProvider);
  }
} 