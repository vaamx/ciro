import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';
import { OpenAIService } from '../ai/openai.service';
import { Document, RetrievalOptions } from './interfaces';
import { db } from '../../config/database';

/**
 * Service for retrieving relevant documents from vector stores
 * for RAG (Retrieval Augmented Generation)
 */
@Injectable()
export class RetrievalService {
  private readonly logger = createServiceLogger('RetrievalService');
  
  private qdrantSearchService: QdrantSearchService;
  private openaiService: OpenAIService;

  private constructor(
    private readonly qdrantSearchService: QdrantSearchService,
    private readonly openAIService: OpenAIService,
    ) {
    this.logger.info('RetrievalService initialized');
    this.qdrantSearchService = this.qdrantSearchService;
    this.openaiService = this.openAIService;
  }

  /**
   * Get the singleton instance of the service
   */
  

  /**
   * Retrieve documents from multiple data sources
   * @param query User query
   * @param dataSourceIds Array of data source IDs to search in
   * @param options Retrieval options
   * @returns Object containing documents and collection names
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
    const embeddings = await this.openaiService.createEmbeddings(query);
    
    if (!embeddings || embeddings.length === 0) {
      this.logger.error('Failed to create embeddings for query');
      return { documents: [], collectionNames: [] };
    }
    
    const queryEmbedding = embeddings[0];
    
    // Set default options
    const {
      limit = 10,
      similarityThreshold = 0.3,
      includeMetadata = true,
      filter = undefined
    } = options;
    
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
      collectionNames: [...new Set(allCollectionNames)]
    };
  }

  /**
   * Retrieve documents from a single data source
   * @param dataSourceId Data source ID
   * @param queryEmbedding Query embedding vector
   * @param options Retrieval options
   * @returns Object containing documents and collection name
   */
  private async retrieveFromDataSource(
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
      
      // Search in Qdrant using the new search service
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
        id: typeof result.id === 'string' || typeof result.id === 'number' ? result.id.toString() : undefined,
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
   * Normalize collection name for Qdrant
   * @param dataSourceId Data source ID
   * @returns Normalized collection name
   */
  private normalizeCollectionName(dataSourceId: string): string {
    // If the ID starts with 'datasource_', use it directly
    if (dataSourceId.startsWith('datasource_')) {
      return dataSourceId;
    }
    
    // Otherwise, prepend 'datasource_'
    return `datasource_${dataSourceId}`;
  }
} 