export type ModelType = 'gpt-4o-mini' | 'gpt-4o' | 'o3-mini';

export interface ModelConfig {
  maxTokens: number;
  temperature: number;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  'gpt-4o-mini': {
    maxTokens: 16384,
    temperature: 0.7,
  },
  'gpt-4o': {
    maxTokens: 16384,
    temperature: 0.7,
  },
  'o3-mini': {
    maxTokens: 100000,
    temperature: 0.7,
  }
}; 