/**
 * Request and response types for LLM operations
 */

import { 
  ChatMessage, 
  TokenUsage, 
  ResponseMetadata, 
  ToolDefinition, 
  StreamChunk,
  LLMOptions 
} from './llm-types';

// Base request interface
export interface BaseLLMRequest {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// Chat completion request
export interface ChatCompletionRequest extends BaseLLMRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  jsonMode?: boolean;
}

// Embedding request
export interface EmbeddingRequest extends BaseLLMRequest {
  input: string | string[];
  model?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
}

// Base response interface
export interface BaseLLMResponse {
  requestId?: string;
  metadata: ResponseMetadata;
  usage?: TokenUsage;
}

// Chat completion response
export interface LLMResponse extends BaseLLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
}

// Streaming response
export interface StreamingLLMResponse extends BaseLLMResponse {
  stream: AsyncIterable<StreamChunk>;
}

// Embedding response
export interface EmbeddingResponse extends BaseLLMResponse {
  embeddings: number[][];
  model: string;
}

// Tool call structure
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Batch request for multiple operations
export interface BatchRequest {
  requests: (ChatCompletionRequest | EmbeddingRequest)[];
  batchId?: string;
  metadata?: Record<string, any>;
}

// Batch response
export interface BatchResponse {
  responses: (LLMResponse | EmbeddingResponse)[];
  batchId?: string;
  metadata: ResponseMetadata;
  usage: TokenUsage;
}

// Request validation result
export interface RequestValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Response validation result
export interface ResponseValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedResponse?: LLMResponse | EmbeddingResponse;
} 