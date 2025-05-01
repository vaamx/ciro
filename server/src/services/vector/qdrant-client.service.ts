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
    // Get connection timeout from config if available
    this.connectionTimeout = this.configService.get<number>('QDRANT_CONNECTION_TIMEOUT', 5000);
    
    this.logger.info(`QdrantClientService constructor: API URL set to ${this.apiUrl}`);
  }

  async onModuleInit(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this._initializeClient().catch(error => {
        this.logger.warn(`Qdrant initialization failed, but continuing: ${error.message}`);
        // Don't re-throw - let the app continue without Qdrant
        this.isInitialized = false;
        this.client = null;
      });
    }
    
    try {
      // Add timeout to prevent hanging
      await Promise.race([
        this.initializationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Qdrant connection timeout')), this.connectionTimeout)
        )
      ]);
    } catch (error: any) {
      this.logger.warn(`Qdrant client initialization timed out: ${error.message}`);
      // Don't re-throw - let the app continue without Qdrant
    }
  }

  private async _initializeClient(): Promise<void> {
    if (this.isInitialized) {
        return;
    }
    this.logger.info('Attempting to initialize Qdrant client in onModuleInit...');
    try {
      this.client = new QdrantClient({
        url: this.apiUrl,
        apiKey: this.apiKey
      });
      
      // Wrap connection check in a timeout
      const connectionSuccess = await Promise.race([
        this.checkConnection(),
        new Promise<boolean>((resolve) => 
          setTimeout(() => {
            this.logger.warn('Qdrant connection check timed out');
            resolve(false);
          }, this.connectionTimeout)
        )
      ]);

      if (!connectionSuccess) {
        this.logger.warn('Qdrant connection failed, but service will continue in limited mode');
        // We'll still mark as initialized but with null client
        this.isInitialized = true;
        return;
      }

      this.isInitialized = true;
      this.logger.info(`QdrantClientService initialized successfully in onModuleInit.`);
    } catch (error) {
      this.logger.error(`Failed to initialize Qdrant client during onModuleInit: ${error instanceof Error ? error.message : String(error)}`);
      this.client = null;
      this.isInitialized = false;
      throw new Error(`Qdrant client initialization failed: ${error instanceof Error ? error.message : String(error)}`);
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
   * Explicitly check the connection to the Qdrant server.
   */
  async checkConnection(): Promise<boolean> {
    if (!this.client) {
        this.logger.warn('Attempted to check connection before client was instantiated.');
        return false;
    }
    this.logger.info('Checking Qdrant connection...');
    try {
      await this.client.getCollections();
      this.logger.info('Qdrant connection successful.');
      return true;
    } catch (error) {
      this.logger.error(`Qdrant connection check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 