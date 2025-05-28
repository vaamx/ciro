/**
 * Core types for the LLM abstraction layer
 */

// Basic message structure
export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

// Token usage information
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Response metadata
export interface ResponseMetadata {
  model: string;
  provider: string;
  requestId?: string;
  processingTime?: number;
  cached?: boolean;
  [key: string]: any;
}

// Tool definition for function calling
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

// Streaming response chunk
export interface StreamChunk {
  id: string;
  content: string;
  delta?: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: TokenUsage;
}

// Model capabilities
export interface LLMCapabilities {
  chat: boolean;
  embedding: boolean;
  vision: boolean;
  toolCalling: boolean;
  streaming: boolean;
  functionCalling?: boolean;
  jsonMode?: boolean;
  maxContextWindow: number;
}

// Model capability types
export type ModelCapability = 
  | 'chat'
  | 'embedding' 
  | 'vision'
  | 'tool_calling'
  | 'streaming'
  | 'function_calling'
  | 'json_mode'
  | 'advanced_reasoning'
  | 'complex_reasoning'
  | 'code_generation'
  | 'multimodal'
  | 'creative_writing';

// Task types for intelligent routing
export type TaskType = 
  | 'simple_qa'
  | 'complex_reasoning'
  | 'code_generation'
  | 'embedding'
  | 'vision'
  | 'classification'
  | 'summarization'
  | 'analysis';

// Task complexity levels
export type TaskComplexity = 'simple' | 'medium' | 'complex';

// Latency requirements
export type LatencyRequirement = 'low' | 'medium' | 'high';

// Privacy levels
export type PrivacyLevel = 'public' | 'internal' | 'confidential' | 'restricted';

// Model requirements for selection
export interface ModelRequirements {
  taskType: TaskType;
  taskComplexity: TaskComplexity;
  contextWindow: number;
  latencyRequirement: LatencyRequirement;
  privacyLevel: PrivacyLevel;
  capabilities: ModelCapability[];
  maxCost?: number; // Maximum cost per request
  preferredProvider?: string;
  policyWeights?: Record<string, number>; // Added for user-configurable policy weights
}

// Model metadata for registry
export interface ModelMetadata {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: ModelCapability[];
  pricing: {
    inputTokens: number;  // cost per 1M tokens
    outputTokens: number; // cost per 1M tokens
  };
  performance: {
    averageLatency: number; // ms
    tokensPerSecond: number;
  };
  availability: {
    regions: string[];
    status: 'available' | 'limited' | 'deprecated' | 'beta';
  };
  limits: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    tokensPerMinute?: number;
  };
}

// Model information (lighter version for API responses)
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  status: 'available' | 'limited' | 'deprecated' | 'beta';
}

// LLM options for requests
export interface LLMOptions {
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
  
  // Task-specific options for intelligent routing
  taskType?: TaskType;
  taskComplexity?: TaskComplexity;
  urgency?: LatencyRequirement;
  privacyLevel?: PrivacyLevel;
  maxCost?: number;
  policyWeights?: Record<string, number>; // Added for user-configurable policy weights
  
  // Caching options
  useCache?: boolean;
  cacheTtl?: number; // seconds
  
  // Retry options
  maxRetries?: number;
  retryDelay?: number; // ms
  
  // Metadata
  requestId?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
}

// Error types
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: string,
    public readonly model?: string,
    public readonly originalError?: Error,
    public readonly retryable?: boolean,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMProviderError extends LLMError {
  constructor(
    message: string,
    provider: string,
    originalError?: Error
  ) {
    super(message, 'PROVIDER_ERROR', provider, undefined, originalError);
    this.name = 'LLMProviderError';
  }
}

export class LLMModelError extends LLMError {
  constructor(
    message: string,
    provider: string,
    model: string,
    originalError?: Error
  ) {
    super(message, 'MODEL_ERROR', provider, model, originalError);
    this.name = 'LLMModelError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(
    message: string,
    provider: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT', provider, undefined, undefined, true, retryAfter);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMQuotaExceededError extends LLMError {
  constructor(
    message: string,
    provider: string
  ) {
    super(message, 'QUOTA_EXCEEDED', provider);
    this.name = 'LLMQuotaExceededError';
  }
} 