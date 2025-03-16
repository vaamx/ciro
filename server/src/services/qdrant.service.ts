import { QdrantClient } from '@qdrant/js-client-rest';
import * as winston from 'winston';
import { config } from '../config/index';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { ConfigService } from '../services/config.service';
import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { createServiceLogger } from '../utils/logger-factory';
import { OpenAIService } from './openai.service';

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
  queryType: 'semantic' | 'keyword' | 'hybrid' | 'count' | 'analytical' | 'entity_lookup';
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
  private readonly logger = createServiceLogger('QdrantService');
  private readonly apiUrl: string;
  private readonly headers: Record<string, string>;
  private readonly client: QdrantClient;
  private openaiService: OpenAIService;
  
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
    
    const configService = new ConfigService();
    this.apiUrl = configService.get('QDRANT_API_URL') || 'http://localhost:6333';
    
    // Set up headers for Qdrant API requests
    this.headers = {
      'Content-Type': 'application/json'
    };
    
    // Add API key if configured
    const apiKey = configService.get('QDRANT_API_KEY');
    if (apiKey) {
      this.headers['Api-Key'] = apiKey;
    }
    
    this.logger.info(`QdrantService initialized with API URL: ${this.apiUrl}`);
    
    // Initialize OpenAI service
    this.openaiService = OpenAIService.getInstance();
    
    // Create Qdrant client
    try {
      if (!QdrantService.clientInitialized) {
        this.logger.info(`Initializing Qdrant client with URL: ${this.apiUrl}`);
        QdrantService.clientInitialized = true;
      }
      
      this.client = new QdrantClient({
        url: this.apiUrl,
        apiKey: apiKey
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
      return collections.collections.map(c => c.name).includes(collectionName);
    } catch (error) {
      this.logger.error(`Error checking if collection ${collectionName} exists: ${error}`);
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
      
      // Enhance options to ensure on-disk storage and disable caching
      const enhancedOptions = {
        ...options,
        // Explicitly enable on-disk storage for all data
        on_disk_payload: true,
        hnsw_config: {
          // Store HNSW index on disk to prevent memory caching
          on_disk: true,
          // Other HNSW defaults
          m: 16,
          ef_construct: 100,
          full_scan_threshold: 10000
        },
        optimizers_config: {
          // Ensure vectors are moved to disk-based storage quickly
          default_segment_number: 2,
          memmap_threshold: 20000, // Lower threshold for moving to disk
          indexing_threshold: 5000  // Lower threshold for indexing
        },
        // Force write to disk more frequently
        wal_config: {
          wal_capacity_mb: 32,
          wal_segments_ahead: 0
        }
      };
      
      await this.client.createCollection(collectionName, enhancedOptions);
      
      this.logger.info(`Successfully created collection ${collectionName} with on-disk storage configuration`);
      return true;
    } catch (error) {
      // If the collection already exists, consider it a success
      if (error instanceof Error && error.message.includes('already exists')) {
        this.logger.info(`Collection ${collectionName} already exists`);
        // Update existing collection to use on-disk storage if possible
        try {
          await this.client.updateCollection(collectionName, {
            optimizers_config: {
              default_segment_number: 2,
              memmap_threshold: 20000,
              indexing_threshold: 5000
            }
          });
          this.logger.info(`Updated collection ${collectionName} with on-disk storage optimizations`);
        } catch (updateError) {
          this.logger.warn(`Could not update on-disk settings for ${collectionName}: ${updateError.message}`);
        }
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
    ids?: (string | number)[]
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
      
      // Prepare points, extra validation for IDs
      const points = vectors.map((vector, index) => {
        let pointId;
        
        // Handle ID assignment with better validation
        if (ids && index < ids.length) {
          const rawId = ids[index];
          
          // If it's already a number, use as is (Qdrant accepts numeric IDs directly)
          if (typeof rawId === 'number') {
            pointId = rawId;
            console.log(`Using numeric ID directly: ${pointId}`);
          } else {
            // Try to parse as number if it's a string containing only digits
            if (typeof rawId === 'string' && /^\d+$/.test(rawId)) {
              pointId = parseInt(rawId, 10);
              console.log(`Converted string number "${rawId}" to numeric ID: ${pointId}`);
            } else {
              // Otherwise use UUID conversion
              pointId = this.convertToValidQdrantId(rawId);
              console.log(`Converted complex ID to valid format: ${pointId}`);
            }
          }
        } else {
          // Generate a UUID if no ID provided
          pointId = crypto.randomUUID();
          console.log(`Generated UUID for point: ${pointId}`);
        }
        
        console.log(`Creating point with ID ${pointId} (${vector.length} dimensions)`);
        return {
          id: pointId,
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
    limit: number = 500  // Increased default from 100 to 500
  ): Promise<any[]> {
    try {
      console.log(`Searching collection ${collectionName} with vector of length ${queryVector.length}`);
      
      // Validate input
      if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
        this.logger.error(`Invalid query vector provided: ${queryVector ? 'Empty array' : 'Not an array'}`);
        return [];
      }
      
      // Normalize the collection name
      const normalizedCollectionName = this.normalizeCollectionName(collectionName);
      this.logger.info(`Normalized collection name for search: ${normalizedCollectionName}`);
      
      // Ensure collection exists
      if (!(await this.collectionExists(normalizedCollectionName))) {
        // Try alternative collection names
        const alternativeNames = [
          `datasource_${collectionName}`,
          collectionName.startsWith('datasource_') ? collectionName.substring(11) : collectionName,
          // Try with numeric ID if the collection name is a UUID
          collectionName.includes('-') ? `datasource_${parseInt(collectionName, 10) || ''}` : collectionName
        ];
        
        this.logger.info(`Collection ${normalizedCollectionName} not found, trying alternatives: ${alternativeNames.join(', ')}`);
        
        // Check each alternative
        let foundAlternative = false;
        for (const altName of alternativeNames) {
          if (await this.collectionExists(altName)) {
            this.logger.info(`Found alternative collection: ${altName}`);
            collectionName = altName;
            foundAlternative = true;
            break;
          }
        }
        
        if (!foundAlternative) {
          this.logger.warn(`No collection found for ${collectionName} or alternatives`);
          return [];
        }
      } else {
        collectionName = normalizedCollectionName;
      }
      
      // Universal search parameters for all collections
      // No special case handling - treat all collections the same
      const effectiveLimit = limit; // Use provided limit directly
      
      // Perform the search with universal parameters
      const searchParams: any = {
        vector: queryVector,
        limit: effectiveLimit,
        with_payload: true,
        with_vector: false,
        // Use a very low threshold to ensure we capture all potentially relevant documents
        score_threshold: 0.2, // Lowered from 0.7/0.5 to 0.2 to be more inclusive
      };
      
      // Add HNSW search params for better recall
      searchParams.params = {
        hnsw_ef: 512, // Increased from 256 for more exhaustive search
      };
      
      if (filter) {
        searchParams.filter = filter;
        console.log(`Adding filter to search:`, filter);
      }
      
      console.log(`Executing search with params:`, {
        collectionName,
        vectorLength: queryVector.length,
        limit: searchParams.limit,
        threshold: searchParams.score_threshold,
        hasFilter: !!filter
      });
      
      const results = await this.client.search(collectionName, searchParams);
      
      console.log(`Search complete, found ${results.length} results`);
      if (results.length > 0) {
        console.log(`Top result score: ${results[0].score}`);
        console.log(`Lowest result score: ${results[results.length - 1].score}`);
        
        // Log the content of the first result to help debugging
        if (results.length > 0) {
          const firstResult = results[0];
          if (firstResult.payload && typeof firstResult.payload.text === 'string') {
            console.log(`First result content preview: ${firstResult.payload.text.substring(0, 200)}...`);
          } else if (firstResult.payload && typeof firstResult.payload.content === 'string') {
            console.log(`First result content preview: ${firstResult.payload.content.substring(0, 200)}...`);
          } else {
            console.log(`First result has no text content or is not a string`);
          }
        }
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
   * Convert a string ID with colons to a valid Qdrant point ID (UUID v5)
   * @param id The original ID (possibly containing colons)
   * @returns A valid Qdrant ID (UUID or number)
   */
  private convertToValidQdrantId(id: string | number): string | number {
    if (typeof id === 'number') {
      // If it's already a number, it's a valid Qdrant ID
      this.logger.debug(`ID is already a number: ${id}`);
      return id;
    }
    
    // If it's a string that can be parsed as a number, convert it
    if (typeof id === 'string' && !isNaN(Number(id)) && !id.includes(':')) {
      const numericId = Number(id);
      this.logger.debug(`Converted string ID "${id}" to numeric ID: ${numericId}`);
      return numericId;
    }
    
    // If it's a string with colons, convert to a deterministic UUID using UUID v5
    if (typeof id === 'string' && id.includes(':')) {
      // Using a namespace based on the application name to ensure consistency
      const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace (this is the DNS namespace UUID)
      
      try {
        // Generate a deterministic UUID based on the ID string
        const uuid = uuidv5(id, NAMESPACE);
        this.logger.debug(`Converted ID with colons: "${id}" → UUID: "${uuid}"`);
        return uuid;
      } catch (error) {
        this.logger.warn(`Failed to convert ID "${id}" to UUID, using a sanitized version`);
        // Fallback: Replace colons with underscores
        return id.replace(/:/g, '_');
      }
    }
    
    // If it's already a valid format, return as is
    return id;
  }

  /**
   * Force optimization and flushing of a collection to ensure all data is persisted to disk
   * @param collectionName Name of the collection to optimize and flush
   * @returns Promise<boolean> True if the operation was successful
   */
  async forceFlushCollection(collectionName: string): Promise<boolean> {
    try {
      this.logger.info(`Forcing optimization and flush for collection: ${collectionName}`);
      
      // First update the collection to force optimization
      await this.client.updateCollection(collectionName, {
        optimizers_config: {
          indexing_threshold: 0, // Force immediate indexing
          default_segment_number: 2 // Reduce number of segments
        }
      });
      
      // Then try to call a low-level API for direct flush if available
      // Note: This is best-effort and won't fail if not available
      try {
        // Get the Qdrant URL from config, same as in constructor
        const qdrantUrl = config?.qdrant?.url || 'http://localhost:6333';
        const apiKey = config?.qdrant?.apiKey;
        
        const response = await fetch(`${qdrantUrl}/collections/${collectionName}/optimize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'api-key': apiKey })
          }
        });
        
        if (!response.ok) {
          this.logger.warn(`Optimize endpoint returned status ${response.status}: ${await response.text()}`);
        } else {
          this.logger.info(`Successfully forced collection optimization for ${collectionName}`);
        }
      } catch (optimizeError) {
        // Ignore errors from this endpoint as it might not be available
        this.logger.debug(`Optimize endpoint not available: ${optimizeError.message}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error forcing collection flush: ${error.message}`);
      return false;
    }
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

      // Prepare points for upsert, handling ID conversions for Qdrant compatibility
      const preparedPoints = points.map(point => {
        // Convert the ID to a format Qdrant accepts (UUID or integer)
        const pointId = this.convertToValidQdrantId(point.id);
        
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
            originalId: point.id, // Store the original ID to help with mapping back
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
        this.logger.info(`Upserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(preparedPoints.length/batchSize)} (${batch.length} points)`);
        
        try {
          // Set wait=true to ensure points are fully processed before proceeding
          const result = await this.client.upsert(normalizedCollectionName, {
            points: batch,
            wait: true // This ensures operation completes before returning
          });
          
          this.logger.info(`Batch upsert result: ${JSON.stringify(result)}`);
          totalUpserted += batch.length;
          
          // Force a collection update to ensure data is persisted to disk
          try {
            // Trigger an update that forces a flush to disk
            await this.forceFlushCollection(normalizedCollectionName);
            this.logger.debug(`Forced disk flush for batch ${Math.floor(i/batchSize) + 1}`);
          } catch (flushError) {
            // Non-fatal, just log warning
            this.logger.warn(`Could not force disk flush for batch ${Math.floor(i/batchSize) + 1}: ${flushError.message}`);
          }
        } catch (batchError) {
          this.logger.error(`Error upserting batch: ${(batchError as Error).message}`);
          throw batchError;
        }
      }

      // After all batches are processed, do a final flush to ensure everything is persisted
      if (totalUpserted > 0) {
        try {
          this.logger.info(`Performing final flush for ${normalizedCollectionName} after upserting ${totalUpserted} vectors`);
          await this.forceFlushCollection(normalizedCollectionName);
        } catch (finalFlushError) {
          this.logger.warn(`Final flush operation failed, but vectors were upserted: ${finalFlushError.message}`);
          // Continue despite error since the vectors should be upserted already
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
   * @param includeVectors Whether to include vector data (default: false)
   * @returns Promise<Array<{id: string; vector?: number[]; payload: Record<string, any>;}>>
   */
  async getAllPoints(
    collectionName: string, 
    limit: number = 100, 
    includeVectors: boolean = false
  ): Promise<Array<{
    id: string;
    vector?: number[];
    payload: Record<string, any>;
  }>> {
    try {
      this.logger.info(`Getting all points from collection: ${collectionName} (limit: ${limit}, includeVectors: ${includeVectors})`);
      
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
        with_vector: includeVectors // Include vectors if requested
      });
      
      if (!response || !response.points) {
        this.logger.warn(`No points found in collection ${collectionName}`);
        return [];
      }
      
      this.logger.info(`Retrieved ${response.points.length} points from collection ${collectionName}`);
      
      return response.points.map(point => ({
        id: point.id as string,
        ...(includeVectors && point.vector ? { vector: point.vector as number[] } : {}),
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
    limit: number = 100  // Increased from 10 to 100
  ) {
    try {
      this.logger.debug(`Using textSearch method with text "${text}"`);
      
      // Normalize collection name
      const normalizedCollection = this.normalizeCollectionName(collection);
      
      // Check if collection exists
      const collectionExists = await this.collectionExists(normalizedCollection);
      if (!collectionExists) {
        this.logger.warn(`Collection ${normalizedCollection} does not exist for text search`);
        
        // Try alternatives
        const alternativeNames = [
          collection,
          `datasource_${collection}`,
          collection.startsWith('datasource_') ? collection.substring(11) : collection
        ];
        
        let foundAlternative = false;
        for (const altName of alternativeNames) {
          if (await this.collectionExists(altName)) {
            this.logger.info(`Found alternative collection for text search: ${altName}`);
            collection = altName;
            foundAlternative = true;
            break;
          }
        }
        
        if (!foundAlternative) {
          this.logger.warn(`No collection found for ${collection} or alternatives`);
          return [];
        }
      } else {
        collection = normalizedCollection;
      }
      
      // Generate embedding for the query
      const embeddings = await this.openaiService.createEmbeddings([text]);
      
      if (!embeddings || embeddings.length === 0) {
        this.logger.error(`Failed to create embeddings for text search query: ${text}`);
        return [];
      }
      
      // Use the embedding to search directly
      const searchResults = await this.search(
        collection,
        embeddings[0],
        filter,
        limit
      );
      
      // Convert to the expected format
      return searchResults.map(result => ({
        id: result.id,
        score: result.score,
        payload: {
          ...result.payload,
          text: result.payload?.text || result.payload?.content || '',
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
    // Default search parameters - more generous defaults
    const defaultAnalysis: QueryAnalysis = {
      queryType: 'semantic',
      complexity: 'low',
      needsExhaustiveResults: options.forceExhaustive || false,
      keywords: [],
      entities: [],
      limit: options.defaultLimit || 50, // Increased from 10 to 50
      scoreThreshold: 0.3, // Lowered from 0.7 to 0.3
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
    
    // Check for entity lookup queries
    const entityLookupPatterns = [
      /tell me about\s+(.+)/i,
      /information (on|about)\s+(.+)/i,
      /details (of|about)\s+(.+)/i,
      /who is\s+(.+)/i,
      /what is\s+(.+)/i,
      /describe\s+(.+)/i,
      /explain\s+(.+)/i,
      /show me\s+(.+)/i
    ];
    
    const isEntityLookup = entityLookupPatterns.some(pattern => pattern.test(lowerQuery));
    
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
    let queryType: 'semantic' | 'keyword' | 'hybrid' | 'count' | 'analytical' | 'entity_lookup' = 'semantic';
    
    if (isEntityLookup) {
      queryType = 'entity_lookup';
    } else if (isCountQuery) {
      queryType = 'count';
    } else if (isAnalytical) {
      queryType = 'analytical';
    } else if (wantsExactMatch) {
      queryType = 'keyword';
    } else if (keywords.length > 2) {
      queryType = 'hybrid';
    }
    
    // Determine search limits based on query type - use more generous limits
    let limit = options.defaultLimit || 50; // Higher default limit
    let needsExhaustiveResults = options.forceExhaustive || false;
    let scoreThreshold = 0.3; // Lower general threshold
    
    if (queryType === 'entity_lookup') {
      limit = 500; // Very high limit for entity lookup queries
      needsExhaustiveResults = true;
      scoreThreshold = 0.2; // Lower threshold for entity lookups
    } else if (queryType === 'count' || queryType === 'analytical') {
      limit = 500; // Larger limit for analytical queries
      needsExhaustiveResults = true;
      scoreThreshold = 0.2; // Lower threshold to get more results
    } else if (complexity === 'high') {
      limit = 100; // Increased from 20 to 100
      scoreThreshold = 0.25; // Lowered from 0.5 to 0.25
    } else if (complexity === 'medium') {
      limit = 50; // Increased from 15 to 50
      scoreThreshold = 0.3; // Lowered from 0.6 to 0.3
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

  /**
   * Get a sample of documents from a collection
   * This is useful for exploring collection contents
   * @param collectionName Name of the collection
   * @param limit Number of documents to retrieve (default: 10)
   * @returns Array of documents with payload
   */
  async getCollectionSample(collectionName: string, limit: number = 10): Promise<any[]> {
    try {
      this.logger.info(`Getting ${limit} sample documents from collection ${collectionName}`);
      
      // Create a random vector to get diverse results
      const randomVector = Array(VECTOR_DIMENSION).fill(0).map(() => Math.random() * 2 - 1);
      
      // Search with the random vector
      const results = await this.search(
        collectionName,
        randomVector,
        null,  // No filter
        limit
      );
      
      this.logger.info(`Retrieved ${results.length} sample documents from ${collectionName}`);
      
      return results.map(result => ({
        id: result.id,
        content: result.payload?.text || result.payload?.content || '',
        metadata: {
          ...result.payload?.metadata,
          id: result.id,
          score: result.score,
          collectionName
        }
      }));
    } catch (error) {
      this.logger.error(`Error retrieving sample from collection ${collectionName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Add points (vectors with payloads) to a collection
   * @param collectionName Name of the collection
   * @param points Array of points to add
   * @returns Promise resolving to the number of points added
   */
  async addPoints(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: any;
    }>
  ): Promise<number> {
    try {
      this.logger.info(`Adding ${points.length} points to collection ${collectionName}`);
      
      // Normalize collection name
      const normalizedName = this.normalizeCollectionName(collectionName);
      
      // Check if collection exists, create it if needed
      const exists = await this.collectionExists(normalizedName);
      if (!exists) {
        this.logger.info(`Collection ${normalizedName} does not exist, creating it`);
        await this.createCollection(normalizedName, {
          vectors: {
            size: VECTOR_DIMENSION,
            distance: 'Cosine'
          }
        });
      }
      
      // Use upsert because it's more robust - it will create or update points
      const result = await this.upsertVectors(normalizedName, points);
      
      this.logger.info(`Successfully added ${result.upserted} points to ${normalizedName}`);
      return result.upserted;
    } catch (error) {
      this.logger.error(`Error adding points to collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get information about a collection
   * @param collectionName Name of the collection
   * @returns Promise resolving to collection information
   */
  async getInfo(collectionName: string): Promise<any> {
    try {
      this.logger.info(`Getting info for collection ${collectionName}`);
      
      // Normalize collection name
      const normalizedName = this.normalizeCollectionName(collectionName);
      
      // Check if collection exists
      const exists = await this.collectionExists(normalizedName);
      if (!exists) {
        this.logger.warn(`Collection ${normalizedName} does not exist`);
        return null;
      }
      
      // Get collection info
      const info = await this.getCollectionInfo(normalizedName);
      return info;
    } catch (error) {
      this.logger.error(`Error getting info for collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Scroll through points in a collection with pagination
   * @param collectionName Name of the collection
   * @param limit Maximum number of points to return per page
   * @param offset Offset to continue from a previous scroll
   * @returns Points and pagination offset for next page
   */
  async scrollPoints(collectionName: string, limit: number = 100, offset: string | null = null, includeVectors: boolean = true): Promise<{
    points: Array<{
      id: string;
      vector: number[];
      payload?: any;
    }>;
    next_page_offset: string | null;
  }> {
    try {
      // Format the request body
      const requestBody: any = {
        limit,
        with_vectors: includeVectors
      };
      
      // Add offset if provided
      if (offset) {
        requestBody.offset = offset;
      }
      
      this.logger.info(`Scrolling points from ${collectionName} with limit ${limit}, offset ${offset}, includeVectors: ${includeVectors}`);
      
      const response = await axios.post(
        `${this.apiUrl}/collections/${collectionName}/points/scroll`,
        requestBody,
        { headers: this.headers }
      );
      
      if (response.data && response.data.result) {
        return {
          points: response.data.result.points || [],
          next_page_offset: response.data.result.next_page_offset
        };
      }
      
      return { points: [], next_page_offset: null };
    } catch (error) {
      this.logger.error(`Error scrolling points in collection ${collectionName}: ${error}`);
      return { points: [], next_page_offset: null };
    }
  }
} 