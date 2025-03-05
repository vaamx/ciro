import { QdrantClient } from '@qdrant/js-client-rest';
import { createLogger } from '../utils/logger';
import { config } from '../config/index';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../services/config.service';
import { HttpException } from '@nestjs/common';

// Default vector dimension for embeddings
const VECTOR_DIMENSION = 1536; // Default for OpenAI embeddings

// Mock QdrantVectorStore since the actual import is unavailable
// This replaces: import { QdrantVectorStore } from '@llamaindex/core/vector_stores';
class QdrantVectorStore {
  constructor(params: { client: QdrantClient; collectionName: string }) {
    // Mock implementation
  }
}

/**
 * Configuration options for Qdrant
 */
interface QdrantConfig {
  url: string;
  apiKey?: string;
}

/**
 * Unified query analysis interface for vector operations
 */
interface QueryAnalysis {
  queryType: 'semantic' | 'keyword' | 'hybrid' | 'count' | 'analytical';
  complexity: 'high' | 'medium' | 'low';
  needsExhaustiveResults: boolean;
  keywords: string[];
  entities: string[];
  limit: number;
  scoreThreshold: number;
  exactMatch: boolean;
  includeSimilar: boolean;
  filters?: Record<string, any>;
}

/**
 * Search result interface for normalized responses
 */
interface SearchResult {
  id: string | number;
  score: number;
  content: string;
  metadata: Record<string, any>;
  vector?: number[];
}

/**
 * Service for interacting with the Qdrant vector database
 */
export class QdrantService {
  private readonly logger = createLogger('QdrantService');
  private readonly client: QdrantClient;
  
  private static instance: QdrantService | null = null;
  private static clientInitialized = false;
  private static constructorCallCount = 0;

  /**
   * Get the singleton instance of QdrantService
   */
  public static getInstance(): QdrantService {
    if (!QdrantService.instance) {
      QdrantService.instance = new QdrantService();
    }
    return QdrantService.instance;
  }

  /**
   * Get the number of times the constructor has been called
   */
  public static getConstructorCallCount(): number {
    return QdrantService.constructorCallCount;
  }

