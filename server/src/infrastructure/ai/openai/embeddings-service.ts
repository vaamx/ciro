import { BaseOpenAIService } from './base-service';
import { TokenLimitError } from './errors';
import { encode } from 'gpt-tokenizer';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  encoding_format?: 'float' | 'base64';
}

export class EmbeddingsService extends BaseOpenAIService {
  private readonly DEFAULT_MODEL = 'text-embedding-3-large';
  private readonly MAX_TOKENS = 8191;  // Maximum tokens for embedding models

  async createEmbedding(input: string | string[], options: EmbeddingOptions = {}) {
    // Handle array of strings
    const texts = Array.isArray(input) ? input : [input];
    
    // Calculate total tokens
    const totalTokens = texts.reduce((sum, text) => sum + encode(text).length, 0);
    if (totalTokens > this.MAX_TOKENS) {
      throw new TokenLimitError(
        'Input exceeds maximum token limit',
        totalTokens,
        this.MAX_TOKENS
      );
    }

    const defaultOptions = {
      model: this.DEFAULT_MODEL,
      encoding_format: 'float' as const,
    };

    const finalOptions = { ...defaultOptions, ...options };

    return this.executeWithRetry(
      async () => {
        // Create base parameters
        const params: any = {
          model: finalOptions.model,
          input: texts,
          encoding_format: finalOptions.encoding_format,
        };
        
        // Conditionally add dimensions
        if (finalOptions.dimensions) {
          params.dimensions = finalOptions.dimensions;
        }
        
        const response = await this.client.embeddings.create(params);

        // Return single embedding if input was a string, array of embeddings if input was array
        return Array.isArray(input) 
          ? response.data.map(item => item.embedding)
          : response.data[0].embedding;
      },
      'embeddings',
      totalTokens
    );
  }

  // Utility function to calculate cosine similarity between two vectors
  calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Utility function to find most similar embeddings
  findMostSimilar(
    query: number[],
    embeddings: number[][],
    topK: number = 5
  ): { index: number; similarity: number }[] {
    const similarities = embeddings.map((embedding, index) => ({
      index,
      similarity: this.calculateSimilarity(query, embedding),
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
} 