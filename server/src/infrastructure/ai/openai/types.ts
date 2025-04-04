import OpenAI from 'openai';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { EmbeddingCreateParams } from 'openai/resources/embeddings';

/**
 * This is a type augmentation for the OpenAI client to add the missing properties
 * that TypeScript doesn't recognize but are actually available at runtime.
 * We use this approach instead of extending the OpenAI class to avoid TypeScript errors.
 */
export type ExtendedOpenAI = OpenAI & {
  embeddings: {
    create: (params: EmbeddingCreateParams) => Promise<{
      data: Array<{
        embedding: number[];
        index: number;
        object: string;
      }>;
      model: string;
      object: string;
      usage: {
        prompt_tokens: number;
        total_tokens: number;
      };
    }>;
  };
  chat: {
    completions: {
      create: (params: ChatCompletionCreateParams) => Promise<any>;
    };
  };
} 