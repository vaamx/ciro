/**
 * Anthropic Provider Implementation
 * Wraps Anthropic API calls to implement the unified LLM provider interface
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider } from '../../interfaces/llm-provider.interface';
import {
  ChatCompletionRequest,
  EmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
  StreamingLLMResponse,
  BatchRequest,
  BatchResponse
} from '../../types/llm-request.types';
import {
  LLMCapabilities,
  ModelInfo,
  ModelMetadata,
  LLMError,
  LLMProviderError,
  LLMRateLimitError,
  StreamChunk
} from '../../types/llm-types';

@Injectable()
export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly capabilities: LLMCapabilities = {
    chat: true,
    embedding: false, // Anthropic doesn't provide embedding models
    vision: true,
    toolCalling: true,
    streaming: true,
    functionCalling: true,
    jsonMode: false, // Claude doesn't have explicit JSON mode
    maxContextWindow: 200000 // Claude 3.5 Sonnet has 200k context
  };

  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || '';
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  async initialize(): Promise<void> {
    this.logger.log('Initializing Anthropic provider...');
    
    // Check if API key is available
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.warn('Anthropic API key not provided - provider will be unavailable');
      return;
    }
    
    // Test the connection by making a simple request
    try {
      // Claude doesn't have a models.list endpoint, so we'll just validate the key format
      if (!this.apiKey.startsWith('sk-ant-')) {
        throw new Error('Invalid Anthropic API key format');
      }
      this.logger.log('Anthropic provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Anthropic provider:', error);
      throw new LLMProviderError('Failed to initialize Anthropic provider', this.name, error as Error);
    }
  }

  async generateChatCompletion(request: ChatCompletionRequest): Promise<LLMResponse> {
    this.logger.debug(`Generating chat completion with model: ${request.model}`);
    
    try {
      // Convert unified messages to Anthropic format
      const messages = this.convertMessages(request.messages);
      
      // Extract system prompt if provided
      let systemPrompt = request.systemPrompt;
      if (!systemPrompt && request.messages[0]?.role === 'system') {
        systemPrompt = request.messages[0].content;
        messages.shift(); // Remove system message from conversation
      }

      const startTime = Date.now();
      const completion = await this.client.messages.create({
        model: request.model || 'claude-3-5-sonnet-20241022',
        messages,
        system: systemPrompt,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
      });

      const processingTime = Date.now() - startTime;

      return {
        content: this.extractContent(completion.content),
        finishReason: this.mapFinishReason(completion.stop_reason),
        toolCalls: this.extractToolCalls(completion.content),
        requestId: request.requestId,
        metadata: {
          model: completion.model,
          provider: this.name,
          requestId: completion.id,
          processingTime,
          cached: false
        },
        usage: {
          promptTokens: completion.usage.input_tokens,
          completionTokens: completion.usage.output_tokens,
          totalTokens: completion.usage.input_tokens + completion.usage.output_tokens
        }
      };

    } catch (error) {
      this.logger.error('Error generating chat completion:', error);
      throw this.handleError(error);
    }
  }

  async streamChatCompletion(request: ChatCompletionRequest): Promise<StreamingLLMResponse> {
    this.logger.debug(`Generating streaming chat completion with model: ${request.model}`);
    
    try {
      const messages = this.convertMessages(request.messages);
      
      let systemPrompt = request.systemPrompt;
      if (!systemPrompt && request.messages[0]?.role === 'system') {
        systemPrompt = request.messages[0].content;
        messages.shift();
      }

      const stream = await this.client.messages.create({
        model: request.model || 'claude-3-5-sonnet-20241022',
        messages,
        system: systemPrompt,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        stream: true,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
      });

      return {
        stream: this.createStreamIterator(stream),
        requestId: request.requestId,
        metadata: {
          model: request.model || 'claude-3-5-sonnet-20241022',
          provider: this.name,
          cached: false
        }
      };

    } catch (error) {
      this.logger.error('Error generating streaming chat completion:', error);
      throw this.handleError(error);
    }
  }

  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic doesn't provide embedding models
    throw new LLMProviderError('Anthropic does not support embedding generation', this.name);
  }

  async processBatch(request: BatchRequest): Promise<BatchResponse> {
    // Anthropic doesn't have a native batch API yet
    throw new LLMProviderError('Anthropic does not support batch processing', this.name);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return false;
    }
    
    try {
      // Simple test - validate API key format
      return this.apiKey.startsWith('sk-ant-');
    } catch (error) {
      this.logger.error('Error checking Anthropic availability:', error);
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models.list endpoint, so we return known models
    const knownModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];

    return knownModels.map(modelId => ({
      id: modelId,
      name: modelId,
      provider: this.name,
      capabilities: this.inferCapabilities(modelId),
      contextWindow: this.getContextWindow(modelId),
      status: 'available' as const
    }));
  }

  async getModelMetadata(modelId: string): Promise<ModelMetadata | null> {
    // This would typically come from a registry or API
    return null;
  }

  async validateRequest(request: ChatCompletionRequest | EmbeddingRequest): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if ('messages' in request) {
      // Chat completion validation
      if (!request.messages || request.messages.length === 0) {
        errors.push('Messages array cannot be empty');
      }

      if (request.maxTokens && request.maxTokens > 8192) {
        warnings.push('Max tokens exceeds recommended limit of 8192');
      }
    } else {
      // Embedding validation - not supported
      errors.push('Anthropic does not support embedding generation');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getUsageInfo(): Promise<{
    requestsRemaining?: number;
    tokensRemaining?: number;
    resetTime?: Date;
  }> {
    // Anthropic doesn't provide usage info via API
    return {};
  }

  async dispose(): Promise<void> {
    // No cleanup needed for Anthropic client
    this.logger.log('Anthropic provider disposed');
  }

  // Private helper methods
  private convertMessages(messages: any[]): any[] {
    return messages
      .filter(msg => msg.role !== 'system') // System messages handled separately
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : this.convertContent(msg.content)
      }));
  }

  private convertContent(content: any): any {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      return content.map(item => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        }
        if (item.type === 'image_url') {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: item.image_url.url.split(',')[1] // Remove data:image/jpeg;base64, prefix
            }
          };
        }
        return item;
      });
    }
    
    return content;
  }

  private convertTools(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }

  private extractContent(content: any[]): string {
    const textBlocks = content.filter(block => block.type === 'text');
    return textBlocks.map(block => block.text).join('\n');
  }

  private extractToolCalls(content: any[]): any[] | undefined {
    const toolBlocks = content.filter(block => block.type === 'tool_use');
    if (toolBlocks.length === 0) return undefined;

    return toolBlocks.map(block => ({
      id: block.id,
      type: 'function',
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input)
      }
    }));
  }

  private mapFinishReason(stopReason: string | null): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  private async *createStreamIterator(stream: any): AsyncIterable<StreamChunk> {
    try {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield {
            id: chunk.id || 'chunk',
            content: chunk.delta.text,
            delta: chunk.delta.text,
            finishReason: undefined,
            usage: undefined
          };
        } else if (chunk.type === 'message_stop') {
          yield {
            id: 'final',
            content: '',
            finishReason: 'stop',
            usage: chunk.usage ? {
              promptTokens: chunk.usage.input_tokens,
              completionTokens: chunk.usage.output_tokens,
              totalTokens: chunk.usage.input_tokens + chunk.usage.output_tokens
            } : undefined
          };
        }
      }
    } catch (error) {
      this.logger.error('Error in stream iterator:', error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): LLMError {
    this.logger.warn(`Anthropic API Error: ${error.message}`, error);

    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const message = error.message || 'Anthropic API Error';

      if (status === 429) { // Rate limit
        let retryAfterSeconds: number | undefined = undefined;
        if (error.headers?.['retry-after']) {
          retryAfterSeconds = parseInt(error.headers['retry-after'], 10);
        } else if (error.headers?.['retry-after-seconds']) {
          retryAfterSeconds = parseInt(error.headers['retry-after-seconds'], 10);
        }
        // Check if the error object itself has a retry_after_ms or similar if headers aren't standard
        // For example, if error.error?.data?.retry_after_ms exists
        // For now, relying on common headers.
        return new LLMRateLimitError(message, this.name, retryAfterSeconds);
      }
      if (status === 401) { // Auth error
        return new LLMError(message, 'AUTH_ERROR', this.name, undefined, error, false);
      }
      if (status === 403) { // Permission error
        return new LLMError(message, 'FORBIDDEN_ERROR', this.name, undefined, error, false);
      }
      if (status === 400) { // Bad request
        return new LLMError(message, 'INVALID_REQUEST_ERROR', this.name, undefined, error, false);
      }
      if (status >= 500) { // Server error
        return new LLMError(message, 'SERVER_ERROR', this.name, undefined, error, true, 20);
      }
      // Fallback for other Anthropic.APIError subtypes
      return new LLMProviderError(message, this.name, error);
    }

    // Handle non-APIError cases
    if (error.code === 'ETIMEDOUT' || error.message?.toLowerCase().includes('timeout')) {
      return new LLMError(error.message || 'Request timed out', 'TIMEOUT_ERROR', this.name, undefined, error, true, 10);
    }
    
    const defaultMessage = error.message || 'Unknown Anthropic error';
    return new LLMProviderError(defaultMessage, this.name, error);
  }

  private inferCapabilities(modelId: string): any[] {
    const capabilities = ['chat', 'streaming'];
    
    if (modelId.includes('claude-3')) {
      capabilities.push('vision', 'tool_calling', 'advanced_reasoning');
    }
    
    if (modelId.includes('opus')) {
      capabilities.push('complex_reasoning', 'creative_writing');
    }
    
    return capabilities;
  }

  private getContextWindow(modelId: string): number {
    if (modelId.includes('claude-3-5')) {
      return 200000; // Claude 3.5 models have 200k context
    }
    if (modelId.includes('claude-3')) {
      return 200000; // Claude 3 models have 200k context
    }
    return 100000; // Default fallback
  }
} 