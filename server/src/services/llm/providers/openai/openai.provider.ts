/**
 * OpenAI Provider Implementation
 * Wraps OpenAI API calls to implement the unified LLM provider interface
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
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
export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  readonly capabilities: LLMCapabilities = {
    chat: true,
    embedding: true,
    vision: true,
    toolCalling: true,
    streaming: true,
    functionCalling: true,
    jsonMode: true,
    maxContextWindow: 128000
  };

  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.client = new OpenAI({
      apiKey: this.apiKey,
      organization: this.configService.get<string>('OPENAI_ORG_ID'),
    });
  }

  async initialize(): Promise<void> {
    this.logger.log('Initializing OpenAI provider...');
    
    // Check if API key is available
    if (!this.apiKey || this.apiKey.trim() === '') {
      this.logger.warn('OpenAI API key not provided - provider will be unavailable');
      return;
    }
    
    // Temporarily disable the connection test to see if it's causing the hang
    this.logger.log('OpenAI provider initialized successfully (connection test disabled)');
    return;
    
    // Test the connection
    try {
      await (this.client as any).models.list();
      this.logger.log('OpenAI provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI provider:', error);
      throw new LLMProviderError('Failed to initialize OpenAI provider', this.name, error as Error);
    }
  }

  async dispose(): Promise<void> {
    this.logger.log('Disposing OpenAI provider...');
    // OpenAI client doesn't need explicit cleanup
  }

  async generateChatCompletion(request: ChatCompletionRequest): Promise<LLMResponse> {
    this.logger.debug(`Generating chat completion with model: ${request.model}`);
    
    try {
      // Convert unified messages to OpenAI format
      const messages: ChatCompletionMessageParam[] = this.convertMessages(request.messages);
      
      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }

      const startTime = Date.now();
      const completion = await (this.client.chat.completions.create as any)({
        model: request.model || 'gpt-4o-mini',
        messages,
        ...((request.model?.startsWith('o3') || request.model?.startsWith('o4-mini')) && request.temperature === 0.7 
            ? {} 
            : { temperature: request.temperature }),
        ...( (request.model?.startsWith('o3') || request.model?.startsWith('o4-mini')) && request.maxTokens
            ? { max_completion_tokens: request.maxTokens } 
            : { max_tokens: request.maxTokens }),
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined,
      });

      const processingTime = Date.now() - startTime;

      return {
        content: (completion as any).choices[0]?.message?.content || '',
        finishReason: this.mapFinishReason((completion as any).choices[0]?.finish_reason),
        toolCalls: (completion as any).choices[0]?.message?.tool_calls ? 
          this.convertToolCalls((completion as any).choices[0].message.tool_calls) : undefined,
        requestId: request.requestId,
        metadata: {
          model: (completion as any).model,
          provider: this.name,
          requestId: (completion as any).id,
          processingTime,
          cached: false
        },
        usage: {
          promptTokens: (completion as any).usage?.prompt_tokens || 0,
          completionTokens: (completion as any).usage?.completion_tokens || 0,
          totalTokens: (completion as any).usage?.total_tokens || 0
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
      const messages: ChatCompletionMessageParam[] = this.convertMessages(request.messages);
      
      if (request.systemPrompt) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }

      const stream = await (this.client.chat.completions.create as any)({
        model: request.model || 'gpt-4o-mini',
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
      });

      return {
        stream: this.createStreamIterator(stream),
        requestId: request.requestId,
        metadata: {
          model: request.model || 'gpt-4o-mini',
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
    this.logger.debug(`Generating embeddings with model: ${request.model}`);
    
    try {
      const input = Array.isArray(request.input) ? request.input : [request.input];
      
      const startTime = Date.now();
      const response = await (this.client.embeddings.create as any)({
        model: request.model || 'text-embedding-3-small',
        input,
        dimensions: request.dimensions,
        encoding_format: request.encodingFormat,
      });
      
      const processingTime = Date.now() - startTime;

      return {
        embeddings: (response as any).data.map((item: any) => item.embedding),
        model: (response as any).model,
        requestId: request.requestId,
        metadata: {
          model: (response as any).model,
          provider: this.name,
          processingTime,
          cached: false
        },
        usage: {
          promptTokens: (response as any).usage?.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: (response as any).usage?.total_tokens || 0
        }
      };

    } catch (error) {
      this.logger.error('Error generating embeddings:', error);
      throw this.handleError(error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await (this.client as any).models.list();
      return true;
    } catch (error) {
      this.logger.warn('OpenAI provider availability check failed:', error);
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const models = await (this.client as any).models.list();
      return (models as any).data
        .filter((model: any) => model.id.includes('gpt') || model.id.includes('text-embedding'))
        .map((model: any) => ({
          id: model.id,
          name: model.id,
          provider: this.name,
          capabilities: this.inferCapabilities(model.id),
          contextWindow: this.getContextWindow(model.id),
          status: 'available' as const
        }));
    } catch (error) {
      this.logger.error('Error fetching models:', error);
      throw this.handleError(error);
    }
  }

  async getModelMetadata(modelId: string): Promise<ModelMetadata | null> {
    // This would typically come from a registry or API
    // For now, return null as we use the ModelRegistry for this
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
      
      if (request.maxTokens && request.maxTokens > 4096) {
        warnings.push('Max tokens exceeds recommended limit for most models');
      }
    } else {
      // Embedding validation
      if (!request.input) {
        errors.push('Input is required for embedding requests');
      }
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
    // OpenAI doesn't provide usage info via API
    // This would need to be tracked separately
    return {};
  }

  async processBatch?(request: BatchRequest): Promise<BatchResponse> {
    // OpenAI has batch API but it's complex to implement
    // For now, process requests sequentially
    this.logger.debug(`Processing batch of ${request.requests.length} requests`);
    
    const responses: (LLMResponse | EmbeddingResponse)[] = [];
    let totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
    
    const startTime = Date.now();
    
    for (const req of request.requests) {
      try {
        let result: LLMResponse | EmbeddingResponse;
        
        if ('messages' in req) {
          // Chat completion request
          result = await this.generateChatCompletion(req);
        } else {
          // Embedding request
          result = await this.generateEmbedding(req);
        }
        
        responses.push(result);
        
        // Accumulate usage
        if (result.usage) {
          totalUsage.promptTokens += result.usage.promptTokens;
          totalUsage.completionTokens += result.usage.completionTokens;
          totalUsage.totalTokens += result.usage.totalTokens;
        }
      } catch (error) {
        this.logger.error(`Error processing batch request:`, error);
        // For now, we'll throw on any error. In production, might want to continue with partial results
        throw this.handleError(error);
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      responses,
      batchId: request.batchId,
      metadata: {
        model: 'batch',
        provider: this.name,
        processingTime,
        cached: false
      },
      usage: totalUsage
    };
  }

  // Helper methods

  private convertMessages(messages: any[]): ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: msg.role === 'error' ? 'assistant' : msg.role,
      content: msg.content
    }));
  }

  private convertTools(tools: any[]): any[] {
    return tools.map(tool => ({
      type: tool.type,
      function: tool.function
    }));
  }

  private convertToolCalls(toolCalls: any[]): any[] {
    return toolCalls.map(call => ({
      id: call.id,
      type: call.type,
      function: {
        name: call.function.name,
        arguments: call.function.arguments
      }
    }));
  }

  private mapFinishReason(reason: string | null | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }

  private async* createStreamIterator(stream: any): AsyncIterable<StreamChunk> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield {
          id: chunk.id,
          content: delta.content,
          delta: delta.content,
          finishReason: chunk.choices[0]?.finish_reason ? 
            this.mapFinishReason(chunk.choices[0].finish_reason) : undefined
        };
      }
    }
  }

  private inferCapabilities(modelId: string): any[] {
    const capabilities = ['chat'];
    
    if (modelId.includes('gpt-4')) {
      capabilities.push('vision', 'tool_calling', 'advanced_reasoning');
    }
    if (modelId.includes('embedding')) {
      return ['embedding'];
    }
    if (modelId.includes('o1')) {
      capabilities.push('advanced_reasoning', 'complex_reasoning');
    }
    
    return capabilities;
  }

  private getContextWindow(modelId: string): number {
    if (modelId.includes('gpt-4') || modelId.includes('o1')) {
      return 128000;
    }
    if (modelId.includes('gpt-3.5')) {
      return 16385;
    }
    if (modelId.includes('embedding')) {
      return 8191;
    }
    return 4096;
  }

  private handleError(error: any): Error {
    this.logger.warn(`OpenAI API Error: ${error.message}`, error);

    // Check for specific OpenAI error types if available, otherwise rely on status codes
    // This structure assumes error is an object with status, message, and potentially headers

    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      const retryAfterHeader = error.headers?.['retry-after']; // Standard HTTP header
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
      return new LLMRateLimitError(
        error.message || 'OpenAI rate limit exceeded',
        this.name,
        retryAfterSeconds
      ); // LLMRateLimitError is intrinsically retryable
    }
    
    if (error.status === 401 || error.code === 'authentication_error') {
      return new LLMError(error.message || 'OpenAI authentication failed', 'AUTH_ERROR', this.name, undefined, error, false);
    }
    
    if (error.status === 403 || error.code === 'permission_denied') {
        return new LLMError(error.message || 'OpenAI permission denied', 'FORBIDDEN_ERROR', this.name, undefined, error, false);
    }

    if (error.status === 400 || error.code === 'invalid_request_error' || error.code === 'invalid_api_key') {
        return new LLMError(error.message || 'OpenAI invalid request or API key', 'INVALID_REQUEST_ERROR', this.name, undefined, error, false);
    }

    if (error.status >= 500) {
      return new LLMError(error.message || 'OpenAI server error', 'SERVER_ERROR', this.name, undefined, error, true, 15); // Retry after 15s
    }

    if (error.code === 'ETIMEDOUT' || error.message?.toLowerCase().includes('timeout')) {
      return new LLMError(error.message || 'OpenAI request timed out', 'TIMEOUT_ERROR', this.name, undefined, error, true, 10); // Retry after 10s
    }
    
    // Fallback for other OpenAI errors or non-HTTP errors from the SDK
    const message = error.message || 'Unknown OpenAI error';
    return new LLMProviderError(message, this.name, error); // LLMProviderError is not retryable by default unless specified in LLMService.handleError
  }
} 