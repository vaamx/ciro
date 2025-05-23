import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantClientService } from './qdrant-client.service';
import { EmbeddingService } from '../ai/embedding.service';
import { BaseSearchService } from './base-search.service';
import { 
  SearchOptions, 
  SearchResultItem, 
  UpsertOptions, 
  PointsList, 
  PointItem
 } from '../vector/vector.interfaces';
import { normalizeCollectionName, combineFilters } from './utils';
import { QdrantClient, Schemas as QdrantSchemas } from '@qdrant/js-client-rest';

// Define the PointStruct type using the imported Schemas
type QdrantPointStruct = QdrantSchemas['PointStruct'];

/**
 * Service for searching vectors in Qdrant
 * Extends the base search service with Qdrant-specific functionality
 */
@Injectable()
export class QdrantSearchService extends BaseSearchService {
  // Create a service-specific logger
  protected override readonly logger = createServiceLogger('QdrantSearchService');

  constructor(
    qdrantClientService: QdrantClientService,
    embeddingService: EmbeddingService
  ) {
    super(qdrantClientService, embeddingService);
    this.logger.info('QdrantSearchService initialized');
  }

  /**
   * Check if a Qdrant collection exists.
   * @param collectionName The name of the collection.
   * @returns True if the collection exists, false otherwise.
   */
  public async collectionExists(collectionName: string): Promise<boolean> {
    const normalizedName = normalizeCollectionName(collectionName);
    try {
      this.logger.debug(`Checking existence of collection: ${normalizedName}`);
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return false;
      }
      
      const response = await client.getCollection(normalizedName);
      return !!response; 
    } catch (error: any) {
      // Handle specific error for 'not found' if available, otherwise log and assume false
      if (error?.status === 404 || error?.message?.includes('Not found')) {
        this.logger.warn(`Collection ${normalizedName} not found.`);
        return false;
      }
      this.logger.error(`Error checking collection existence for ${normalizedName}:`, error);
      // Re-throw for unexpected errors? Or return false? Returning false for safety.
      return false; 
    }
  }

  /**
   * Implements the search functionality using the Qdrant client.
   */
  async search(
    collectionName: string,
    vector: number[],
    filter?: any,
    limit: number = 50,
    scoreThreshold: number = 0.0,
    offset: number = 0
  ): Promise<SearchResultItem[]> {
    const normalizedName = normalizeCollectionName(collectionName);

    // Check existence first
    if (!(await this.collectionExists(normalizedName))) {
        this.logger.warn(`Attempted search on non-existent collection: ${normalizedName}`);
        return [];
    }

    const combinedFilter = combineFilters(
      {
        // Add default filters if needed by QdrantSearchService
      },
      filter
    );

    // Use a direct object instead of SearchOptions from interface for Qdrant client
    const searchParams = {
      vector,
      limit,
      offset,
      filter: combinedFilter,
      score_threshold: scoreThreshold,
      with_payload: true, // Ensure payload is returned
      with_vector: false, // Usually not needed in search results
    };

    try {
      this.logger.debug(
        `Searching collection ${normalizedName} with limit ${limit}, offset ${offset}, threshold ${scoreThreshold}`
      );
      
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return [];
      }
      
      const results = await client.search(
        normalizedName,
        searchParams,
      );
      
      // Map results to SearchResultItem format
      return results.map(hit => ({
        id: String(hit.id), // Ensure ID is string
        score: hit.score,
        payload: hit.payload as Record<string, unknown>,
        vector: Array.isArray(hit.vector) && hit.vector.every(n => typeof n === 'number') 
                  ? hit.vector as number[] 
                  : undefined,
      }));
    } catch (error) {
      this.logger.error(`Error searching collection ${normalizedName}:`, error);
      // Consider re-throwing or specific error handling
      return []; // Return empty on error for now
    }
  }

  /**
   * Implements the upsert functionality using the Qdrant client.
   */
  async upsert(
    collectionName: string,
    points: PointsList,
    options?: UpsertOptions
  ): Promise<void> {
    const normalizedName = normalizeCollectionName(collectionName);
    
    // Check existence first (optional, Qdrant upsert might create if not exists, depending on config)
    // if (!(await this.collectionExists(normalizedName))) {
    //     this.logger.warn(`Attempted upsert on non-existent collection: ${normalizedName}. Qdrant might create it.`);
    // }

    try {
      this.logger.debug(`Upserting ${points.length} points into collection ${normalizedName}`);
      
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        throw new Error('Qdrant client is not available');
      }
      
      // Map points to QdrantPointStruct format
      const qdrantPoints: QdrantPointStruct[] = points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      }));

      // Use parameters directly compatible with Qdrant client
      await client.upsert(normalizedName, {
        points: qdrantPoints,
        wait: true, // Default to waiting for consistency, not using options.wait since it's not in UpsertOptions
      });
      this.logger.info(`Successfully upserted ${points.length} points to ${normalizedName}`);
    } catch (error) {
      this.logger.error(`Error upserting into collection ${normalizedName}:`, error);
      // Consider re-throwing or specific error handling
      throw error; // Re-throw errors for upsert operations
    }
  }

  /**
   * Implements the delete functionality using the Qdrant client.
   */
  async delete(collectionName: string, pointIds: string[]): Promise<void> {
    const normalizedName = normalizeCollectionName(collectionName);

    // Check existence first
    if (!(await this.collectionExists(normalizedName))) {
        this.logger.warn(`Attempted delete on non-existent collection: ${normalizedName}`);
        return; // Can't delete from a non-existent collection
    }

    if (!pointIds || pointIds.length === 0) {
      this.logger.warn(`Delete operation called with no points for collection ${normalizedName}.`);
      return;
    }

    try {
      this.logger.debug(`Deleting ${pointIds.length} points from collection ${normalizedName}`);
      
      const client: QdrantClient | null = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        throw new Error('Qdrant client is not available');
      }
      
      // Try using client.delete() as seen in ingestion.service.ts
      await client.delete(normalizedName, {
        points: pointIds, 
      });
      this.logger.info(`Successfully deleted ${pointIds.length} points from ${normalizedName}`);
    } catch (error) {
      this.logger.error(`Error deleting points from collection ${normalizedName}:`, error);
      // Consider re-throwing or specific error handling
      throw error; // Re-throw errors for delete operations
    }
  }

  /**
   * Perform a hybrid search (vector + keyword)
   * @param collectionName Collection name
   * @param vector Vector to search for
   * @param keywords Keywords to search for in payload
   * @param keywordField Field in payload to search keywords in
   * @param limit Maximum number of results to return
   * @returns Array of search results
   */
  async hybridSearch(
    collectionName: string,
    vector: number[],
    keywords: string,
    keywordField: string = 'text',
    limit: number = 10
  ): Promise<SearchResultItem[]> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return [];
    }

    if (!vector || vector.length === 0) {
      this.logger.error('Vector is required');
      return [];
    }

    if (!keywords) {
      // Fall back to regular vector search if no keywords provided
      return this.search(collectionName, vector, undefined, limit);
    }

    try {
      // Create a filter that searches for keywords in the specified field
      const filter = {
        must: [
          {
            text: {
              [keywordField]: {
                match: {
                  text: keywords
                }
              }
            }
          }
        ]
      };
      
      // Execute search with keyword filter
      return this.search(collectionName, vector, filter, limit);
    } catch (error) {
      this.logger.error(`Error in hybrid search for collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get sample data from the Qdrant collection for code generation examples
   * @returns Sample data array
   */
  public async getSampleData(limit: number = 10): Promise<any[]> {
    try {
      // Assume 'default_collection' exists or handle appropriately
      const collectionName = 'default_collection'; 
      if (!(await this.collectionExists(collectionName))) {
          this.logger.warn(`Sample data collection '${collectionName}' not found. Returning fallback data.`);
          return [
              { id: 1, name: 'Sample Item 1', value: 100 },
              { id: 2, name: 'Sample Item 2', value: 200 },
              { id: 3, name: 'Sample Item 3', value: 300 },
          ];
      }
      
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return [
          { id: 1, name: 'Sample Item 1', value: 100 },
          { id: 2, name: 'Sample Item 2', value: 200 },
          { id: 3, name: 'Sample Item 3', value: 300 },
        ];
      }
      
      const response = await client.scroll(collectionName, {
          limit,
          with_payload: true
      });

      if (response && response.points && response.points.length > 0) {
          return response.points.map((point: any) => point.payload || {});
      }

      return [
          { id: 1, name: 'Sample Item 1', value: 100 },
          { id: 2, name: 'Sample Item 2', value: 200 },
          { id: 3, name: 'Sample Item 3', value: 300 },
      ];
    } catch (error) {
      this.logger.error(`Error retrieving sample data: ${error}`);
      return [
          { id: 1, name: 'Sample Item 1', value: 100 },
          { id: 2, name: 'Sample Item 2', value: 200 },
          { id: 3, name: 'Sample Item 3', value: 300 },
      ];
    }
  }
} 