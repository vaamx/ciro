/**
 * Core interface that all LLM providers must implement
 */

import {
  ChatCompletionRequest,
  EmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
  StreamingLLMResponse,
  BatchRequest,
  BatchResponse
} from '../types/llm-request.types';

import {
  LLMCapabilities,
  ModelInfo,
  ModelMetadata
} from '../types/llm-types';

/**
 * Main interface for LLM providers
 */
export interface ILLMProvider {
  /**
   * Provider name (e.g., 'openai', 'anthropic', 'google', 'ollama')
   */
  readonly name: string;

  /**
   * Provider capabilities
   */
  readonly capabilities: LLMCapabilities;

  /**
   * Generate a chat completion
   */
  generateChatCompletion(request: ChatCompletionRequest): Promise<LLMResponse>;

  /**
   * Generate a streaming chat completion
   */
  streamChatCompletion(request: ChatCompletionRequest): Promise<StreamingLLMResponse>;

  /**
   * Generate embeddings
   */
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Process batch requests
   */
  processBatch?(request: BatchRequest): Promise<BatchResponse>;

  /**
   * Check if the provider is available and healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get list of available models
   */
  getModels(): Promise<ModelInfo[]>;

  /**
   * Get detailed metadata for a specific model
   */
  getModelMetadata(modelId: string): Promise<ModelMetadata | null>;

  /**
   * Validate a request before processing
   */
  validateRequest(request: ChatCompletionRequest | EmbeddingRequest): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  /**
   * Get current usage/quota information
   */
  getUsageInfo?(): Promise<{
    requestsRemaining?: number;
    tokensRemaining?: number;
    resetTime?: Date;
  }>;

  /**
   * Initialize the provider (setup connections, validate credentials, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultModel?: string;
  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  customHeaders?: Record<string, string>;
  metadata?: Record<string, any>;
}

/**
 * Provider factory interface for creating provider instances
 */
export interface IProviderFactory {
  createProvider(config: ProviderConfig): Promise<ILLMProvider>;
  getSupportedProviders(): string[];
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  responseTime?: number;
  errorRate?: number;
  details?: Record<string, any>;
}

/**
 * Provider metrics
 */
export interface ProviderMetrics {
  provider: string;
  model?: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  totalTokens: number;
  totalCost: number;
  timeWindow: {
    start: Date;
    end: Date;
  };
} 