  constructor() {
    QdrantService.constructorCallCount++;
    
    // Get Qdrant URL from config
    const qdrantConfig: QdrantConfig = {
      url: config?.qdrant?.url || 'http://localhost:6333',
      apiKey: config?.qdrant?.apiKey
    };
    
    // Create Qdrant client
    try {
      if (!QdrantService.clientInitialized) {
        this.logger.info(`Initializing Qdrant client with URL: ${qdrantConfig.url}`);
        QdrantService.clientInitialized = true;
      }
      
      this.client = new QdrantClient({
        url: qdrantConfig.url,
        apiKey: qdrantConfig.apiKey
      });
      
      if (QdrantService.instance) {
        this.logger.warn(`⚠️ Warning: QdrantService constructor called multiple times. Use QdrantService.getInstance() instead.`);
      } else if (QdrantService.constructorCallCount === 1) {
        this.logger.info(`Created singleton instance of QdrantService`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Qdrant client: ${error.message}`);
      // Create mock client for testing
      this.client = {
        getCollections: async () => ({ collections: [] }),
      } as any;
    }
  }

  /**
   * Get the Qdrant client instance
   */
  getClient(): QdrantClient {
    return this.client;
  }

  /**
   * Check if a collection exists in Qdrant
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(c => c.name === collectionName);
    } catch (error) {
      this.logger.error(`Error checking collection existence for ${collectionName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a new collection
   * @param collectionName The name of the collection
   * @param options Collection configuration options
   * @returns True if the collection was created successfully
   */
  async createCollection(
    collectionName: string,
    options: {
      vectors: {
        size: number;
        distance: 'Cosine' | 'Euclid' | 'Dot';
      };
    }
  ): Promise<boolean> {
    try {
      this.logger.info(`Creating collection ${collectionName} with dimension ${options.vectors.size}`);
      
      await this.client.createCollection(collectionName, options);
      
      this.logger.info(`Successfully created collection ${collectionName}`);
      return true;
    } catch (error) {
      // If the collection already exists, consider it a success
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.info(`Collection ${collectionName} already exists`);
        return true;
      }
      
      this.logger.error(`Failed to create collection ${collectionName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Store vectors in Qdrant
   */
  async storeVectors(
    collectionName: string,
    vectors: number[][],
    payloads: Record<string, any>[],
    ids?: string[]
  ): Promise<string[]> {
    try {
      console.log(`Storing ${vectors.length} vectors in collection ${collectionName}`);
      
      // Ensure collection exists
      if (!(await this.collectionExists(collectionName))) {
        console.log(`Collection ${collectionName} does not exist, creating it with dimension ${vectors[0].length}`);
        await this.createCollection(collectionName, {
          vectors: {
            size: vectors[0].length,
            distance: 'Cosine'
          }
        });
      }
      
      // Prepare points
      const points = vectors.map((vector, index) => {
        const id = ids ? ids[index] : crypto.randomUUID();
        console.log(`Creating point with ID ${id} (${vector.length} dimensions)`);
        return {
          id,
          vector,
          payload: payloads[index]
        };
      });
      
      console.log(`Prepared ${points.length} points for upsert`);
      
      // Store points in batches
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        console.log(`Upserting batch of ${batch.length} points (${i+1} to ${Math.min(i+batchSize, points.length)})`);
        
        try {
          await this.client.upsert(collectionName, {
            points: batch
          });
          console.log(`Batch upsert successful`);
        } catch (batchError) {
          console.error(`Error in batch upsert: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
          throw batchError;
        }
      }
      
      console.log(`Successfully stored ${vectors.length} vectors in collection ${collectionName}`);
      this.logger.info(`Stored ${vectors.length} vectors in collection ${collectionName}`);
      return points.map(p => p.id.toString());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error storing vectors: ${errorMessage}`);
      this.logger.error(`Error storing vectors: ${errorMessage}`, { error });
      throw error;
    }
  }

  /**
   * Search for similar vectors in Qdrant
   */
  async search(
    collectionName: string,
    queryVector: number[],
    filter?: Record<string, any>,
    limit: number = 5
  ): Promise<any[]> {
    try {
      console.log(`Searching collection ${collectionName} with vector of length ${queryVector.length}`);
      
      // Ensure collection exists
      if (!(await this.collectionExists(collectionName))) {
        console.log(`Collection ${collectionName} does not exist for search`);
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return [];
      }
      
      // Perform the search
      const searchParams: any = {
        vector: queryVector,
        limit,
        with_payload: true,
        with_vector: false
      };
      
      if (filter) {
        searchParams.filter = filter;
        console.log(`Adding filter to search:`, filter);
      }
      
      console.log(`Executing search with params:`, {
        collectionName,
        vectorLength: queryVector.length,
        limit,
        hasFilter: !!filter
      });
      
      const results = await this.client.search(collectionName, searchParams);
      
      console.log(`Search complete, found ${results.length} results`);
      if (results.length > 0) {
        console.log(`Top result score: ${results[0].score}`);
      }
      
      this.logger.info(`Found ${results.length} results for search in collection ${collectionName}`);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error searching vectors: ${errorMessage}`);
      this.logger.error(`Error searching vectors: ${errorMessage}`, { error });
      return [];
    }
  }

  /**
   * Delete vectors from Qdrant
   * @param collectionName Name of the collection to delete vectors from
   * @param filter Filter to apply to delete vectors
   * @returns Boolean indicating whether the vectors were deleted successfully
   */
  async deleteVectors(
    collectionName: string,
    filter: Record<string, any>
  ): Promise<boolean> {
    try {
      if (!await this.collectionExists(collectionName)) {
        throw new Error(`Collection ${collectionName} does not exist`);
      }
      
      await this.client.delete(collectionName, {
        filter
      });
      
      this.logger.info(`Deleted vectors from collection: ${collectionName}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting vectors: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Delete a collection from Qdrant
   * @param collectionName Name of the collection to delete
   * @returns Boolean indicating whether the collection was deleted successfully
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting collection: ${collectionName}`);
      await this.client.deleteCollection(collectionName);
      this.logger.info(`Collection deleted: ${collectionName}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting collection ${collectionName}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Get a LlamaIndex vector store for Qdrant
   * @param collectionName Name of the collection
   * @returns QdrantVectorStore instance
   */
  async getVectorStore(collectionName: string): Promise<QdrantVectorStore> {
    return new QdrantVectorStore({
      client: this.client,
      collectionName,
    });
  }

  /**
   * Normalizes collection names, ensuring consistent formatting
   * @param collectionName The collection name to normalize
   * @returns Normalized collection name
   */
  private normalizeCollectionName(collectionName: string): string {
    // Ensure all collection names start with datasource_
    const normalized = collectionName.startsWith('datasource_') 
      ? collectionName 
      : `datasource_${collectionName}`;
    
    this.logger.info(`Normalized collection name: ${normalized}`);
    return normalized;
  }

  /**
   * Upsert vectors to Qdrant
   * @param collectionName The name of the collection
   * @param points The points to upsert
   * @returns The result of the upsert operation
   */
  async upsertVectors(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: any;
    }>
  ): Promise<{ status: string; message: string; upserted: number }> {
    try {
      if (!points || points.length === 0) {
        this.logger.warn(`No points to upsert to collection ${collectionName}`);
        return { status: 'warning', message: 'No points to upsert', upserted: 0 };
      }

      // Normalize collection name
      const normalizedCollectionName = this.normalizeCollectionName(collectionName);
      this.logger.info(`Upserting ${points.length} vectors to collection ${normalizedCollectionName}`);

      // Check if collection exists, create if not
      if (!(await this.collectionExists(normalizedCollectionName))) {
        this.logger.info(`Creating collection ${normalizedCollectionName}`);
        
        try {
          const createResult = await this.createCollection(normalizedCollectionName, {
            vectors: {
              size: VECTOR_DIMENSION,
              distance: 'Cosine',
            },
          });
          
          this.logger.info(`Collection creation result: ${JSON.stringify(createResult)}`);
        } catch (createError) {
          // If creation failed because collection already exists, continue
          if ((createError as Error).message.includes('already exists')) {
            this.logger.info(`Collection ${normalizedCollectionName} already exists, proceeding with upsert.`);
          } else {
            throw createError;
          }
        }
      }

      // Prepare points for upsert, handling UUID conversions
      const preparedPoints = points.map(point => {
        // Handle non-UUID IDs by converting to string
        const pointId = typeof point.id === 'string' ? point.id : String(point.id);
        
        // Log the original and processed point ID for debugging
        this.logger.debug(`Processing point ID: ${point.id} → ${pointId}`);
        
              return {
          id: pointId,
          vector: point.vector,
                payload: {
                  ...point.payload,
            // Store both formats of IDs to help with retrieval
            fileId: point.payload.fileId || null,
            dataSourceId: point.payload.dataSourceId || null,
          }
        };
      });

      // Determine batch size based on vector dimensions
      const pointSizeEstimate = preparedPoints.reduce((size, point) => {
        // Rough estimate of point size in bytes
        const vectorSize = point.vector.length * 4; // 4 bytes per float
        const payloadSize = JSON.stringify(point.payload).length * 2; // Rough estimate of JSON size
        return size + vectorSize + payloadSize;
      }, 0);
      
      // Aim for batches of around 10MB to avoid timeouts/memory issues
      const maxBatchSizeBytes = 10 * 1024 * 1024; // 10MB
      const estimatedPointsPerBatch = Math.max(1, Math.floor(maxBatchSizeBytes / (pointSizeEstimate / preparedPoints.length)));
      const batchSize = Math.min(estimatedPointsPerBatch, 100); // Cap at 100 points per batch
      
      this.logger.info(`Estimated ${pointSizeEstimate / 1024 / 1024}MB for ${preparedPoints.length} points, using batch size of ${batchSize}`);

      let totalUpserted = 0;
      // Process in batches to avoid timeouts
      for (let i = 0; i < preparedPoints.length; i += batchSize) {
        const batch = preparedPoints.slice(i, i + batchSize);
        this.logger.info(`Upserting batch ${i / batchSize + 1}/${Math.ceil(preparedPoints.length / batchSize)} (${batch.length} points)`);
        
        try {
          const result = await this.client.upsert(normalizedCollectionName, {
            points: batch,
          });
          
          this.logger.info(`Batch upsert result: ${JSON.stringify(result)}`);
          totalUpserted += batch.length;
        } catch (batchError) {
          this.logger.error(`Error upserting batch: ${(batchError as Error).message}`);
          throw batchError;
        }
      }

      return {
        status: 'success',
        message: `Successfully upserted ${totalUpserted} vectors to ${normalizedCollectionName}`,
        upserted: totalUpserted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error upserting vectors: ${errorMessage}`, { error });
      
      return {
        status: 'error',
        message: `Failed to upsert vectors: ${errorMessage}`,
        upserted: 0,
      };
    }
  }

  /**
   * List all collections in Qdrant
   * @returns Array of collection names
   */
  async listCollections(): Promise<string[]> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.map(c => c.name);
    } catch (error) {
      this.logger.error(`Error listing collections: ${error.message}`);
      return [];
    }
  }

