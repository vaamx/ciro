import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { ConfigService } from '@nestjs/config';
import { QdrantConfig, IQdrantClientService } from '../vector/vector.interfaces';

/**
 * Service for managing the Qdrant client instance and connection
 */
@Injectable()
export class QdrantClientService implements IQdrantClientService, OnModuleInit {
  private readonly logger = createServiceLogger('QdrantClientService');
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private client: QdrantClient | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly connectionTimeout: number = 5000; // 5 seconds timeout
  
  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('QDRANT_API_URL', 'http://localhost:6333');
    this.apiKey = this.configService.get<string | undefined>('QDRANT_API_KEY');
    this.connectionTimeout = this.configService.get<number>('QDRANT_CONNECTION_TIMEOUT', 5000);
    
    this.logger.info(`QdrantClientService constructor: API URL set to ${this.apiUrl}`);
    
    // Initialize client immediately in constructor instead of onModuleInit
    this.logger.info('>>> QDRANT_CLIENT_SERVICE: Initializing client in constructor...');
    this._initializeClientSync();
  }

  async onModuleInit(): Promise<void> {
    this.logger.info('>>> QDRANT_CLIENT_SERVICE: Entering onModuleInit...');
    
    try {
      if (!this.initializationPromise) {
        this.logger.info('>>> QDRANT_CLIENT_SERVICE: Creating initialization promise...');
        this.initializationPromise = Promise.resolve().then(() => {
          this._initializeClientSync();
        }).catch(error => {
          this.logger.warn(`Qdrant initialization failed, but continuing: ${error.message}`);
          this.isInitialized = false;
          this.client = null;
        });
      }
      
      this.logger.info('>>> QDRANT_CLIENT_SERVICE: About to wait for initialization with timeout...');
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('QdrantClientService onModuleInit timeout after 10 seconds'));
        }, 10000);
        return timeoutId;
      });
      
      // Race between initialization and timeout
      await Promise.race([this.initializationPromise, timeoutPromise]);
      
      this.logger.info('>>> QDRANT_CLIENT_SERVICE: onModuleInit completed successfully');
    } catch (error) {
      this.logger.error('>>> QDRANT_CLIENT_SERVICE: onModuleInit failed:', (error as Error).message);
      // Don't throw - allow the application to continue even if Qdrant fails to initialize
    }
  }

  private _initializeClientSync(): void {
    try {
      this.logger.info('>>> QDRANT_CLIENT_SERVICE: Creating QdrantClient synchronously...');
      
      this.client = new QdrantClient({
        url: this.apiUrl,
        apiKey: this.apiKey
      });
      
      this.isInitialized = true;
      this.logger.info('>>> QDRANT_CLIENT_SERVICE: QdrantClient created and initialized synchronously');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`>>> QDRANT_CLIENT_SERVICE: Failed to initialize synchronously: ${errorMessage}`);
      this.client = null;
      this.isInitialized = false;
    }
  }

  /**
   * Get the Qdrant client instance, ensuring it's initialized.
   * Returns null if initialization failed rather than throwing
   */
  getClient(): QdrantClient | null {
    if (!this.isInitialized) {
      this.logger.warn('Qdrant client accessed before initialization completed');
      return null;
    }
    return this.client;
  }

  /**
   * Get the API URL
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Check if an API key is configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Create a new client with the given configuration
   * Useful for tests or when you need a specific configuration
   */
  createClient(config: QdrantConfig): QdrantClient {
    return new QdrantClient({
      url: config.url,
      apiKey: config.apiKey
    });
  }

  /**
   * Create a collection in Qdrant
   * @param collectionName The name of the collection
   * @param dimension The dimension of the vectors
   */
  async createCollection(collectionName: string, dimension: number): Promise<void> {
    this.logger.info(`Creating collection ${collectionName} with dimension ${dimension}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`Cannot create collection ${collectionName}: Client unavailable`);
      return;
    }
    
    try {
      await client.createCollection(collectionName, {
        vectors: {
          size: dimension,
          distance: 'Cosine'
        }
      });
      this.logger.info(`Collection ${collectionName} created successfully`);
    } catch (error) {
      this.logger.error(`Failed to create collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw to prevent app failure, just log the error
    }
  }

  /**
   * Delete a collection in Qdrant
   * @param collectionName The name of the collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    this.logger.info(`Deleting collection ${collectionName}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`Cannot delete collection ${collectionName}: Client unavailable`);
      return;
    }
    
    try {
      await client.deleteCollection(collectionName);
      this.logger.info(`Collection ${collectionName} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw to prevent app failure, just log the error
    }
  }

  /**
   * List all collections in Qdrant
   */
  async listCollections(): Promise<string[]> {
    this.logger.info('Listing collections');
    const client = this.getClient();
    if (!client) {
      this.logger.warn('Cannot list collections: Client unavailable');
      return [];
    }
    
    try {
      const result = await client.getCollections();
      const collections = result.collections.map(collection => collection.name);
      this.logger.info(`Found ${collections.length} collections`);
      return collections;
    } catch (error) {
      this.logger.error(`Failed to list collections: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Upsert points into a collection
   * @param collectionName The name of the collection
   * @param points The points to upsert
   */
  async upsertPoints(collectionName: string, points: any[]): Promise<void> {
    if (!points || points.length === 0) {
      this.logger.warn(`No points provided for upserting into collection ${collectionName}`);
      return;
    }
    
    this.logger.info(`Upserting ${points.length} points into collection ${collectionName}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`Cannot upsert points into collection ${collectionName}: Client unavailable`);
      return;
    }
    
    try {
      await client.upsert(collectionName, { points });
      this.logger.info(`Points upserted successfully into collection ${collectionName}`);
    } catch (error) {
      this.logger.error(`Failed to upsert points into collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw to prevent app failure, just log the error
    }
  }

  /**
   * Search for similar vectors in a collection
   * @param collectionName The name of the collection
   * @param vector The query vector
   * @param limit Maximum number of results to return
   * @param filter Optional filter to apply
   */
  async search(collectionName: string, vector: number[], limit: number = 10, filter?: any): Promise<any[]> {
    this.logger.info(`Searching collection ${collectionName} with limit ${limit}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`Cannot search collection ${collectionName}: Client unavailable`);
      return [];
    }
    
    try {
      const result = await client.search(collectionName, {
        vector,
        limit,
        filter,
        with_payload: true
      });
      this.logger.info(`Found ${result.length} results in collection ${collectionName}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to search collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Retrieve specific points by their IDs from a collection.
   * @param collectionName The name of the collection.
   * @param ids An array of point IDs to retrieve.
   * @param withVector Whether to include the vector in the returned points
   */
  async retrievePoints(collectionName: string, ids: Array<string | number>, withVector: boolean = false): Promise<any[]> {
    this.logger.info(`Retrieving points with IDs [${ids.join(', ')}] from collection ${collectionName}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`Cannot retrieve points from ${collectionName}: Client unavailable`);
      return [];
    }
    
    try {
      if (typeof (client as any).getPoints === 'function') {
        const result = await (client as any).getPoints(collectionName, {
          ids: ids as any,
          with_payload: true,
          with_vector: withVector,
        });
        this.logger.info(`Retrieved ${result.length} points using getPoints from ${collectionName}.`);
        return result;
      } else if (typeof (client as any).retrieve === 'function') {
        const result = await (client as any).retrieve(collectionName, {
          ids: ids as any,
          with_payload: true,
          with_vector: withVector,
        });
        this.logger.info(`Retrieved ${result.length} points using retrieve from ${collectionName}.`);
        return result;
      } else {
        this.logger.error('Neither getPoints nor retrieve method is available on Qdrant client.');
        throw new Error('Point retrieval method not found on Qdrant client.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to retrieve points from ${collectionName}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check the connection to Qdrant by trying to list collections.
   * Throws an error if the connection cannot be established.
   */
  async checkConnection(): Promise<boolean> {
    if (!this.client) {
        this.logger.error('Cannot check Qdrant connection: client not instantiated.');
        throw new Error('Qdrant client not instantiated before connection check.');
    }
    this.logger.info('Checking Qdrant connection...');
    try {
      await this.client.getCollections();
      this.logger.info('Qdrant connection successful.');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Qdrant connection check failed: ${errorMessage}`);
      throw error;
    }
  }
} 