/**
 * Embedding Service using LLM Abstraction Layer
 * Migrated from the legacy AI module to use the new LLM service
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from './llm.service';
import { Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly defaultModel = 'text-embedding-3-small';
  private readonly defaultDimensions = 1536;
  private readonly cache = new Map<string, number[]>();
  private embeddingCache = new Map<string, number[]>();
  private readonly cacheEmbeddings: boolean;
  private readonly defaultEmbeddingModel: string;

  constructor(
    private readonly llmService: LLMService,
    private readonly configService: ConfigService,
  ) {
    this.cacheEmbeddings = this.configService.get<boolean>('CACHE_EMBEDDINGS', true);
    this.defaultEmbeddingModel = this.configService.get<string>(
        'openai.embeddingModel', 
        'text-embedding-3-small'
    );
    this.logger.log(`EmbeddingService initialized. Caching: ${this.cacheEmbeddings}, Default Model: ${this.defaultEmbeddingModel}`);
  }

  /**
   * Create an embedding for a single text
   * @param text Text to create embedding for
   * @param options Optional settings
   * @returns Embedding vector
   */
  async createEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    try {
      const cacheKey = `${options.model || this.defaultEmbeddingModel}:${text}`;
      
      // Return from cache if available and not skipped, and if global caching is enabled
      if (this.cacheEmbeddings && !options.skipCache && this.cache.has(cacheKey)) {
        this.logger.debug('Returning embedding from cache');
        return this.cache.get(cacheKey)!;
      }
      
      const embeddings = await this.createEmbeddings(text, options);
      
      if (!embeddings || embeddings.length === 0 || !embeddings[0] || embeddings[0].length === 0) {
        throw new Error('Failed to create embedding');
      }
      
      // Add to cache for future use, if global caching enabled and not skipped for this call
      if (this.cacheEmbeddings && !options.skipCache) {
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
  async createEmbeddings(
    texts: string | string[],
    options?: EmbeddingOptions,
  ): Promise<number[][]> {
    const textsToEmbedArray = Array.isArray(texts) ? texts : [texts];
    if (textsToEmbedArray.length === 0) {
      this.logger.warn('No texts provided for embedding creation.');
      throw new Error('No texts provided for embedding creation');
    }

    // Check if all texts in the array are empty or whitespace
    const allTextsEffectivelyEmpty = textsToEmbedArray.every(text => !text || text.trim() === '');
    if (allTextsEffectivelyEmpty) {
      this.logger.warn('All provided texts were empty or whitespace.');
      throw new Error('All provided texts were empty'); // Match test assertion
    }

    const { skipCache = false, model, dimensions } = options || {};
    const effectiveModel = model || this.defaultEmbeddingModel;

    const results: number[][] = [];
    const textsToFetch: string[] = [];
    const originalIndices: number[] = []; // To put results back in order

    if (this.cacheEmbeddings && !skipCache) {
      textsToEmbedArray.forEach((text, index) => {
        const cacheKey = `${effectiveModel}:${text}`;
        if (this.embeddingCache.has(cacheKey)) {
          results[index] = this.embeddingCache.get(cacheKey)!;
        } else {
          textsToFetch.push(text);
          originalIndices.push(index);
          // Placeholder for results to maintain order
          results[index] = []; 
        }
      });
    } else {
      textsToFetch.push(...textsToEmbedArray);
      textsToEmbedArray.forEach((_,index) => originalIndices.push(index));
       // Placeholder for results to maintain order
      textsToEmbedArray.forEach((_,index) => results[index] = []);
    }

    if (textsToFetch.length > 0) {
      this.logger.debug(
        `Cache miss for ${textsToFetch.length} texts. Fetching embeddings with model ${effectiveModel}.`,
      );
      
      // Use the new LLM service for embeddings
      const response = await this.llmService.generateEmbedding(textsToFetch, {
        model: effectiveModel,
        // Note: dimensions would need to be added to the LLM request types if needed
      });
      
      const newEmbeddings = response.embeddings;
      
      newEmbeddings.forEach((embedding: number[], i: number) => {
        const originalIndex = originalIndices[i];
        results[originalIndex] = embedding;
        if (this.cacheEmbeddings && !skipCache) {
          const cacheKey = `${effectiveModel}:${textsToFetch[i]}`;
          this.embeddingCache.set(cacheKey, embedding);
        }
      });
    }
    return results;
  }

  /**
   * Clear the embedding cache
   * @returns Number of cleared cache entries
   */
  clearCache(): void {
    this.embeddingCache.clear();
    this.logger.log('Embedding cache cleared.');
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
   * @param vector Input vector
   * @returns Normalized vector
   */
  normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) {
      return vector; // Return original if zero vector
    }
    return vector.map(val => val / norm);
  }

  /**
   * Find the most similar texts from a list of candidates
   * @param query Query text
   * @param candidates List of candidate texts
   * @param topK Number of top results to return
   * @returns Array of texts with similarity scores
   */
  async findMostSimilar(
    query: string,
    candidates: string[],
    topK: number = 1
  ): Promise<Array<{ text: string; similarity: number }>> {
    try {
      const queryEmbedding = await this.createEmbedding(query);
      const candidateEmbeddings = await this.createEmbeddings(candidates);
      
      const similarities = candidateEmbeddings.map((embedding, index) => ({
        text: candidates[index],
        similarity: this.calculateCosineSimilarity(queryEmbedding, embedding)
      }));
      
      // Sort by similarity (descending) and return top K
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      this.logger.error(`Error finding most similar texts: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
} 