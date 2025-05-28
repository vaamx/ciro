import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { EmbeddingService } from '../llm/embedding.service';
import { 
  IQdrantSearchService, 
  SearchOptions, 
  SearchResultItem 
} from '../vector/vector.interfaces';
import { QdrantClientService } from './qdrant-client.service';
import { db } from '../../config/database';
import { normalizeCollectionName, combineFilters } from './utils';

/**
 * Abstract base class for search services, defining the core interface
 * and providing shared dependencies.
 */
@Injectable()
export abstract class BaseSearchService implements IQdrantSearchService {
  protected readonly logger = createServiceLogger('BaseSearchService');

  constructor(
    protected readonly qdrantClientService: QdrantClientService,
    protected readonly embeddingService: EmbeddingService
  ) {
    this.logger.info('BaseSearchService initialized');
  }

  /**
   * Check if a collection exists (implementation-specific).
   * @param collectionName Name of the collection
   * @returns True if the collection exists, false otherwise
   */
  public abstract collectionExists(collectionName: string): Promise<boolean>;
  
  /**
   * Perform a search (implementation-specific).
   * @param collectionName Name of the collection
   * @param vector Query vector
   * @param filter Optional filter criteria
   * @param limit Max number of results
   * @param scoreThreshold Minimum score threshold
   * @param offset Offset for pagination
   * @returns Array of search results
   */
  abstract search(
    collectionName: string,
    vector: number[],
    filter?: any, // Define a more specific type if possible
    limit?: number, 
    scoreThreshold?: number,
    offset?: number
  ): Promise<SearchResultItem[]>;

  /**
   * Perform a similarity search using vector embeddings
   * @param collectionName Name of the collection
   * @param embedding Vector embedding to search with
   * @param options Search options
   * @returns Array of search results
   */
  async similaritySearch(
    collectionName: string,
    embedding: number[],
    options?: SearchOptions
  ): Promise<SearchResultItem[]> {
    // Use the existing search method to implement similarity search
    return this.searchWithParams(collectionName, embedding, options || {});
  }

  /**
   * Upsert points into a collection (implementation-specific).
   * @param collectionName Name of the collection
   * @param points Array of points to upsert (Define a more specific type if possible)
   */
  abstract upsert(collectionName: string, points: any[]): Promise<void>;

  /**
   * Delete points from a collection (implementation-specific).
   * @param collectionName Name of the collection
   * @param points Array of point IDs to delete
   */
  abstract delete(collectionName: string, points: string[]): Promise<void>;
  
  /**
   * Search for vectors in a collection using full search options
   * @param collectionName Collection name
   * @param vector Vector to search for
   * @param options Search options
   * @returns Array of search results
   */
  async searchWithParams(
    collectionName: string,
    vector: number[],
    options: SearchOptions
  ): Promise<SearchResultItem[]> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return [];
    }

    if (!vector || vector.length === 0) {
      this.logger.error('Vector is required');
      return [];
    }

    try {
      const client = this.qdrantClientService.getClient();
      if (!client) {
        this.logger.warn('QdrantClient is not available');
        return [];
      }
      
      // Execute search with properties that match the client API
      const result = await client.search(collectionName, {
        vector,
        filter: options.filter,
        limit: options.limit || 10,
        offset: options.offset || 0,
        with_payload: options.with_payload !== false,
        with_vector: options.withVectors || options.with_vector || false,
        score_threshold: options.score_threshold,
        params: options.params
      });
      
      // Map results to consistent format
      const mappedResults: SearchResultItem[] = result.map(item => ({
        id: String(item.id),
        score: item.score,
        payload: item.payload || {},
        // Only include vector if it's a number array
        vector: Array.isArray(item.vector) && item.vector.every(n => typeof n === 'number') ? item.vector as number[] : undefined
      }));
      
      this.logger.info(`Found ${mappedResults.length} results in collection ${collectionName}`);
      
      return mappedResults;
    } catch (error) {
      this.logger.error(`Error searching in collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Search for multiple vectors in batch
   * @param collectionName Collection name
   * @param vectors Array of vectors to search for
   * @param filter Optional filter to apply to search
   * @param limit Maximum number of results per vector
   * @returns Array of search result arrays, one per input vector
   */
  async searchBatch(
    collectionName: string,
    vectors: number[][],
    filter?: any,
    limit: number = 10
  ): Promise<SearchResultItem[][]> {
    if (!collectionName) {
      this.logger.error('Collection name is required');
      return [];
    }

    if (!vectors || vectors.length === 0) {
      this.logger.error('Vectors are required');
      return [];
    }

    try {
      // Execute searches in parallel
      const searchPromises = vectors.map(vector => 
        this.search(collectionName, vector, filter, limit)
      );
      
      const results = await Promise.all(searchPromises);
      
      this.logger.info(`Completed batch search with ${vectors.length} queries in collection ${collectionName}`);
      
      return results;
    } catch (error) {
      this.logger.error(`Error in batch search for collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get collection name for a data source
   * @protected
   */
  protected getCollectionNameForDataSource(dataSourceId: string | number): string {
    return normalizeCollectionName(dataSourceId, 'datasource');
  }

  /**
   * Fetch data source info from database
   * @protected
   */
  protected async getDataSourceInfo(dataSourceId: string | number): Promise<{ name: string; type?: string }> {
    try {
      const dataSource = await db('data_sources').where('id', dataSourceId).first();
      return {
        name: dataSource?.name || `Data Source ${dataSourceId}`,
        type: dataSource?.type
      };
    } catch (error) {
      this.logger.error(`Error fetching data source info: ${error instanceof Error ? error.message : String(error)}`);
      return { name: `Data Source ${dataSourceId}` };
    }
  }

  /**
   * Convert search results to standardized document format
   * @protected
   */
  protected formatSearchResults(
    results: SearchResultItem[],
    dataSourceId: string | number,
    dataSourceName: string
  ): any[] {
    return results.map(result => ({
      id: typeof result.id === 'string' || typeof result.id === 'number' ? String(result.id) : undefined,
      content: result.payload?.text || result.payload?.content || '',
      sourceId: dataSourceId,
      sourceName: dataSourceName,
      similarity: result.score,
      metadata: {
        ...(result.payload?.metadata || {}),
        similarity: result.score,
        dataSourceId: String(dataSourceId),
        dataSourceName
      }
    }));
  }
} 