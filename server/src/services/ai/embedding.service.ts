import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService } from './openai.service';

/**
 * Options for embedding generation
 */
export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  skipCache?: boolean;
}

/**
 * Service for creating and managing embeddings
 * Centralizes embedding generation across the application
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = createServiceLogger('EmbeddingService');
  private readonly defaultModel = 'text-embedding-ada-002';
  private readonly defaultDimensions = 1536;
  private readonly cache = new Map<string, number[]>();

  constructor(private readonly openAIService: OpenAIService) {
    this.logger.info('EmbeddingService initialized');
  }

  /**
   * Create an embedding for a single text
   * @param text Text to create embedding for
   * @param options Optional settings
   * @returns Embedding vector
   */
  async createEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    try {
      const cacheKey = `${options.model || this.defaultModel}:${text}`;
      
      // Return from cache if available and not skipped
      if (!options.skipCache && this.cache.has(cacheKey)) {
        this.logger.debug('Returning embedding from cache');
        return this.cache.get(cacheKey)!;
      }
      
      const embeddings = await this.createEmbeddings(text, options);
      
      if (!embeddings || embeddings.length === 0) {
        throw new Error('Failed to create embedding');
      }
      
      // Add to cache for future use
      if (!options.skipCache) {
        this.cache.set(cacheKey, embeddings[0]);
      }
      
      return embeddings[0];
    } catch (error) {
      this.logger.error(`Error creating embedding: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create embeddings for multiple texts
   * @param texts Single text or array of texts to create embeddings for
   * @param options Optional settings
   * @returns Array of embedding vectors
   */
  async createEmbeddings(texts: string | string[], options: EmbeddingOptions = {}): Promise<number[][]> {
    try {
      // Convert to array if single string
      const textArray = Array.isArray(texts) ? texts : [texts];
      
      // Validate input
      if (textArray.length === 0) {
        throw new Error('No texts provided for embedding creation');
      }
      
      // Filter out empty texts
      const validTexts = textArray.filter(text => text && text.trim().length > 0);
      
      if (validTexts.length === 0) {
        throw new Error('All provided texts were empty');
      }
      
      // Check for cached embeddings if not skipping cache
      if (!options.skipCache && validTexts.length === 1) {
        const cacheKey = `${options.model || this.defaultModel}:${validTexts[0]}`;
        
        if (this.cache.has(cacheKey)) {
          return [this.cache.get(cacheKey)!];
        }
      }
      
      // Use OpenAI service to create embeddings
      const embeddings = await this.openAIService.createEmbeddings(validTexts);
      
      // Add single embeddings to cache
      if (!options.skipCache && validTexts.length === 1) {
        const cacheKey = `${options.model || this.defaultModel}:${validTexts[0]}`;
        this.cache.set(cacheKey, embeddings[0]);
      }
      
      return embeddings;
    } catch (error) {
      this.logger.error(`Error creating embeddings: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Clear the embedding cache
   * @returns Number of cleared cache entries
   */
  clearCache(): number {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared ${cacheSize} embeddings from cache`);
    return cacheSize;
  }

  /**
   * Calculate similarity between two texts using their embeddings
   * @param textA First text
   * @param textB Second text
   * @returns Similarity score between 0 and 1
   */
  async calculateSimilarity(textA: string, textB: string): Promise<number> {
    try {
      // Use the array version directly to fix type error
      const embeddings = await this.createEmbeddings([textA, textB]);
      const [embeddingA, embeddingB] = embeddings;
      
      return this.calculateCosineSimilarity(embeddingA, embeddingB);
    } catch (error) {
      this.logger.error(`Error calculating text similarity: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @private
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error(`Vector dimensions don't match: ${vectorA.length} vs ${vectorB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    // Handle zero vectors to avoid division by zero
    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Normalize a vector to unit length
   * @param vector Vector to normalize
   * @returns Normalized vector
   */
  normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return vector.slice(); // Return a copy of the vector
    }
    
    return vector.map(val => val / magnitude);
  }

  /**
   * Find the most similar text in a collection
   * @param query Query text to compare
   * @param candidates Array of candidate texts
   * @param topK Number of results to return
   * @returns Top K most similar texts with similarity scores
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK: number = 1
  ): Promise<Array<{ text: string; similarity: number }>> {
    try {
      // Create embeddings for query and candidates
      const queryEmbedding = (await this.createEmbeddings(query))[0];
      const candidateEmbeddings = await this.createEmbeddings(candidates);
      
      // Calculate similarities
      const similarities = candidateEmbeddings.map((embedding, index) => ({
        text: candidates[index],
        similarity: this.calculateCosineSimilarity(queryEmbedding, embedding)
      }));
      
      // Sort by similarity (descending) and take top K
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      this.logger.error(`Error finding most similar texts: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
} 