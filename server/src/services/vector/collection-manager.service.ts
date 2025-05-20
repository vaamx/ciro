import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantClientService } from './qdrant-client.service';
import { 
  IQdrantCollectionService, 
  CollectionCreateOptions, 
  CollectionInfo 
} from '../vector/vector.interfaces';

/**
 * Service for managing Qdrant collections
 */
@Injectable()
export class QdrantCollectionService implements IQdrantCollectionService {
  private readonly logger = createServiceLogger('QdrantCollectionService');
  
  // Remove static instance for singleton pattern
  // private static instance: QdrantCollectionService | null = null;
  
  // Constructor already uses NestJS DI for QdrantClientService
  public constructor(
    private readonly qdrantClientService: QdrantClientService,
  ) {
    this.logger.info('QdrantCollectionService initialized via NestJS DI');
  }
  
  // Remove static getInstance method
  /*
  public static getInstance(): QdrantCollectionService {
    if (!QdrantCollectionService.instance) {
      // This call caused the compilation error because QdrantClientService.getInstance was removed
      const qdrantClientService = QdrantClientService.getInstance(); 
      QdrantCollectionService.instance = new QdrantCollectionService(qdrantClientService);
    }
    return QdrantCollectionService.instance;
  }
  */

  /**
   * Check if a collection exists
   * @param collectionName Collection name to check
   * @returns True if collection exists, false otherwise
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      const collections = await client.getCollections();
      const found = collections.collections.some(
        (collection) => collection.name === collectionName
      );
      this.logger.info(`Collection ${collectionName} exists: ${found}`);
      return found;
    } catch (error) {
      this.logger.error(`Error checking collection existence: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Create a new collection
   * @param collectionName Collection name
   * @param options Collection creation options
   * @returns True if collection was created successfully
   */
  async createCollection(
    collectionName: string,
    options: CollectionCreateOptions
  ): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    try {
      // Check if collection already exists
      const exists = await this.collectionExists(collectionName);
      
      if (exists) {
        this.logger.info(`Collection ${collectionName} already exists`);
        return true;
      }
      
      // Create the collection
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      await client.createCollection(collectionName, options);
      
      this.logger.info(`Collection ${collectionName} created with dimension ${options.dimension || (options.vectors?.size || 'unknown')}`);
      return true;
    } catch (error) {
      this.logger.error(`Error creating collection: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get collection information
   * @param collectionName Collection name
   * @returns Number of vectors in collection or -1 on error
   */
  async getCollectionInfo(collectionName: string): Promise<number> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return -1;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return -1;
      }
      
      const exists = await this.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return 0;
      }
      
      // Get collection information
      const collectionInfo = await client.getCollection(collectionName);
      
      if (collectionInfo && typeof collectionInfo.vectors_count === 'number') {
        this.logger.info(`Collection ${collectionName} has ${collectionInfo.vectors_count} vectors`);
        return collectionInfo.vectors_count;
      }
      
      this.logger.warn(`Could not retrieve vector count for collection ${collectionName}`);
      return 0;
    } catch (error) {
      this.logger.error(`Error getting collection info: ${error instanceof Error ? error.message : String(error)}`);
      return -1;
    }
  }

  /**
   * Get detailed collection info
   * @param collectionName Collection name
   * @returns Collection info object or null on error
   */
  async getDetailedCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return null;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return null;
      }
      
      const exists = await this.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return null;
      }
      
      // Get collection information
      const collectionInfo = await client.getCollection(collectionName);
      
      if (collectionInfo) {
        const vectorConfig = collectionInfo.config?.params?.vectors;
        
        return {
          name: collectionName,
          vectorCount: collectionInfo.vectors_count || 0,
          dimension: typeof vectorConfig?.size === 'number' ? vectorConfig.size : 0,
          metricType: typeof vectorConfig?.distance === 'string' ? vectorConfig.distance : 'Unknown',
          onDiskPayload: collectionInfo.config?.params?.on_disk_payload || false
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting detailed collection info: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Delete a collection
   * @param collectionName Collection name
   * @returns True if collection was deleted successfully
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      const exists = await this.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return true; // Already deleted, consider success
      }
      
      // Delete the collection
      await client.deleteCollection(collectionName);
      
      this.logger.info(`Collection ${collectionName} deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting collection: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * List all collections
   * @returns Array of collection names
   */
  async listCollections(): Promise<string[]> {
    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return [];
      }
      
      const response = await client.getCollections();
      
      const collections = response.collections?.map(collection => collection.name) || [];
      
      this.logger.debug(`Found ${collections.length} collections`);
      return collections;
    } catch (error) {
      this.logger.error(`Error listing collections: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Optimize a collection
   * @param collectionName Collection name
   * @returns True if collection was optimized successfully
   */
  async optimizeCollection(collectionName: string): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      const exists = await this.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return false;
      }
      
      // Update collection params for optimization
      // Note: This is an unofficial method - in actual implementation 
      // we would use the appropriate client method based on its API
      await client.updateCollection(collectionName, {
        optimizers_config: {
          indexing_threshold: 10000,
          memmap_threshold: 50000
        }
      });
      
      this.logger.info(`Collection ${collectionName} optimized`);
      return true;
    } catch (error) {
      this.logger.error(`Error optimizing collection: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Update collection parameters
   * @param collectionName Collection name
   * @param options Collection update options
   * @returns True if collection was updated successfully
   */
  async updateCollection(
    collectionName: string,
    options: Partial<CollectionCreateOptions>
  ): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      const exists = await this.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return false;
      }
      
      // Update collection params
      // Note: These are unofficial methods - in actual implementation
      // we would use the appropriate client methods based on its API
      await client.updateCollection(collectionName, options);
      
      this.logger.info(`Collection ${collectionName} updated`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating collection: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Reindex all collections to improve search performance
   * @returns True if all collections were successfully reindexed
   */
  async reindexAllCollections(): Promise<boolean> {
    try {
      const collections = await this.listCollections();
      this.logger.info(`Reindexing ${collections.length} collections`);
      
      if (collections.length === 0) {
        this.logger.info('No collections to reindex');
        return true;
      }
      
      let success = true;
      for (const collectionName of collections) {
        try {
          this.logger.info(`Reindexing collection: ${collectionName}`);
          const optimized = await this.optimizeCollection(collectionName);
          if (!optimized) {
            this.logger.warn(`Failed to optimize collection: ${collectionName}`);
            success = false;
          }
        } catch (error) {
          this.logger.error(`Error reindexing collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
          success = false;
        }
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Error reindexing collections: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 