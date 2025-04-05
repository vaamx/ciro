/**
 * AI model definitions
 */

// Define the types locally to avoid circular dependencies
type AIModelType = 'completion' | 'embedding';

interface AIModelBase {
  name: string;
  provider: string;
  type: AIModelType;
  version?: string;
  contextWindow?: number;
  maxTokens?: number;
}

interface CompletionModelType extends AIModelBase {
  type: 'completion';
}

interface EmbeddingModelType extends AIModelBase {
  type: 'embedding';
  dimensions: number;
}

// OpenAI Models
export const OPENAI_MODELS = {
  // Embedding models
  EMBEDDING_ADA_002: {
    name: 'text-embedding-ada-002',
    provider: 'openai',
    type: 'embedding' as const,
    dimensions: 1536,
    maxTokens: 8191
  },
  
  // Completion models
  GPT_3_5_TURBO: {
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    type: 'completion' as const,
    maxTokens: 4096,
    contextWindow: 4096
  },
  GPT_4: {
    name: 'gpt-4',
    provider: 'openai',
    type: 'completion' as const,
    maxTokens: 8192,
    contextWindow: 8192
  },
  GPT_4_TURBO: {
    name: 'gpt-4-turbo-preview',
    provider: 'openai',
    type: 'completion' as const,
    maxTokens: 128000,
    contextWindow: 128000
  }
};

// Anthropic Models
export const ANTHROPIC_MODELS = {
  CLAUDE_2: {
    name: 'claude-2',
    provider: 'anthropic',
    type: 'completion' as const,
    maxTokens: 100000,
    contextWindow: 100000
  },
  CLAUDE_INSTANT: {
    name: 'claude-instant-1',
    provider: 'anthropic',
    type: 'completion' as const,
    maxTokens: 100000,
    contextWindow: 100000
  }
}; 