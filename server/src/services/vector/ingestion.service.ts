import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantClientService } from './qdrant-client.service';
import { QdrantCollectionService } from './collection-manager.service';
import { 
  IQdrantVectorService,
  VectorPoint, 
  CollectionCreateOptions,
  SearchResultItem
} from '../vector/vector.interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for ingesting and managing vectors in Qdrant
 */
@Injectable()
export class QdrantIngestionService implements IQdrantVectorService {
  private readonly logger = createServiceLogger('QdrantIngestionService');
  private readonly clientService: QdrantClientService;
  private readonly collectionService: QdrantCollectionService;
  
  public constructor(
    private readonly qdrantClientService: QdrantClientService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    ) {
    this.logger.info('QdrantIngestionService initialized');
    this.clientService = this.qdrantClientService;
    this.collectionService = this.qdrantCollectionService;
  }

  /**
   * Implement the createCollection method required by IQdrantVectorService
   */
  async createCollection(collectionName: string, dimension: number): Promise<void> {
    try {
      const options: CollectionCreateOptions = {
        dimension,
        vectors: {
          size: dimension,
          distance: 'Cosine'
        },
        on_disk: true
      };
      
      await this.collectionService.createCollection(collectionName, options);
    } catch (error) {
      this.logger.error(`Error creating collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Implement the upsertPoints method required by IQdrantVectorService
   */
  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<void> {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    if (!points || points.length === 0) {
      throw new Error('Points are required');
    }

    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (!exists) {
        throw new Error(`Collection ${collectionName} does not exist`);
      }
      
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for upserting points to collection ${collectionName}`);
        throw new Error('QdrantClient is not available');
      }
      
      // Process in batches of 100
      const batchSize = 100;
      const batches = Math.ceil(points.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const batchPoints = points.slice(i * batchSize, (i + 1) * batchSize);
        
        await client.upsert(collectionName, {
          points: batchPoints
        });
        
        this.logger.info(`Upserted batch ${i + 1}/${batches} (${batchPoints.length} points) in collection ${collectionName}`);
      }
    } catch (error) {
      this.logger.error(`Error upserting vectors in collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Implement the search method required by IQdrantVectorService
   */
  async search(collectionName: string, vector: number[], limit: number = 10): Promise<SearchResultItem[]> {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    if (!vector || vector.length === 0) {
      throw new Error('Vector is required');
    }

    try {
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for searching in collection ${collectionName}`);
        return [];
      }
      
      // Pass search parameters as a single object (vector and limit)
      const searchParams = { vector, limit };
      const result = await client.search(collectionName, searchParams);
      
