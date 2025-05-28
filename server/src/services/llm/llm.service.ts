/**
 * Main LLM Service
 * Central orchestrator for all LLM operations across providers
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMProvider } from './interfaces/llm-provider.interface';
import { ModelRegistry } from './registry/model-registry.service';
import { ICacheService } from './cache/cache.interface';
import { CACHE_SERVICE } from './cache/constants';
import { InMemoryCacheService } from './cache/in-memory-cache.service';
import {
  ChatMessage,
  LLMOptions,
  ModelRequirements,
  TaskType,
  TaskComplexity,
  LatencyRequirement,
  PrivacyLevel,
  LLMError,
  LLMProviderError,
  ModelInfo,
  ModelMetadata
} from './types';
import {
  ChatCompletionRequest,
  EmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
  StreamingLLMResponse
} from './types/llm-request.types';
import { IModelSelectorService, MODEL_SELECTOR_SERVICE } from './selector/model-selector.interface';

@Injectable()
export class LLMService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LLMService.name);
  private readonly providers = new Map<string, ILLMProvider>();
  private initialized = false;

  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly configService: ConfigService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    @Inject(MODEL_SELECTOR_SERVICE) private readonly modelSelectorService: IModelSelectorService,
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.dispose();
  }

  /**
   * Initialize the LLM service
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.log('Initializing LLM Service...');
    
    // Initialize providers will be done when we create them
    // For now, we'll register them manually as we implement them
    
    this.initialized = true;
    this.logger.log('LLM Service initialized successfully');
  }

  /**
   * Cleanup resources
   */
  private async dispose(): Promise<void> {
    this.logger.log('Disposing LLM Service...');
    
    // Dispose all providers
    for (const [name, provider] of Array.from(this.providers.entries())) {
      try {
        await provider.dispose();
        this.logger.debug(`Provider ${name} disposed`);
      } catch (error) {
        this.logger.error(`Error disposing provider ${name}:`, error);
      }
    }
    
    this.providers.clear();
    if (this.cacheService.clear) {
      await this.cacheService.clear();
    }
    this.initialized = false;
    
    this.logger.log('LLM Service disposed');
  }

  /**
   * Register a provider
   */
  registerProvider(provider: ILLMProvider): void {
    this.logger.log(`Registering provider: ${provider.name}`);
    this.providers.set(provider.name, provider);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): ILLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Generate a chat completion
   */
  async generateChatCompletion(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    this.logger.debug('Generating chat completion', { 
      messageCount: messages.length,
      options: { ...options, model: options.model || 'auto' }
    });

    try {
      // 1. Analyze requirements
      const requirements = this.analyzeRequirements(messages, options);
      this.logger.debug('Analyzed requirements', requirements);

      // 2. Select model
      const selectedModel = await this.selectModel(requirements, options.model);
      this.logger.debug(`Selected model: ${selectedModel.id} from provider: ${selectedModel.provider}`);

      // 3. Check cache
      const cacheKey = this.generateCacheKey(messages, selectedModel.id, options);
      if (options.useCache !== false) {
        const cached = await this.cacheService.get<LLMResponse>(cacheKey);
        if (cached) {
          this.logger.debug('Returning cached response');
          return { ...cached, metadata: { ...cached.metadata, cached: true } };
        }
      }

      // 4. Get provider and execute
      const provider = this.getProviderForModel(selectedModel.provider);
      const request: ChatCompletionRequest = {
        messages,
        model: selectedModel.id,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stop: options.stop,
        stream: options.stream,
        tools: options.tools,
        systemPrompt: options.systemPrompt,
        requestId: options.requestId,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: {
          taskType: requirements.taskType,
          taskComplexity: requirements.taskComplexity,
          selectedModel: selectedModel.id,
          ...options.tags && { tags: options.tags }
        }
      };

      const response = await this.executeWithRetries(
        () => provider.generateChatCompletion(request),
        options,
        selectedModel.id,
        selectedModel.provider
      );
      const processingTime = response.metadata.processingTime || 0;

      // 5. Cache response
      if (options.useCache !== false) {
        const ttl = options.cacheTtl || 3600; // 1 hour default
        await this.cacheService.set(cacheKey, response, ttl);
      }

      this.logger.log(
        `Chat completion generated successfully in ${processingTime}ms using ${selectedModel.id}. Usage: P${response.usage?.promptTokens || 0}/C${response.usage?.completionTokens || 0}/T${response.usage?.totalTokens || 0} tokens.`,
        {
          requestId: request.requestId,
          sessionId: request.sessionId,
          userId: request.userId,
          model: selectedModel.id,
          provider: selectedModel.provider,
          processingTime,
          cached: false, // This log is for non-cached responses
          promptTokens: response.usage?.promptTokens,
          completionTokens: response.usage?.completionTokens,
          totalTokens: response.usage?.totalTokens,
        }
      );
      return response;

    } catch (error) {
      this.logger.error('Error generating chat completion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate a streaming chat completion
   */
  async streamChatCompletion(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<StreamingLLMResponse> {
    this.logger.debug('Generating streaming chat completion', { 
      messageCount: messages.length,
      options: { ...options, model: options.model || 'auto' }
    });

    try {
      // 1. Analyze requirements
      const requirements = this.analyzeRequirements(messages, options);

      // 2. Select model
      const selectedModel = await this.selectModel(requirements, options.model);
      this.logger.debug(`Selected model for streaming: ${selectedModel.id}`);

      // 3. Get provider and execute
      const provider = this.getProviderForModel(selectedModel.provider);
      const request: ChatCompletionRequest = {
        messages,
        model: selectedModel.id,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true,
        tools: options.tools,
        systemPrompt: options.systemPrompt,
        requestId: options.requestId,
        userId: options.userId,
        sessionId: options.sessionId
      };

      // Retries are generally more complex for streams. 
      // For now, streamChatCompletion will not use executeWithRetries.
      // A simple retry might re-request the whole stream which could be undesirable.
      // Advanced stream retry logic (e.g., resuming) is provider-specific and complex.
      return await provider.streamChatCompletion(request);

    } catch (error) {
      this.logger.error('Error generating streaming chat completion:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbedding(
    input: string | string[],
    options: LLMOptions = {}
  ): Promise<EmbeddingResponse> {
    this.logger.debug('Generating embeddings', { 
      inputType: Array.isArray(input) ? 'array' : 'string',
      inputLength: Array.isArray(input) ? input.length : input.length,
      options: { ...options, model: options.model || 'auto' }
    });

    try {
      // For embeddings, we need models with embedding capability
      const requirements: ModelRequirements = {
        taskType: 'embedding',
        taskComplexity: 'simple',
        contextWindow: this.estimateTokenCount(Array.isArray(input) ? input.join(' ') : input),
        latencyRequirement: options.urgency || 'medium',
        privacyLevel: options.privacyLevel || 'internal',
        capabilities: ['embedding']
      };

      // 2. Select model
      const selectedModel = await this.selectModel(requirements, options.model);
      this.logger.debug(`Selected embedding model: ${selectedModel.id} from provider: ${selectedModel.provider}`);

      // 3. Check cache for embeddings
      // Create a specific cache key for embeddings
      const inputText = Array.isArray(input) ? input.join('|NEXT_INPUT|') : input;
      const cacheKey = `embedding:${this.simpleHash(inputText)}:model:${selectedModel.id}:options:${this.hashOptions(options)}`;
      
      if (options.useCache !== false) {
        const cached = await this.cacheService.get<EmbeddingResponse>(cacheKey);
        if (cached) {
          this.logger.debug('Returning cached embedding response');
          return { ...cached, metadata: { ...cached.metadata, cached: true } };
        }
      }

      const provider = this.getProviderForModel(selectedModel.provider);
      const request: EmbeddingRequest = {
        input,
        model: selectedModel.id,
        requestId: options.requestId,
        userId: options.userId,
        sessionId: options.sessionId
      };

      const response = await this.executeWithRetries(
        () => provider.generateEmbedding(request),
        options,
        selectedModel.id,
        selectedModel.provider
      );
      const processingTime = response.metadata.processingTime || 0;

      // 5. Cache embedding response
      if (options.useCache !== false) {
        const ttl = options.cacheTtl || 3600 * 24; // 24 hours default for embeddings
        await this.cacheService.set(cacheKey, response, ttl);
      }

      this.logger.log(
        `Embeddings generated successfully in ${processingTime}ms using ${selectedModel.id}. Usage: P${response.usage?.promptTokens || 0}/T${response.usage?.totalTokens || 0} tokens.`,
        {
          requestId: request.requestId,
          sessionId: request.sessionId,
          userId: request.userId,
          model: selectedModel.id,
          provider: selectedModel.provider,
          processingTime,
          cached: false, // This log is for non-cached responses
          promptTokens: response.usage?.promptTokens,
          totalTokens: response.usage?.totalTokens,
        }
      );
      return response;

    } catch (error) {
      this.logger.error('Error generating embeddings:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Analyze requirements from messages and options
   */
  private analyzeRequirements(messages: ChatMessage[], options: LLMOptions): ModelRequirements {
    this.logger.debug('Analyzing requirements for LLM call.');

    // Infer task type
    const taskType = options.taskType || this.classifyTask(messages, options);

    // Assess complexity
    const taskComplexity = options.taskComplexity || this.assessComplexity(messages, options);
    
    // Determine context window (rough estimate, could be refined)
    const estimatedInputTokens = messages.reduce((sum, msg) => sum + this.estimateTokenCount(msg.content), 0);
    const contextWindow = options.maxTokens 
        ? estimatedInputTokens + options.maxTokens + 200 
        : estimatedInputTokens + 2000; 

    // Latency requirement
    const latencyRequirement = options.urgency || 'medium';

    // Privacy level
    const privacyLevel = options.privacyLevel || 'internal';
    
    // Capabilities
    const capabilities = this.inferRequiredCapabilities(messages, options);

    const requirements: ModelRequirements = {
      taskType,
      taskComplexity,
      contextWindow,
      latencyRequirement,
      privacyLevel,
      capabilities,
      maxCost: options.maxCost,
      preferredProvider: this.getPreferredProvider(options),
      policyWeights: options.policyWeights,
    };
    
    this.logger.verbose('Derived ModelRequirements:', requirements);
    return requirements;
  }

  /**
   * Select the best model for the requirements
   */
  private async selectModel(
    requirements: ModelRequirements,
    preferredModelId?: string
  ): Promise<ModelInfo | ModelMetadata> {
    this.logger.debug(
      `LLMService.selectModel called. Requirements: ${JSON.stringify(requirements)}, PreferredModelId: ${preferredModelId}`
    );

    // Use getAllModels() which returns ModelMetadata[]
    const availableModels = await this.modelRegistry.getAllModels(); 
    if (!availableModels || availableModels.length === 0) {
      this.logger.error('No models available in the registry for selection.');
      throw new LLMError('No models available in registry for selection.', 'NO_MODELS_REGISTERED');
      }
      
    this.logger.verbose(`Found ${availableModels.length} models in registry for selection.`);

    const selectedModel = await this.modelSelectorService.selectBestModel(
      availableModels,
      requirements,
      preferredModelId
    );

    if (!selectedModel) {
      this.logger.error(
        'ModelSelectorService could not select a suitable model.',
        { requirements, preferredModelId, availableModelCount: availableModels.length }
      );
      // Potential: Log selector's reasoning if available from an enhanced selector service response
      throw new LLMError('Failed to select a suitable model based on requirements.', 'MODEL_SELECTION_FAILED');
    }

    // Ensure the returned type is consistent if ModelSelectorService can return either.
    // For now, assume it returns a type compatible with what providers expect (e.g., with an `id` and `provider` field)
    this.logger.log(`LLMService.selectModel dynamically selected: ${selectedModel.id} (Provider: ${selectedModel.provider})`);
    return selectedModel;
  }

  /**
   * Get provider for a model
   */
  private getProviderForModel(providerName: string): ILLMProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new LLMProviderError(`Provider ${providerName} not available`, providerName);
    }
    return provider;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(messages: ChatMessage[], model: string, options: LLMOptions): string {
    const messageHash = this.hashMessages(messages);
    const optionsHash = this.hashOptions(options);
    return `llm:${model}:${messageHash}:${optionsHash}`;
  }

  /**
   * Classify the task type based on messages and options
   */
  private classifyTask(messages: ChatMessage[], options: LLMOptions): TaskType {
    if (options.taskType) return options.taskType;

    const content = messages.map(m => m.content).join(' ').toLowerCase();
    
    // Simple heuristic classification
    if (content.includes('code') || content.includes('program') || content.includes('function')) {
      return 'code_generation';
    }
    if (content.includes('analyze') || content.includes('complex') || content.includes('reasoning')) {
      return 'complex_reasoning';
    }
    if (content.includes('summarize') || content.includes('summary')) {
      return 'summarization';
    }
    if (content.includes('classify') || content.includes('category')) {
      return 'classification';
    }
    
    return 'simple_qa';
  }

  /**
   * Assess task complexity
   */
  private assessComplexity(messages: ChatMessage[], options: LLMOptions): TaskComplexity {
    if (options.taskComplexity) return options.taskComplexity;

    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const hasSystemPrompt = messages.some(m => m.role === 'system');
    const hasTools = options.tools && options.tools.length > 0;

    if (totalLength > 5000 || hasTools || hasSystemPrompt) {
      return 'complex';
    }
    if (totalLength > 1000) {
      return 'medium';
    }
    return 'simple';
  }

  /**
   * Infer required capabilities
   */
  private inferRequiredCapabilities(messages: ChatMessage[], options: LLMOptions): any[] {
    const capabilities = ['chat'];
    
    if (options.tools && options.tools.length > 0) {
      capabilities.push('tool_calling');
    }
    if (options.stream) {
      capabilities.push('streaming');
    }
    
    // Check for vision content (simplified)
    const hasImages = messages.some(m => 
      m.content.includes('image') || m.content.includes('picture') || m.content.includes('photo')
    );
    if (hasImages) {
      capabilities.push('vision');
    }

    return capabilities;
  }

  /**
   * Get preferred provider from options or config
   */
  private getPreferredProvider(options: LLMOptions): string | undefined {
    // Privacy-based routing
    if (options.privacyLevel === 'restricted') {
      return 'ollama';
    }
    
    // Task-based provider preferences
    if (options.taskType === 'complex_reasoning' || options.taskComplexity === 'complex') {
      return 'anthropic'; // Claude excels at complex reasoning
    }
    
    if (options.taskType === 'code_generation') {
      return 'anthropic'; // Claude 3.5 Sonnet is excellent for coding
    }
    
    return undefined; // Let intelligent selection decide
  }

  /**
   * Estimate token count (simple approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Hash messages for caching
   */
  private hashMessages(messages: ChatMessage[]): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('|');
    return this.simpleHash(content);
  }

  /**
   * Hash options for caching
   */
  private hashOptions(options: LLMOptions): string {
    const relevant = {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      systemPrompt: options.systemPrompt
    };
    return this.simpleHash(JSON.stringify(relevant));
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any): Error {
    if (error instanceof LLMError) {
      return error; // If it's already an LLMError, it might have retry info from provider
    }
    
    // Transform common errors
    // Note: Provider-specific handleError methods should ideally set retryable flags first.
    // This is a fallback.
    if (error.message?.includes('rate limit')) {
      // Attempt to parse retry-after if header was somehow passed in error details
      const retryAfterMatch = error.message.match(/retry after (\d+) seconds/i);
      const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) : undefined;
      return new LLMError('Rate limit exceeded', 'RATE_LIMIT', undefined, undefined, error, true, retryAfter);
    }
    if (error.message?.includes('quota')) {
      return new LLMError('Quota exceeded', 'QUOTA_EXCEEDED', undefined, undefined, error, false);
    }
    if (error.message?.includes('unauthorized') || error.message?.includes('invalid api key')) {
      return new LLMError('Authentication failed', 'AUTH_ERROR', undefined, undefined, error, false);
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return new LLMError('Network or timeout error', 'NETWORK_ERROR', undefined, undefined, error, true, 5); // Retry after 5s for generic network/timeout
    }
    if (error.status && error.status >= 500) { // Check for HTTP status codes indicative of server errors
        return new LLMError(`Server error: ${error.status}`, 'SERVER_ERROR', undefined, undefined, error, true, 10); // Retry after 10s
    }
    
    return new LLMError('Unknown LLM error', 'UNKNOWN_ERROR', undefined, undefined, error, false);
  }

  /**
   * Execute a provider call with retry logic
   */
  private async executeWithRetries<T>(
    action: () => Promise<T>,
    options: LLMOptions,
    modelId: string, // For logging purposes
    providerName: string // For logging purposes
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.configService.get<number>('LLM_DEFAULT_MAX_RETRIES') ?? 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        attempts++;
        this.logger.debug(`Attempt ${attempts}/${maxRetries} for model ${modelId} on provider ${providerName}`);
        return await action();
      } catch (error) {
        const llmError = this.handleError(error) as LLMError; // Ensure it's an LLMError

        this.logger.warn(
          `Attempt ${attempts}/${maxRetries} failed for ${modelId}: ${llmError.message} (Code: ${llmError.code})`,
          {
            model: modelId,
            provider: providerName,
            attempt: attempts,
            maxRetries,
            errorCode: llmError.code,
            errorMessage: llmError.message,
            retryable: llmError.retryable,
            retryAfter: llmError.retryAfterSeconds
          }
        );

        if (llmError.retryable && attempts < maxRetries) {
          const delayBase = options.retryDelay ?? this.configService.get<number>('LLM_DEFAULT_RETRY_DELAY_MS') ?? 1000;
          let delayMs = llmError.retryAfterSeconds 
            ? llmError.retryAfterSeconds * 1000 
            : delayBase * Math.pow(2, attempts -1); // Exponential backoff
          
          // Add jitter to avoid thundering herd
          delayMs = delayMs * (0.8 + Math.random() * 0.4); // +/- 20% jitter
          delayMs = Math.min(delayMs, 30000); // Cap delay at 30 seconds

          this.logger.log(`Retrying in ${Math.round(delayMs / 1000)}s... (Attempt ${attempts + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(
            `Final attempt failed or error not retryable for ${modelId}: ${llmError.message}`,
            {
              model: modelId,
              provider: providerName,
              finalAttempt: attempts,
              errorCode: llmError.code,
              errorMessage: llmError.message
            }
          );
          throw llmError; // Rethrow the original (or wrapped) error
        }
      }
    }
    // Should not be reached if maxRetries > 0, but as a fallback:
    throw new LLMError(`Max retries (${maxRetries}) reached for ${modelId}`, 'MAX_RETRIES_EXCEEDED', providerName, modelId);
  }
} 