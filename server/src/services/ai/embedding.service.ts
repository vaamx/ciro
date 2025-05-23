import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, EmbeddingAPIOptions } from './openai.service';
import { ConfigService } from '@nestjs/config';

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
  private readonly logger = createServiceLogger(EmbeddingService.name);
  private readonly defaultModel = 'text-embedding-ada-002';
  private readonly defaultDimensions = 1536;
  private readonly cache = new Map<string, number[]>();
  private embeddingCache = new Map<string, number[]>();
  private readonly cacheEmbeddings: boolean;
  private readonly defaultEmbeddingModel: string;

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly configService: ConfigService,
  ) {
    this.cacheEmbeddings = this.configService.get<boolean>('CACHE_EMBEDDINGS', true);
    this.defaultEmbeddingModel = this.configService.get<string>(
        'openai.embeddingModel', 
        'text-embedding-3-small'
    );
    this.logger.info(`EmbeddingService initialized. Caching: ${this.cacheEmbeddings}, Default Model: ${this.defaultEmbeddingModel}`);
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

    const { skipCache = false, ...apiOptions } = options || {}; // Destructure skipCache, pass rest as apiOptions
    const effectiveModel = apiOptions.model || this.defaultEmbeddingModel;

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
        `Cache miss for ${textsToFetch.length} texts. Fetching from OpenAI with model ${effectiveModel}. Options: ${JSON.stringify(apiOptions)}`,
      );
      // Pass only the apiOptions (model, dimensions) to openAIService
      // const newEmbeddings = await this.openAIService.createEmbeddings(textsToFetch, apiOptions);
      // Correctly pass the effectiveModel and other relevant API options
      const finalApiOptions: EmbeddingAPIOptions = { ...apiOptions };
      if (effectiveModel) { // Ensure model is only added if it exists
        finalApiOptions.model = effectiveModel;
      }
      // Dimensions might also be in apiOptions, so keep them if they are.
      // If apiOptions.dimensions is not set, OpenAI client will use its default.

      const newEmbeddings = await this.openAIService.createEmbeddings(textsToFetch, finalApiOptions);
      
      newEmbeddings.forEach((embedding, i) => {
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
    this.logger.info('Embedding cache cleared.');
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