      return result.map(item => ({
        id: item.id.toString(),
        score: item.score,
        payload: item.payload || {}
      })) as SearchResultItem[];
    } catch (error) {
      this.logger.error(`Error searching vectors in collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Implement the delete method required by IQdrantVectorService
   */
  async delete(collectionName: string, filter: any): Promise<void> {
    if (!collectionName) {
      throw new Error('Collection name is required');
    }

    if (!filter) {
      throw new Error('Filter is required');
    }

    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (!exists) {
        throw new Error(`Collection ${collectionName} does not exist`);
      }
      
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for deleting from collection ${collectionName}`);
        throw new Error('QdrantClient is not available');
      }
      
      await client.delete(collectionName, {
        filter
      });
      
      this.logger.info(`Deleted vectors by filter from collection ${collectionName}`);
    } catch (error) {
      this.logger.error(`Error deleting vectors by filter from collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Store vectors in a collection
   * @param collectionName Collection name
   * @param vectors Array of vectors to store
   * @param payloads Array of payloads to store with vectors
   * @param ids Optional array of IDs for vectors
   * @returns Array of stored vector IDs
   */
  async storeVectors(
    collectionName: string,
    vectors: number[][],
    payloads: Record<string, any>[],
    ids?: (string | number)[]
  ): Promise<string[]> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return [];
    }

    if (!vectors || vectors.length === 0) {
      this.logger.error('Vectors are required');
      return [];
    }

    if (!payloads || payloads.length !== vectors.length) {
      this.logger.error('Payloads must be provided and match vectors length');
      return [];
    }

    try {
      // Ensure collection exists
      await this.ensureCollectionExists(collectionName, vectors[0].length);
      
      // Generate point IDs if not provided
      const pointIds = ids || vectors.map(() => Date.now() + Math.floor(Math.random() * 1000000));
      
      // Create points
      const points = vectors.map((vector, index) => ({
        id: pointIds[index].toString(),
        vector,
        payload: payloads[index] || {}
      }));
      
      // Upsert points
      await this.upsertVectors(collectionName, points);
      
      this.logger.info(`Stored ${vectors.length} vectors in collection ${collectionName}`);
      
      return pointIds.map(id => id.toString());
    } catch (error) {
      this.logger.error(`Error storing vectors in collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Upsert vectors in a collection
   * @param collectionName Collection name
   * @param points Points to upsert
   * @returns True if upsert was successful
   */
  async upsertVectors(
    collectionName: string,
    points: VectorPoint[]
  ): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    if (!points || points.length === 0) {
      this.logger.error('Points are required');
      return false;
    }

    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return false;
      }
      
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for upserting vectors to collection ${collectionName}`);
        return false;
      }
      
      // Process in batches of 100
      const batchSize = 100;
      const batches = Math.ceil(points.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const batchPoints = points.slice(i * batchSize, (i + 1) * batchSize);
        
        await client.upsert(collectionName, {
          points: batchPoints
        });
        
        this.logger.info(`Upserted batch ${i + 1}/${batches} (${batchPoints.length} points) in collection ${collectionName}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error upserting vectors in collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete vectors from a collection by ID
   * @param collectionName Collection name
   * @param ids Array of IDs to delete
   * @returns True if deletion was successful
   */
  async deleteVectors(
    collectionName: string,
    ids: (string | number)[]
  ): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    if (!ids || ids.length === 0) {
      this.logger.error('IDs are required');
      return false;
    }

    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return false;
      }
      
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for deleting vectors from collection ${collectionName}`);
        return false;
      }
      
      // Process in batches of 100
      const batchSize = 100;
      const batches = Math.ceil(ids.length / batchSize);
      
      for (let i = 0; i < batches; i++) {
        const batchIds = ids.slice(i * batchSize, (i + 1) * batchSize);
        
        await client.delete(collectionName, {
          points: batchIds
        });
        
        this.logger.info(`Deleted batch ${i + 1}/${batches} (${batchIds.length} points) from collection ${collectionName}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting vectors from collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete vectors from a collection by filter
   * @param collectionName Collection name
   * @param filter Filter to apply for deletion
   * @returns True if deletion was successful
   */
  async deleteVectorsByFilter(
    collectionName: string,
    filter: any
  ): Promise<boolean> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return false;
    }

    if (!filter) {
      this.logger.error('Filter is required');
      return false;
    }

    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist`);
        return false;
      }
      
      const client = this.clientService.getClient();
      if (!client) {
        this.logger.error(`QdrantClient is not available for deleting vectors by filter from collection ${collectionName}`);
        return false;
      }
      
      await client.delete(collectionName, {
        filter
      });
      
      this.logger.info(`Deleted vectors by filter from collection ${collectionName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting vectors by filter from collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Ensure a collection exists, creating it if necessary
   * @param collectionName Collection name
   * @param vectorSize Size of vectors to store
   * @returns True if collection exists or was created successfully
   */
  private async ensureCollectionExists(
    collectionName: string,
    vectorSize: number
  ): Promise<boolean> {
    try {
      // Check if collection exists
      const exists = await this.collectionService.collectionExists(collectionName);
      
      if (exists) {
        return true;
      }
      
      // Create collection
      const options: CollectionCreateOptions = {
        dimension: vectorSize,
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        },
        on_disk: true
      };
      
      return this.collectionService.createCollection(collectionName, options);
    } catch (error) {
      this.logger.error(`Error ensuring collection exists: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
} 