import { Injectable } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createServiceLogger } from '../../utils/logger-factory';
import { ConfigService } from '../../services/core/config.service';
import { QdrantConfig, IQdrantClientService } from './interfaces';

/**
 * Service for managing the Qdrant client instance and connection
 */
@Injectable()
export class QdrantClientService implements IQdrantClientService {
  private readonly logger = createServiceLogger('QdrantClientService');
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly client: QdrantClient;
  
  
  private static clientInitialized = false;
  private static constructorCallCount = 0;

  private constructor(
    private readonly configService: ConfigService,
    private readonly qdrantClientService: QdrantClientService,
    ) {
    QdrantClientService.constructorCallCount++;
    
    const configService = this.configService;
    this.apiUrl = configService.get('QDRANT_API_URL') || 'http://localhost:6333';
    this.apiKey = configService.get('QDRANT_API_KEY');
    
    this.logger.info(`QdrantClientService initialized with API URL: ${this.apiUrl}`);
    
    // Create Qdrant client
    try {
      if (!QdrantClientService.clientInitialized) {
        this.logger.info(`Initializing Qdrant client with URL: ${this.apiUrl}`);
        QdrantClientService.clientInitialized = true;
      }
      
      // Initialize the client
      this.client = new QdrantClient({
        url: this.apiUrl,
        apiKey: this.apiKey
      });
      
      if (QdrantClientService.instance) {
        this.logger.warn(`⚠️ Warning: QdrantClientService constructor called multiple times. Use this.qdrantClientService instead.`);
      } else if (QdrantClientService.constructorCallCount === 1) {
        this.logger.info(`Created singleton instance of QdrantClientService`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Qdrant client: ${error instanceof Error ? error.message : String(error)}`);
      // Create mock client for testing
      this.client = {
        getCollections: async () => ({ collections: [] }),
      } as any;
    }
  }

  /**
   * Get the singleton instance of QdrantClientService
   */
  

  /**
   * Get the number of times the constructor has been called
   */
  public static getConstructorCallCount(): number {
    return QdrantClientService.constructorCallCount;
  }

  /**
   * Get the Qdrant client instance
   */
  getClient(): QdrantClient {
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
} 