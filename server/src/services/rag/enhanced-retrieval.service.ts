import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';
import { EmbeddingService } from '../ai/embedding.service';
import { Document, RetrievalOptions } from '../vector/vector.interfaces';
import { BaseRetrievalService } from './base-retrieval.service';
import { db } from '../../config/database';

export interface RetrievalChunk {
  documents: Document[];
  chunkIndex: number;
  continuationToken: string | null;
  isLastChunk: boolean;
  progress: number;
}

export interface EnhancedRetrievalResult {
  documents: Document[];
  totalChunks: number;
  isComplete: boolean;
  meta: {
    query: string;
    dataSourceIds: string[];
    totalDocumentsRetrieved: number;
  };
}

/**
 * Enhanced Retrieval Service that extends the base RetrievalService
 * with chunking capabilities for handling large datasets
 */
@Injectable()
export class EnhancedRetrievalService extends BaseRetrievalService {
  protected override readonly logger = createServiceLogger('EnhancedRetrievalService');

  constructor(
    qdrantSearchService: QdrantSearchService,
    embeddingService: EmbeddingService
  ) {
    super(qdrantSearchService, embeddingService);
    this.logger.info('EnhancedRetrievalService initialized');
  }

  /**
   * Retrieves documents in chunks to handle large datasets efficiently
   * @param query Search query
   * @param dataSourceIds Data sources to search in
   * @param options Configuration options for chunked retrieval
   */
  async retrieveChunkedDocuments(
    query: string,
    dataSourceIds: string[] | number[],
    options: {
      chunkSize?: number;
      maxChunks?: number;
      minSimilarityScore?: number;
      onChunkRetrieved?: (chunk: RetrievalChunk) => Promise<void>;
    } = {}
  ): Promise<EnhancedRetrievalResult> {
    const {
      chunkSize = 1000,
      maxChunks = 10,
      minSimilarityScore = 0.3,
      onChunkRetrieved
    } = options;
    
    // Convert all dataSourceIds to strings for consistency
    const normalizedDataSourceIds = dataSourceIds.map(id => String(id));
    
    this.logger.info(`Starting chunked retrieval for query: "${query.substring(0, 50)}..." with chunk size: ${chunkSize}`);
    
    // Get query embedding once for all chunks
    const queryEmbedding = await this.embeddingService.createEmbedding(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Failed to create query embedding");
    }
    
    let allDocuments: Document[] = [];
    let continuationToken: string | null = null;
    let chunkCount = 0;
    
    do {
      // Fetch next chunk of documents
      this.logger.debug(`Fetching chunk ${chunkCount + 1} with token: ${continuationToken || 'INITIAL'}`);
      
      const chunkResult = await this.fetchDocumentChunk(
        normalizedDataSourceIds,
        queryEmbedding,
        chunkSize,
        continuationToken,
        minSimilarityScore
      );
      
      if (chunkResult.documents.length > 0) {
        allDocuments = [...allDocuments, ...chunkResult.documents];
        
        // Call progress callback if provided
        if (onChunkRetrieved) {
          await onChunkRetrieved({
            documents: chunkResult.documents,
            chunkIndex: chunkCount,
            continuationToken: chunkResult.continuationToken,
            isLastChunk: !chunkResult.continuationToken,
            progress: Math.min(1, (chunkCount + 1) / maxChunks)
          });
        }
        
        this.logger.debug(`Retrieved ${chunkResult.documents.length} documents in chunk ${chunkCount + 1}`);
      } else {
        this.logger.debug(`No documents found in chunk ${chunkCount + 1}, stopping retrieval`);
        break;
      }
      
      // Update for next iteration
      continuationToken = chunkResult.continuationToken;
      chunkCount++;
    } while (continuationToken && chunkCount < maxChunks);
    
    this.logger.info(`Completed chunked retrieval: ${allDocuments.length} total documents in ${chunkCount} chunks`);
    
    return {
      documents: allDocuments,
      totalChunks: chunkCount,
      isComplete: !continuationToken,
      meta: {
        query,
        dataSourceIds: normalizedDataSourceIds,
        totalDocumentsRetrieved: allDocuments.length
      }
    };
  }
  
