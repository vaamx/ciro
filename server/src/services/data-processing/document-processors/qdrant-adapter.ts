import { Injectable } from '@nestjs/common';
/**
 * QdrantAdapter Service
 * 
 * This adapter provides compatibility between QdrantSearchService/QdrantCollectionService/QdrantIngestionService
 * and the older QdrantService interface expected by document processors.
 */

import { QdrantSearchService } from '../../vector/search.service';
import { QdrantCollectionService } from '../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../vector/ingestion.service';
import { QdrantClientService } from '../../vector/qdrant-client.service';
import { createServiceLogger } from '../../../utils/logger-factory';

/**
 * Adapter to provide QdrantService compatibility with the new services architecture
 */
@Injectable()
export class QdrantAdapter {
  private readonly logger = createServiceLogger('QdrantAdapter');
  private readonly searchService: QdrantSearchService;
  private readonly collectionService: QdrantCollectionService;
  private readonly ingestionService: QdrantIngestionService;
  private readonly clientService: QdrantClientService;
  
  
  private constructor(
    private readonly qdrantSearchService: QdrantSearchService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly qdrantIngestionService: QdrantIngestionService,
    private readonly qdrantClientService: QdrantClientService,
    ) {
    this.logger.info('QdrantAdapter initialized');
    this.searchService = this.qdrantSearchService;
    this.collectionService = this.qdrantCollectionService;
    this.ingestionService = this.qdrantIngestionService;
    this.clientService = this.qdrantClientService;
  }

  /**
   * Get the singleton instance of QdrantAdapter
   */
  
  
  /**
   * Get collection information
   */
  async getInfo(collectionName: string): Promise<any> {
    try {
      const info = await this.collectionService.getDetailedCollectionInfo(collectionName);
      if (info) {
        return {
          vectors_count: info.vectorCount,
          dimension: info.dimension,
          distance: info.metricType,
          on_disk_payload: info.onDiskPayload
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting collection info: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get all points from a collection
   */
  async getAllPoints(collectionName: string, limit: number = 1000): Promise<any[]> {
    try {
      const result = await this.searchService.search(collectionName, [], {
        limit,
        filter: {},
        with_payload: true,
        with_vectors: true
      });
      return result.map(item => ({
        id: item.id,
        vector: item.vector,
        payload: item.payload
      }));
    } catch (error) {
      this.logger.error(`Error getting all points: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Upsert vectors in a collection
   */
  async upsertVectors(collectionName: string, points: any[]): Promise<boolean> {
    try {
      return await this.ingestionService.upsertVectors(collectionName, points);
    } catch (error) {
      this.logger.error(`Error upserting vectors: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Add points to a collection
   */
  async addPoints(collectionName: string, points: any[]): Promise<boolean> {
    return this.upsertVectors(collectionName, points);
  }

  /**
   * Get raw client
   */
  getClient() {
    return this.clientService.getClient();
  }

  /**
   * Collection existence check (passthrough)
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    return this.collectionService.collectionExists(collectionName);
  }

  /**
   * Create collection (passthrough)
   */
  async createCollection(collectionName: string, options: any): Promise<boolean> {
    return this.collectionService.createCollection(collectionName, options);
  }

  /**
   * Get collection info (number of points/vectors)
   */
  async getCollectionInfo(collectionName: string): Promise<number> {
    try {
      return await this.collectionService.getCollectionInfo(collectionName);
    } catch (error) {
      this.logger.error(`Error getting collection info: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * Get client service adapter (for backwards compatibility)
   * Returns the adapter itself since it implements all needed methods
   */
  getClientServiceAdapter(): QdrantAdapter {
    return this;
  }
} 