import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../utils/logger-factory';
import { QdrantSearchService } from '../vector/search.service';
import { QdrantCollectionService } from '../vector/collection-manager.service';
import { ChunkingService } from './chunking.service';

const logger = createServiceLogger('RagAggregationService');

/**
 * Query options interface
 */
export interface QueryOptions {
  limit?: number;
  filter?: Record<string, any>;
  threshold?: number;
  includeMetadata?: boolean;
  [key: string]: any;
}

/**
 * Enhanced RAG service with support for aggregation queries
 * This service handles specialized processing for queries that can benefit 
 * from aggregation over retrieved documents
 */
@Injectable()
export class RagAggregationService {
  private searchService: QdrantSearchService;
  private collectionService: QdrantCollectionService;
  private chunkingService: ChunkingService;
  

  private constructor(
    private readonly qdrantSearchService: QdrantSearchService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly chunkingService: ChunkingService,
    private readonly ragAggregationService: RagAggregationService,
    ) {
    this.searchService = this.qdrantSearchService;
    this.collectionService = this.qdrantCollectionService;
    this.chunkingService = this.chunkingService;
    logger.info('RagAggregationService initialized');
  }
  
  /**
   * Get singleton instance
   */
  

  /**
   * Process a query that might benefit from aggregations over retrieved data
   * @param query The user's query
   * @param dataSourceId The data source ID to query
   * @param options Additional query options
   */
  async processAggregationQuery(
    query: string,
    dataSourceId: number,
    options: QueryOptions = {}
  ): Promise<{ results: any; explanation: string }> {
    logger.info(`Processing aggregation query: ${query} for data source ${dataSourceId}`);
    
    try {
      // Normalize collection name
      const collectionName = `datasource_${dataSourceId}`;
      
      // Check if collection exists
      const collectionExists = await this.collectionService.collectionExists(collectionName);
      if (!collectionExists) {
        logger.warn(`Collection ${collectionName} does not exist`);
        return { 
          results: [], 
          explanation: `No data found for the specified data source (ID: ${dataSourceId})` 
        };
      }
      
      // Get query embedding if not explicitly provided (and query is not empty)
      const searchOptions = {
        limit: options.limit || 10,
        filter: options.filter || {},
        threshold: options.threshold || 0.7,
        includeMetadata: options.includeMetadata !== false
      };
      
      // Execute the query using the vector search service
      const searchResults = await this.searchService.search(
        collectionName,
        [] as number[], // Empty array instead of null for vector
        {
          ...searchOptions,
          filter: {
            ...searchOptions.filter,
            text: query // Add text to filter for keyword search
          }
        }
      );
      
      // Determine if this is an aggregation type query
      const isAggregation = this.isAggregationQuery(query);
      
      // Format results based on query type
      if (isAggregation) {
        return this.formatAggregationResults(query, {
          results: searchResults,
          executionDetails: {
            strategy: 'semantic_search_with_aggregation',
            confidence: 0.8
          }
        });
      } else {
        // Regular search results
        return {
          results: searchResults,
          explanation: `Found ${searchResults.length} results relevant to your query using vector search.`
        };
      }
    } catch (error) {
      logger.error(`Error processing aggregation query: ${error}`);
      throw error;
    }
  }
  
  /**
   * Check if a query is requesting aggregation
   */
  private isAggregationQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const aggregationKeywords = [
      'average', 'avg', 'mean', 'median', 
      'sum', 'total', 'count', 'how many',
      'maximum', 'max', 'highest', 'top',
      'minimum', 'min', 'lowest', 'bottom'
    ];
    
    return aggregationKeywords.some(keyword => lowerQuery.includes(keyword));
  }
  
  /**
   * Format results specifically for aggregation queries
   * @param query The original query
   * @param queryResult The result from search
   */
  private formatAggregationResults(
    query: string,
    queryResult: any
  ): { results: any; explanation: string } {
    const { results, executionDetails } = queryResult;
    
    // For now, we'll just wrap the results with some aggregation metadata
    // In a full implementation, we would compute aggregations over the retrieved documents
    
    // Simple aggregation algorithm (demonstrating the concept)
    let numericValues: number[] = [];
    let aggregationType = 'unknown';
    let subject = 'unknown';
    
    // Extract possible numeric values from the results
    if (Array.isArray(results)) {
      results.forEach(result => {
        if (result.payload && typeof result.payload === 'object') {
          // Extract numeric values from payloads
          Object.values(result.payload).forEach(value => {
            if (typeof value === 'number') {
              numericValues.push(value);
            } else if (typeof value === 'string') {
              // Try to parse numbers from strings
              const parsed = parseFloat(value);
              if (!isNaN(parsed)) {
                numericValues.push(parsed);
              }
            }
          });
        }
      });
    }
    
    // Determine aggregation type from query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('average') || lowerQuery.includes('avg') || lowerQuery.includes('mean')) {
      aggregationType = 'average';
    } else if (lowerQuery.includes('sum') || lowerQuery.includes('total')) {
      aggregationType = 'sum';
    } else if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      aggregationType = 'count';
    } else if (lowerQuery.includes('max') || lowerQuery.includes('highest') || lowerQuery.includes('top')) {
      aggregationType = 'maximum';
    } else if (lowerQuery.includes('min') || lowerQuery.includes('lowest') || lowerQuery.includes('bottom')) {
      aggregationType = 'minimum';
    }
    
    // Try to determine subject from query
    // This would require more sophisticated NLP in a real implementation
    const words = query.split(' ');
    subject = words.length > 2 ? words.slice(2).join(' ') : 'data';
    
    // Calculate the aggregation
    let value = 0;
    if (numericValues.length > 0) {
      switch (aggregationType) {
        case 'average':
          value = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
          break;
        case 'sum':
          value = numericValues.reduce((sum, val) => sum + val, 0);
          break;
        case 'count':
          value = numericValues.length;
          break;
        case 'maximum':
          value = Math.max(...numericValues);
          break;
        case 'minimum':
          value = Math.min(...numericValues);
          break;
        default:
          value = numericValues.length > 0 ? numericValues[0] : 0;
      }
    }
    
    // Format the result
    const formattedResult = {
      type: 'aggregation',
      aggregationType,
      subject,
      value,
      confidence: executionDetails.confidence,
      sourceCount: numericValues.length,
      precomputed: false
    };
    
    const explanation = `This answer was calculated by analyzing ${numericValues.length} values that match your query. The system identified that you were asking for the ${aggregationType.replace(/_/g, ' ')} for ${subject}.`;
    
    return { results: formattedResult, explanation };
  }
}

// Export singleton instance
export const ragAggregationService = this.ragAggregationService; 