  /**
   * Fetches a single chunk of documents
   * @param dataSourceIds Data source IDs to search
   * @param queryEmbedding Query embedding vector
   * @param limit Maximum documents to retrieve
   * @param continuationToken Token for pagination
   * @param minSimilarityScore Minimum similarity score
   */
  private async fetchDocumentChunk(
    dataSourceIds: string[],
    queryEmbedding: number[],
    limit: number,
    continuationToken: string | null,
    minSimilarityScore: number
  ): Promise<{
    documents: Document[];
    continuationToken: string | null;
  }> {
    try {
      // Parse continuation token if exists
      let offset = 0;
      let processedCollections: string[] = [];
      
      if (continuationToken) {
        try {
          const tokenData = JSON.parse(Buffer.from(continuationToken, 'base64').toString());
          offset = tokenData.offset || 0;
          processedCollections = tokenData.processedCollections || [];
        } catch (error) {
          this.logger.error(`Failed to parse continuation token: ${error instanceof Error ? error.message : String(error)}`);
          offset = 0;
          processedCollections = [];
        }
      }
      
      // Get collections for data sources
      const collectionsMap = await this.getCollectionsForDataSources(dataSourceIds);
      const collections = Object.values(collectionsMap).flat()
        .filter(collection => !processedCollections.includes(collection));
      
      if (collections.length === 0) {
        return { documents: [], continuationToken: null };
      }
      
      // Choose current collection to process
      const currentCollection = collections[0];
      
      // Perform vector search on current collection
      const searchResults = await this.qdrantSearchService.search(
        currentCollection,
        queryEmbedding,
        undefined, // filter
        limit,
        minSimilarityScore,
        offset
      );
      
      // Get data source info
      const dataSourceId = this.findDataSourceForCollection(currentCollection, collectionsMap);
      const dataSource = await db('data_sources').where('id', dataSourceId).first();
      const dataSourceName = dataSource?.name || `Data Source ${dataSourceId}`;
      
      // Convert search results to documents
      const documents: Document[] = searchResults.map(result => ({
        id: typeof result.id === 'string' || typeof result.id === 'number' 
          ? result.id.toString() 
          : `gen-${dataSourceId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        content: result.payload?.text || result.payload?.content || '',
        sourceId: dataSourceId,
        sourceName: dataSourceName,
        similarity: result.score,
        metadata: {
          ...(result.payload?.metadata || {}),
          collection: currentCollection,
          dataSourceId,
          dataSourceName,
          similarity: result.score
        }
      }));
      
      // Generate next continuation token
      let nextContinuationToken: string | null = null;
      
      if (searchResults.length >= limit) {
        // More results in current collection
        nextContinuationToken = Buffer.from(JSON.stringify({
          offset: offset + limit,
          processedCollections
        })).toString('base64');
      } else if (collections.length > 1) {
        // Move to next collection
        nextContinuationToken = Buffer.from(JSON.stringify({
          offset: 0,
          processedCollections: [...processedCollections, currentCollection]
        })).toString('base64');
      }
      
      return {
        documents,
        continuationToken: nextContinuationToken
      };
    } catch (error) {
      this.logger.error(`Error fetching document chunk: ${error instanceof Error ? error.message : String(error)}`);
      return { documents: [], continuationToken: null };
    }
  }
  
  /**
   * Gets the data source ID for a given collection
   */
  private findDataSourceForCollection(
    collection: string,
    collectionsMap: Record<string, string[]>
  ): string {
    for (const [dataSourceId, collections] of Object.entries(collectionsMap)) {
      if (collections.includes(collection)) {
        return dataSourceId;
      }
    }
    return '';
  }
  
  /**
   * Public method that wraps the chunked documents retrieval with progress tracking
   */
  async retrieveDocumentsWithProgress(
    query: string,
    dataSourceIds: string[] | number[],
    options: {
      chunkSize?: number;
      maxChunks?: number;
      minSimilarityScore?: number;
      onProgress?: (progress: number, documents: Document[]) => Promise<void>;
    } = {}
  ): Promise<Document[]> {
    const documents: Document[] = [];
    
    await this.retrieveChunkedDocuments(
      query,
      dataSourceIds,
      {
        chunkSize: options.chunkSize,
        maxChunks: options.maxChunks,
        minSimilarityScore: options.minSimilarityScore,
        onChunkRetrieved: async (chunk) => {
          documents.push(...chunk.documents);
          
          if (options.onProgress) {
            await options.onProgress(chunk.progress, [...documents]);
          }
        }
      }
    );
    
    return documents;
  }
  
  /**
   * Override the handleFullDatasetQuery method to implement chunking-based full dataset retrieval
   * @protected
   */
  protected override async handleFullDatasetQuery(
    dataSourceIds: string[],
    queryEmbedding: number[],
    options: RetrievalOptions
  ): Promise<{
    documents: Document[];
    collectionNames: string[];
  }> {
    // Use the chunking retrieval approach for full dataset queries
    const { limit = 10000, similarityThreshold = 0.3 } = options;
    
    const documents = await this.retrieveDocumentsWithProgress(
      "query", // We already have the embedding, so this is just a placeholder
      dataSourceIds,
      {
        chunkSize: Math.min(1000, limit),
        maxChunks: Math.ceil(limit / 1000),
        minSimilarityScore: similarityThreshold
      }
    );
    
    // Get unique collection names
    const collectionsMap = await this.getCollectionsForDataSources(dataSourceIds);
    const collectionNames = Object.values(collectionsMap).flat();
    
    // Sort by similarity and limit
    const sortedDocuments = documents
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);
    
    return { 
      documents: sortedDocuments,
      collectionNames
    };
  }
} 