import OpenAI from 'openai';
import {OpenAIError } from './errors';

// Configuration types
export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  maxRetries?: number;
  timeout?: number;
}

// Default configuration values
const DEFAULT_CONFIG: Partial<OpenAIConfig> = {
  maxRetries: 3,
  timeout: 30000, // 30 seconds
};

// Initialize OpenAI client with configuration
export function createOpenAIClient(config: OpenAIConfig): OpenAI {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    return new OpenAI({
      apiKey: finalConfig.apiKey,
      organization: finalConfig.organization,
      maxRetries: finalConfig.maxRetries,
      timeout: finalConfig.timeout,
    });
  } catch (error) {
    throw new OpenAIError('Failed to initialize OpenAI client', { cause: error });
  }
}

// Token calculation utilities
export function calculateTokenCost(tokens: number, model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.01, output: 0.03 },
    'gpt-4o-mini': { input: 0.001, output: 0.002 },
    'text-embedding-3-small': { input: 0.00002, output: 0.00002 },
    'text-embedding-3-large': { input: 0.00013, output: 0.00013 },
  };

  return tokens * (pricing[model]?.input || 0);
}

// Rate limiting configuration
export const RATE_LIMITS = {
  completions: {
    tokensPerMinute: 60000,
    requestsPerMinute: 500,
  },
  embeddings: {
    tokensPerMinute: 1000000,
    requestsPerMinute: 1000,
  },
}; 