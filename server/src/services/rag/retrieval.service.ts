import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';
import { EmbeddingService } from '../ai/embedding.service';
import { Document, RetrievalOptions } from '../vector/vector.interfaces';
import { BaseRetrievalService } from './base-retrieval.service';
import { db } from '../../config/database';

/**
 * Standard retrieval service for RAG (Retrieval Augmented Generation)
 * Specializes in full dataset retrieval using pagination
 */
@Injectable()
export class RetrievalService extends BaseRetrievalService {
  protected override readonly logger = createServiceLogger('RetrievalService');

  constructor(
    qdrantSearchService: QdrantSearchService,
    embeddingService: EmbeddingService
  ) {
    super(qdrantSearchService, embeddingService);
    this.logger.info('RetrievalService initialized');
  }

  /**
   * Override the handleFullDatasetQuery method to implement pagination-based full dataset retrieval
   * @protected
   */
  protected override async handleFullDatasetQuery(
    dataSourceIds: string[],
    queryEmbedding: number[],
    options: RetrievalOptions & {
      progressCallback?: (progress: { 
        totalProcessed: number; 
        dataSourceId: string; 
        isComplete: boolean;
        error?: string;
      }) => void;
    }
  ): Promise<{
    documents: Document[];
    collectionNames: string[];
  }> {
    const allDocuments: Document[] = [];
    const allCollectionNames = new Set<string>();
    
    this.logger.info(`Processing full dataset retrieval for ${dataSourceIds.length} data sources`);
    
    const batchSize = 1000; // Process in batches of 1000 records
    
    for (let i = 0; i < dataSourceIds.length; i++) {
      const dataSourceId = dataSourceIds[i];
      try {
        const collectionName = this.normalizeCollectionName(dataSourceId);
        allCollectionNames.add(collectionName);
        
        let offset = 0;
        let hasMoreData = true;
        let totalProcessedForSource = 0;
        
        // Get data source info
        const dataSource = await db('data_sources').where('id', dataSourceId).first();
        const dataSourceName = dataSource?.name || `Data Source ${dataSourceId}`;
        
        // Notify about starting this data source
        if (options.progressCallback) {
          options.progressCallback({
            totalProcessed: 0,
            dataSourceId,
            isComplete: false
          });
        }
        
        while (hasMoreData) {
          this.logger.info(`Retrieving batch from ${collectionName}, offset: ${offset}, limit: ${batchSize}`);
          
          // Search in Qdrant using pagination
          const searchResults = await this.qdrantSearchService.search(
            collectionName,
            queryEmbedding,
            options.filter,
            batchSize,
            options.similarityThreshold,
            offset
          );
          
          if (!searchResults || searchResults.length === 0) {
            hasMoreData = false;
            continue;
          }
          
          // Format and add results to the collection
          const batchDocuments: Document[] = searchResults.map(result => ({
            id: typeof result.id === 'string' || typeof result.id === 'number' 
              ? result.id.toString() 
              : `gen-${dataSourceId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
          
          allDocuments.push(...batchDocuments);
          
          // Update for next iteration
          offset += searchResults.length;
          totalProcessedForSource += searchResults.length;
          
          // Report progress
          if (options.progressCallback) {
            options.progressCallback({
              totalProcessed: totalProcessedForSource,
              dataSourceId,
              isComplete: false
            });
          }
          
          // If we got fewer results than the batch size, we've reached the end
          if (searchResults.length < batchSize) {
            hasMoreData = false;
            
            // Final progress update for this source
            if (options.progressCallback) {
              options.progressCallback({
                totalProcessed: totalProcessedForSource,
                dataSourceId,
                isComplete: true
              });
            }
          }
          
          this.logger.info(`Processed batch of ${searchResults.length} documents, total so far: ${allDocuments.length}`);
        }
      } catch (error) {
        this.logger.error(`Error retrieving full dataset from ${dataSourceId}:`, error);
        
        // Report error in progress
        if (options.progressCallback) {
          options.progressCallback({
            totalProcessed: -1, // -1 indicates error
            dataSourceId,
            isComplete: true,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    this.logger.info(`Completed full dataset retrieval with ${allDocuments.length} total documents`);
    
    return {
      documents: allDocuments,
      collectionNames: Array.from(allCollectionNames)
    };
  }
} 