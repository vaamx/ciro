/**
 * Legacy AI Adapter Service
 * Provides backward compatibility for existing AI services during migration
 */

import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../llm.service';
import { ChatMessage, LLMOptions } from '../types';

// Legacy interfaces from the old AI module
export interface LegacyChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  status: 'complete' | 'streaming' | 'error' | 'loading';
  metadata?: {
    model?: string;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    suggestions?: string[];
  };
}

export interface LegacyChatOptions {
  model?: string;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface LegacyEmbeddingOptions {
  model?: string;
  dimensions?: number;
}

@Injectable()
export class LegacyAIAdapter {
  private readonly logger = new Logger(LegacyAIAdapter.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Adapter for legacy generateChatCompletion method
   * Converts legacy format to new LLM service format
   */
  async generateChatCompletion(
    messages: LegacyChatMessage[],
    options: LegacyChatOptions = {}
  ): Promise<Response> {
    this.logger.debug('Legacy chat completion request received');

    try {
      // Convert legacy messages to new format
      const newMessages: ChatMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role === 'error' ? 'assistant' : msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp,
        metadata: msg.metadata
      }));

      // Convert legacy options to new format
      const newOptions: LLMOptions = {
        model: options.model,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt,
        stream: options.stream
      };

      // Use new LLM service
      const response = await this.llmService.generateChatCompletion(newMessages, newOptions);

      // Convert response back to legacy format
      const legacyResponse = {
        id: response.metadata.requestId || Date.now().toString(),
        role: 'assistant' as const,
        content: response.content,
        timestamp: Date.now(),
        status: 'complete' as const,
        metadata: {
          model: response.metadata.model,
          tokens: {
            prompt: response.usage?.promptTokens || 0,
            completion: response.usage?.completionTokens || 0,
            total: response.usage?.totalTokens || 0,
          }
        }
      };

      return new Response(JSON.stringify(legacyResponse), {
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      this.logger.error('Error in legacy chat completion:', error);
      
      return new Response(JSON.stringify({
        id: Date.now().toString(),
        role: 'error',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: Date.now(),
        status: 'error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Adapter for legacy createEmbeddings method
   */
  async createEmbeddings(
    query: string | string[], 
    options?: LegacyEmbeddingOptions
  ): Promise<number[][]> {
    this.logger.debug('Legacy embeddings request received');

    try {
      const response = await this.llmService.generateEmbedding(query, {
        model: options?.model,
        // Note: dimensions would need to be handled in the request types
      });

      return response.embeddings;

    } catch (error) {
      this.logger.error('Error in legacy embeddings:', error);
      throw error;
    }
  }

  /**
   * Adapter for legacy streaming response
   */
  async generateStreamingResponse(
    query: string,
    documents: any[],
    options: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
      processingStatusCallback?: (status: string) => void;
      metadataCallback?: (metadata: any) => void;
    } = {}
  ): Promise<ReadableStream> {
    this.logger.debug('Legacy streaming response request received');

    try {
      // Convert to new format
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: query,
          timestamp: Date.now()
        }
      ];

      const streamResponse = await this.llmService.streamChatCompletion(messages, {
        model: options.model,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt
      });

      // Convert the async iterable to a ReadableStream
      const encoder = new TextEncoder();
      
      return new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse.stream) {
              if (chunk.content) {
                // Format as SSE to match legacy format
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.content })}\n\n`));
              }
            }
            controller.close();
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: true, 
              message: error instanceof Error ? error.message : 'Unknown error'
            })}\n\n`));
            controller.close();
          }
        }
      });

    } catch (error) {
      this.logger.error('Error in legacy streaming response:', error);
      
      // Return error stream
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`));
          controller.close();
        }
      });
    }
  }
} 