  /**
   * Get information about a collection
   * @param collectionName Name of the collection
   * @returns Promise<any> Collection information
   */
  async getCollectionInfo(collectionName: string): Promise<any> {
    try {
      const info = await this.client.getCollection(collectionName);
      return {
        ...info,
        points_count: info.vectors_count || 0
      };
    } catch (error) {
      this.logger.error(`Error getting collection info for ${collectionName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Optimize a collection for better search performance
   * @param collectionName Name of the collection to optimize
   * @returns Promise<boolean> True if optimization was successful
   */
  async optimizeCollection(collectionName: string): Promise<boolean> {
    try {
      // Call Qdrant's indexing optimization
      await this.client.updateCollection(collectionName, {
        optimizers_config: {
          indexing_threshold: 0, // Force reindexing
        }
      });
      return true;
    } catch (error) {
      this.logger.error(`Error optimizing collection ${collectionName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get all points from a collection
   * @param collectionName Name of the collection
   * @param limit Maximum number of points to retrieve
   * @returns Promise<Array<{id: string; vector?: number[]; payload: Record<string, any>;}>>
   */
  async getAllPoints(collectionName: string, limit: number = 100): Promise<Array<{
    id: string;
    vector?: number[];
    payload: Record<string, any>;
  }>> {
    try {
      this.logger.info(`Getting all points from collection: ${collectionName} (limit: ${limit})`);
      
      // Check if collection exists
      const exists = await this.collectionExists(collectionName);
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return [];
      }
      
      // Scroll through all points in the collection
      const response = await this.client.scroll(collectionName, {
        limit: limit,
        with_payload: true,
        with_vector: false // Skip vectors to reduce response size
      });
      
      if (!response || !response.points) {
        this.logger.warn(`No points found in collection ${collectionName}`);
        return [];
      }
      
      this.logger.info(`Retrieved ${response.points.length} points from collection ${collectionName}`);
      
      return response.points.map(point => ({
        id: point.id as string,
        payload: point.payload as Record<string, any>
      }));
    } catch (error) {
      this.logger.error(`Error getting points from collection ${collectionName}:`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Perform a text search in a collection
   */
  public async textSearch(
    collection: string,
    text: string,
    filter?: any,
    limit: number = 10
  ) {
    try {
      this.logger.debug(`Using textSearch method with text "${text}"`);
      
      // Use the new intelligentSearch with text input and exactMatch=true
      const results = await this.intelligentSearch(collection, text, {
        filters: filter,
        limit,
        exactMatch: true
      });
      
      // Convert to old format for backward compatibility
      return results.map(result => ({
        id: result.id,
        score: result.score,
        payload: {
          ...result.metadata,
          text: result.content
        }
      }));
    } catch (error) {
      this.logger.error(`Error in textSearch: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get random points from a collection for sampling/testing
   * @param collectionName The name of the collection
   * @param limit Maximum number of points to return
   * @returns Array of points with their payloads
   */
  async getRandomPoints(collectionName: string, limit: number = 5): Promise<any[]> {
    try {
      if (!await this.collectionExists(collectionName)) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return [];
      }
      
      const response = await this.client.scroll(collectionName, {
        limit,
        with_payload: true
      });
      
      return response.points;
    } catch (error) {
      this.logger.error(`Error getting random points from ${collectionName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze a query to determine appropriate search parameters
   * @param query The search query to analyze
   * @param options Additional options to consider
   * @returns QueryAnalysis object with search parameters
   */
  analyzeQuery(
    query: string,
    options: {
      defaultLimit?: number;
      filters?: Record<string, any>;
      forceExact?: boolean;
      forceExhaustive?: boolean;
    } = {}
  ): QueryAnalysis {
    // Default search parameters
    const defaultAnalysis: QueryAnalysis = {
      queryType: 'semantic',
      complexity: 'low',
      needsExhaustiveResults: false,
      keywords: [],
      entities: [],
      limit: options.defaultLimit || 10,
      scoreThreshold: 0.7,
      exactMatch: options.forceExact || false,
      includeSimilar: true,
      filters: options.filters
    };
    
    // If no query, return defaults
    if (!query || query.trim().length === 0) {
      return defaultAnalysis;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Extract keywords for better matching
    const keywords = this.extractKeywords(query);
    
    // Extract potential entities
    const entities = this.extractEntities(query);
    
    // Check if query is analytical in nature
    const analyticalPatterns = [
      /how many/i, /count/i, /total/i, /number of/i,
      /average/i, /mean/i, /median/i, /mode/i,
      /distribution/i, /percentage/i, /proportion/i,
      /statistics/i, /metrics/i, /analytics/i,
      /analyze/i, /analysis/i, /summarize/i, /summary/i
    ];
    
    const isAnalytical = analyticalPatterns.some(pattern => pattern.test(lowerQuery));
    
    // Check for count queries
    const countPatterns = [
      /how many/i, /count/i, /total number/i, /sum of/i
    ];
    
    const isCountQuery = countPatterns.some(pattern => pattern.test(lowerQuery));
    
    // Check for exact match requests
    const exactMatchPatterns = [
      /exactly/i, /exact/i, /exactly matching/i, /specifically/i, 
      /specific/i, /precise/i, /precisely/i, /verbatim/i
    ];
    
    const wantsExactMatch = exactMatchPatterns.some(pattern => pattern.test(lowerQuery));
    
    // Determine complexity based on query features
    let complexity: 'high' | 'medium' | 'low' = 'low';
    
    // More complex if it has many keywords or entities
    if (keywords.length > 5 || entities.length > 3) {
      complexity = 'high';
    } else if (keywords.length > 3 || entities.length > 1) {
      complexity = 'medium';
    }
    
    // More complex if it's analytical
    if (isAnalytical) {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }
    
    // Determine query type
    let queryType: 'semantic' | 'keyword' | 'hybrid' | 'count' | 'analytical' = 'semantic';
    
    if (isCountQuery) {
      queryType = 'count';
    } else if (isAnalytical) {
      queryType = 'analytical';
    } else if (wantsExactMatch) {
      queryType = 'keyword';
    } else if (keywords.length > 2) {
      queryType = 'hybrid';
    }
    
    // Determine search limits based on query type
    let limit = options.defaultLimit || 10;
    let needsExhaustiveResults = options.forceExhaustive || false;
    let scoreThreshold = 0.7;
    
    if (queryType === 'count' || queryType === 'analytical') {
      limit = 100; // Larger limit for analytical queries
      needsExhaustiveResults = true;
      scoreThreshold = 0.3; // Lower threshold to get more results
    } else if (complexity === 'high') {
      limit = 20;
      scoreThreshold = 0.5;
    } else if (complexity === 'medium') {
      limit = 15;
      scoreThreshold = 0.6;
    }
    
    return {
      queryType,
      complexity,
      needsExhaustiveResults,
      keywords,
      entities,
      limit,
      scoreThreshold,
      exactMatch: wantsExactMatch || options.forceExact || false,
      includeSimilar: !wantsExactMatch,
      filters: options.filters
    };
  }

  /**
   * Extract potential entities from a query
   * @param query The query to extract entities from
   * @returns Array of potential entities
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // Look for capitalized words (potential proper nouns)
    const capitalizedPattern = /\b[A-Z][a-z]+\b/g;
    const capitalizedMatches = query.match(capitalizedPattern) || [];
    entities.push(...capitalizedMatches);
    
    // Look for entity patterns like "Company X" or "Person Y"
    const entityPatterns = [
      { pattern: /\b(?:company|organization|business|firm|corporation|enterprise)\s+([A-Z][a-zA-Z0-9\s&]+)\b/g, group: 1 },
      { pattern: /\b(?:person|individual|employee|customer|client)\s+([A-Z][a-zA-Z0-9\s]+)\b/g, group: 1 },
      { pattern: /\b(?:location|place|country|city|region|area)\s+([A-Z][a-zA-Z0-9\s]+)\b/g, group: 1 }
    ];
    
    for (const { pattern, group } of entityPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      while ((match = pattern.exec(query)) !== null) {
        if (match[group]) {
          entities.push(match[group].trim());
        }
      }
    }
    
    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Similarity score
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    
    // Calculate magnitude
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    
    // Calculate cosine similarity
    if (magA === 0 || magB === 0) {
      return 0;
    }
    
    return dotProduct / (magA * magB);
  }

  /**
   * Get embedding for a query (mock implementation)
   * In a real system, this would call an embedding API
   * @param query Query to embed
   * @returns Vector embedding
   */
  private async getQueryEmbedding(query: string): Promise<number[]> {
    // This is a mock implementation
    // In a real system, you'd call your embedding service here
    
    this.logger.debug(`Getting embedding for query: "${query}"`);
    
    // Create a random embedding of dimension 1536 (OpenAI's dimension)
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }

  /**
   * Extract keywords from a query
   * @param query The query to extract keywords from
   * @returns Array of important keywords
   */
  private extractKeywords(query: string): string[] {
    // Remove stop words and extract important terms
    const stopWords = [
      'a', 'an', 'the', 'of', 'for', 'in', 'on', 'at', 'by', 'to', 
      'how', 'many', 'much', 'is', 'are', 'there', 'do', 'does', 'what', 
      'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'total',
      'their', 'they', 'it', 'its', 'that'
    ];
    
    // Extract words, remove punctuation, and filter out stop words
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Perform an intelligent search based on query analysis
   * @param collectionName Name of the collection to search
   * @param query Text query or embedding vector
   * @param options Search options
   * @returns Normalized search results
   */
  async intelligentSearch(
    collectionName: string,
    query: string | number[],
    options: {
      filters?: Record<string, any>;
      limit?: number;
      exactMatch?: boolean;
      exhaustiveSearch?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      this.logger.info(`Performing intelligent search on collection: ${collectionName}`);
      
      // Check if collection exists
      if (!(await this.collectionExists(collectionName))) {
        this.logger.warn(`Collection ${collectionName} does not exist for search`);
        return [];
      }
      
      // If query is a string, analyze it and perform appropriate search
      if (typeof query === 'string') {
        const queryAnalysis = this.analyzeQuery(query, {
          defaultLimit: options.limit,
          filters: options.filters,
          forceExact: options.exactMatch,
          forceExhaustive: options.exhaustiveSearch
        });
        
        this.logger.debug(`Query analysis: ${JSON.stringify(queryAnalysis)}`);
        
        // For now, simplify by always using vector search
        // In a more complete implementation, we would implement and use:
        // - exhaustiveSearch
        // - hybridSearch
        // - keywordSearch methods as shown in the full refactoring
        
        // Get embedding for the query
        const embedding = await this.getQueryEmbedding(query);
        
        // Use our existing search method
        const searchResults = await this.search(
          collectionName,
          embedding,
          queryAnalysis.filters,
          queryAnalysis.limit
        );
        
        // Normalize the results
        return searchResults.map(result => ({
          id: result.id,
          score: result.score,
          content: result.payload?.text || result.payload?.content || '',
          metadata: result.payload || {}
        }));
      } 
      // If query is a vector, perform vector search directly
      else if (Array.isArray(query)) {
        const searchResults = await this.search(
          collectionName,
          query,
          options.filters,
          options.limit || 10
        );
        
        // Normalize the results
        return searchResults.map(result => ({
          id: result.id,
          score: result.score,
          content: result.payload?.text || result.payload?.content || '',
          metadata: result.payload || {}
        }));
      }
      
      this.logger.warn(`Invalid query type provided: ${typeof query}`);
      return [];
    } catch (error) {
      this.logger.error(`Error in intelligent search: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
} 