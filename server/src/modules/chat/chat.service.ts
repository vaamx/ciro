import { Injectable, Logger, BadRequestException, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatSessionsService } from './chat-sessions.service';
import { ChatMessageDto } from './dto/chat-session.dto';
import { LLMService } from '../../services/llm/llm.service';
import { QueryOrchestratorService, OrchestratedRAGResponse } from '../../services/rag/query-orchestrator.service';
import { QueryRouterService } from '../../services/code-execution/query-router.service';
import { RagIntegrationService } from '../../services/rag/integration.service';
import { CodeExecutionService } from '../../services/code-execution/code-execution.service';
import { ChatMessage, LLMOptions } from '../../services/llm/types';
import { RouterDecision } from '../../types/router.types';

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useHistory?: boolean;
  maxHistoryTurns?: number;
  enableRAG?: boolean;
  dataSourceIds?: string[];
  conversationId?: string;
  userId?: string;
  systemPrompt?: string;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  path?: 'direct_rag' | 'analytical_rag' | 'llm_only';
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    finish_reason: string;
    sourceDocuments?: any[];
    artifacts?: any[];
    executionResults?: any;
    routing?: RouterDecision;
  };
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatSessionsService: ChatSessionsService,
    private readonly llmService: LLMService,
    private readonly configService: ConfigService,
    @Optional() private readonly queryOrchestratorService?: QueryOrchestratorService,
    @Optional() private readonly queryRouterService?: QueryRouterService,
    @Optional() private readonly ragIntegrationService?: RagIntegrationService,
    @Optional() private readonly codeExecutionService?: CodeExecutionService,
  ) {}

  /**
   * Generate a chat completion response using the full AI infrastructure
   */
  async generateCompletion(
    messages: ChatMessageDto[], 
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    try {
      this.logger.log(`Generating chat completion with ${messages.length} messages`);
      
      if (!messages || messages.length === 0) {
        throw new BadRequestException('No messages provided');
      }

      // Get the latest user message for processing
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.role !== 'user') {
        throw new BadRequestException('Latest message must be from user');
      }

      const query = latestMessage.content;
      
      // Convert messages to LLM format
      const llmMessages: ChatMessage[] = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }));

      // Determine if we should use RAG
      const useRAG = options.enableRAG !== false; // Default to true
      const dataSourceIds = options.dataSourceIds || this.getDefaultDataSourceIds();

      if (useRAG && dataSourceIds.length > 0 && this.queryOrchestratorService) {
        // Use the sophisticated RAG orchestrator
        return await this.generateRAGResponse(query, llmMessages, dataSourceIds, options);
      } else {
        // Fall back to direct LLM completion
        return await this.generateDirectLLMResponse(llmMessages, options);
      }
    } catch (error) {
      this.logger.error(`Error generating chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Failed to generate chat completion');
    }
  }

  /**
   * Generate response using the RAG orchestrator
   */
  private async generateRAGResponse(
    query: string,
    messages: ChatMessage[],
    dataSourceIds: string[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    this.logger.log(`Processing query through RAG orchestrator: "${query}"`);

    try {
      const orchestrationOptions = {
        conversationId: options.conversationId,
        userId: options.userId,
        dataSourceIds,
        generateFinalAnswer: true,
        useHistory: options.useHistory ?? true,
        maxHistoryTurns: options.maxHistoryTurns ?? 3,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt,
        topK: 10
      };

      const ragResponse: OrchestratedRAGResponse = await this.queryOrchestratorService!.processUserQuery(
        query,
        orchestrationOptions
      );

      // Determine which path was used based on strategy trace
      let path: 'direct_rag' | 'analytical_rag' | 'llm_only' = 'direct_rag';
      if (ragResponse.strategyTrace.some(trace => trace.includes('analytical') || trace.includes('code'))) {
        path = 'analytical_rag';
      }

      return {
        content: ragResponse.finalAnswer,
        model: options.model || this.configService.get('DEFAULT_LLM_MODEL', 'claude-3-sonnet-20240229'),
        path,
        metadata: {
          usage: {
            prompt_tokens: this.estimateTokenCount(query),
            completion_tokens: this.estimateTokenCount(ragResponse.finalAnswer),
            total_tokens: this.estimateTokenCount(query + ragResponse.finalAnswer)
          },
          finish_reason: 'stop',
          sourceDocuments: ragResponse.sourceDocuments || [],
          routing: ragResponse.queryMetadata as any
        }
      };
    } catch (error) {
      this.logger.error(`RAG orchestrator error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall back to direct LLM
      return await this.generateDirectLLMResponse(messages, options);
    }
  }

  /**
   * Generate response using direct LLM completion
   */
  private async generateDirectLLMResponse(
    messages: ChatMessage[],
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResponse> {
    this.logger.log('Processing query through direct LLM completion');
    this.logger.log(`Messages to process: ${JSON.stringify(messages, null, 2)}`);
    this.logger.log(`Options: ${JSON.stringify(options, null, 2)}`);

    const llmOptions: LLMOptions = {
      model: options.model,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4000,
      systemPrompt: options.systemPrompt
    };

    this.logger.log(`LLM Options: ${JSON.stringify(llmOptions, null, 2)}`);
    this.logger.log(`About to call llmService.generateChatCompletion...`);

    try {
      const response = await this.llmService.generateChatCompletion(messages, llmOptions);
      
      this.logger.log(`LLM Service Response: ${JSON.stringify(response, null, 2)}`);
      this.logger.log(`Response content length: ${response.content?.length || 0}`);

      const result: ChatCompletionResponse = {
        content: response.content,
        model: response.metadata?.model || llmOptions.model || 'default',
        path: 'llm_only' as const,
        metadata: {
          usage: {
            prompt_tokens: response.usage?.promptTokens || 0,
            completion_tokens: response.usage?.completionTokens || 0,
            total_tokens: response.usage?.totalTokens || 0
          },
          finish_reason: response.finishReason || 'stop'
        }
      };

      this.logger.log(`Final result: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in generateDirectLLMResponse: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Stream a chat completion response 
   */
  async streamCompletion(
    messages: ChatMessageDto[], 
    options: ChatCompletionOptions = {}
  ): Promise<any> {
    this.logger.log(`Streaming chat completion with ${messages.length} messages`);
    
    // Convert to LLM format
    const llmMessages: ChatMessage[] = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));

    const llmOptions: LLMOptions = {
      model: options.model,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4000,
      systemPrompt: options.systemPrompt
    };

    // Use the LLM service streaming capability
    return await this.llmService.streamChatCompletion(llmMessages, llmOptions);
  }

  /**
   * Get default data source IDs from configuration or database
   */
  private getDefaultDataSourceIds(): string[] {
    // This could be configured via environment variables or fetched from database
    const defaultSources = this.configService.get('DEFAULT_DATA_SOURCES', '');
    return defaultSources ? defaultSources.split(',').map(s => s.trim()) : [];
  }

  /**
   * Simple token estimation
   */
  private estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough estimation: 4 chars per token
  }
} 