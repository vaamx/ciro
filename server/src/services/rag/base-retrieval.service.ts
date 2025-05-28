import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';
import { EmbeddingService } from '../llm/embedding.service';
import { Document, RetrievalOptions, IBaseRetrievalService } from '../vector/vector.interfaces';
import { db } from '../../config/database';

/**
 * Extended options for retrieval with data source IDs
 */
interface ExtendedRetrievalOptions extends RetrievalOptions {
  dataSourceIds?: string[] | number[];
}

/**
 * Base retrieval service that implements common functionality
 * for retrieving documents from vector stores for RAG
 */
@Injectable()
export class BaseRetrievalService implements IBaseRetrievalService {
  protected readonly logger = createServiceLogger('BaseRetrievalService');
  
  constructor(
    protected readonly qdrantSearchService: QdrantSearchService,
    protected readonly embeddingService: EmbeddingService
  ) {
    this.logger.info('BaseRetrievalService initialized');
  }

  /**
   * Implements the IBaseRetrievalService interface
   * Retrieves documents based on the query
   */
  async retrieve(query: string, options: RetrievalOptions = {}): Promise<Document[]> {
    this.logger.info(`Retrieving documents for query: "${query.substring(0, 50)}..."`);
    
    // Get all available data sources
    let dataSourceIds: string[] = [];
    
    try {
      // Retrieve all active data sources from the database
      const dataSources = await db('data_sources')
        .select('id')
        .where('status', 'ready') // Only use ready data sources
        .orWhere('status', 'completed');
      
      dataSourceIds = dataSources.map(ds => String(ds.id));
    } catch (error) {
      this.logger.error('Failed to retrieve data sources:', error);
    }
    
    if (dataSourceIds.length === 0) {
      this.logger.warn('No data sources available for retrieval');
      return [];
    }
    
    // Retrieve documents from all sources
    const result = await this.retrieveDocumentsFromAllSources(query, dataSourceIds, options);
    return result.documents;
  }

  /**
   * Normalize collection name for Qdrant
   * @protected
   */
  protected normalizeCollectionName(dataSourceId: string): string {
    // If the ID starts with 'datasource_', use it directly
    if (dataSourceId.startsWith('datasource_')) {
      return dataSourceId;
    }
    
    // Otherwise, prepend 'datasource_'
    return `datasource_${dataSourceId}`;
  }

  /**
   * Retrieve documents from a single data source
   * @protected
   */
  protected async retrieveFromDataSource(
    dataSourceId: string,
    queryEmbedding: number[],
    options: RetrievalOptions
  ): Promise<{
    documents: Document[];
    collectionName: string;
  }> {
    try {
      // Normalize collection name
      const collectionName = this.normalizeCollectionName(dataSourceId);
      
      // Search in Qdrant using the search service
      const searchResults = await this.qdrantSearchService.search(
        collectionName,
        queryEmbedding,
        options.filter,
        options.limit,
        options.similarityThreshold
      );
      
      if (!searchResults || searchResults.length === 0) {
        this.logger.info(`No results found in collection ${collectionName}`);
        return { documents: [], collectionName };
      }
      
      // Get data source info
      const dataSource = await db('data_sources').where('id', dataSourceId).first();
      const dataSourceName = dataSource?.name || `Data Source ${dataSourceId}`;
      
      // Format results
      const documents: Document[] = searchResults.map(result => ({
        // Ensure id is always a string by providing a fallback ID
        id: (typeof result.id === 'string' || typeof result.id === 'number') 
          ? result.id.toString() 
          : `generated-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content: result.payload?.text || result.payload?.content || '',
        sourceId: dataSourceId,
        sourceName: dataSourceName,
        similarity: result.score,
        metadata: options.includeMetadata ? {
          ...result.payload?.metadata,
          similarity: result.score,
          dataSourceId,
          dataSourceName
        } : undefined
      }));
      
      this.logger.info(`Retrieved ${documents.length} documents from collection ${collectionName}`);
      
      return {
        documents,
        collectionName
      };
    } catch (error) {
      this.logger.error(`Error retrieving from data source ${dataSourceId}:`, error);
      return { documents: [], collectionName: '' };
    }
  }

  /**
   * Gets collections for data sources
   * @protected
   */
  protected async getCollectionsForDataSources(dataSourceIds: string[]): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    
    for (const dataSourceId of dataSourceIds) {
      result[dataSourceId] = [this.normalizeCollectionName(dataSourceId)];
    }
    
    return result;
  }

  /**
   * Retrieve documents from multiple data sources with standard approach
   * Common implementation shared between both retrieval services
   */
  async retrieveDocumentsFromAllSources(
    query: string,
    dataSourceIds: string[] | number[],
    options: RetrievalOptions = {}
  ): Promise<{
    documents: Document[];
    collectionNames: string[];
  }> {
    // Convert all dataSourceIds to strings for consistency
    const normalizedDataSourceIds = dataSourceIds.map(id => String(id));
    
    this.logger.info(`Retrieving documents for query: "${query.substring(0, 50)}..." from ${normalizedDataSourceIds.length} data sources`);
    
    if (normalizedDataSourceIds.length === 0) {
      return { documents: [], collectionNames: [] };
    }
    
    // Get embeddings for the query
    const queryEmbedding = await this.embeddingService.createEmbedding(query);
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
      this.logger.error('Failed to create embeddings for query');
      return { documents: [], collectionNames: [] };
    }
    
    // Set default options
    const {
      limit = 50,
      similarityThreshold = 0.3,
      includeMetadata = true,
      filter = undefined,
      requiresFullDataset = false
    } = options;
    
    // Handle full dataset queries differently
    if (requiresFullDataset || limit > 10000) {
      this.logger.info('Processing full dataset analytical query');
      // This will be implemented differently in subclasses
      return this.handleFullDatasetQuery(normalizedDataSourceIds, queryEmbedding, options);
    }
    
    // Fetch from all data sources in parallel
    const retrievalPromises = normalizedDataSourceIds.map(dataSourceId => 
      this.retrieveFromDataSource(dataSourceId, queryEmbedding, {
        limit,
        similarityThreshold,
        includeMetadata,
        filter
      })
    );
    
    const results = await Promise.all(retrievalPromises);
    
    // Combine results
    const allDocuments: Document[] = [];
    const allCollectionNames: string[] = [];
    
    for (const result of results) {
      if (result.documents.length > 0) {
        allDocuments.push(...result.documents);
        allCollectionNames.push(result.collectionName);
      }
    }
    
    // Sort by similarity
    allDocuments.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    // Limit the total number of documents
    const limitedDocuments = allDocuments.slice(0, limit);
    
    this.logger.info(`Retrieved ${limitedDocuments.length} documents from ${allCollectionNames.length} collections`);
    
    return {
      documents: limitedDocuments,
      collectionNames: allCollectionNames
    };
  }

  /**
   * Handle full dataset query - implemented by subclasses
   * @protected
   */
  protected async handleFullDatasetQuery(
    dataSourceIds: string[],
    queryEmbedding: number[],
    options: RetrievalOptions
  ): Promise<{
    documents: Document[];
    collectionNames: string[];
  }> {
    // Base implementation just returns empty results
    // This will be overridden by subclasses
    this.logger.warn('Base implementation called for handleFullDatasetQuery - should be overridden by subclasses');
    return {
      documents: [],
      collectionNames: []
    };
  }
} 