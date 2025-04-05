/**
 * AI model types and interfaces
 */

// Example model interfaces
export interface AIModel {
  name: string;
  provider: string;
  version?: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface CompletionModel extends AIModel {
  type: 'completion';
}

export interface EmbeddingModel extends AIModel {
  type: 'embedding';
  dimensions: number;
}

// Default models
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = {
  name: 'text-embedding-ada-002',
  provider: 'openai',
  type: 'embedding',
  dimensions: 1536
};

export const DEFAULT_COMPLETION_MODEL: CompletionModel = {
  name: 'gpt-3.5-turbo',
  provider: 'openai',
  type: 'completion',
  maxTokens: 4096
};

// Export model definitions
export * from './model-definitions'; 