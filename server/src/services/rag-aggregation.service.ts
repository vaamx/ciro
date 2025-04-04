import { createServiceLogger } from '../utils/logger-factory';
import { hybridSearchEngine, QueryOptions } from './query/hybrid-search-engine.service';
import { RagService } from './rag.service';

const logger = createServiceLogger('RagAggregationService');

/**
 * Enhanced RAG service with support for aggregation queries
 * This service extends the standard RAG service with specialized handling for
 * aggregation queries that can benefit from pre-computed data
 */
export class RagAggregationService {
  private ragService: RagService;

  constructor() {
    this.ragService = new RagService();
  }

  /**
   * Process a query that might benefit from pre-computed aggregations
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
      // Execute the query through the hybrid search engine
      const queryResult = await hybridSearchEngine.executeQuery(query, {
        datasourceId: dataSourceId,
        ...options
      });
      
      // Format the results based on type
      const { results, explanation } = this.formatAggregationResults(query, queryResult);
      
      return { results, explanation };
    } catch (error) {
      logger.error(`Error processing aggregation query: ${error}`);
      throw error;
    }
  }
  
  /**
   * Format results specifically for aggregation queries
   * @param query The original query
   * @param queryResult The result from the hybrid search engine
   */
  private formatAggregationResults(
    query: string,
    queryResult: any
  ): { results: any; explanation: string } {
    const { results, executionDetails } = queryResult;
    
    // For aggregation results (precomputed or full scan)
    if (executionDetails.strategy === 'precomputed_aggregation' || 
        executionDetails.strategy === 'full_scan_aggregation') {
      
      // Format aggregation result
      let formattedResult;
      let explanation;
      
      // If results is an array with one item (from executePrecomputed), use that
      const resultData = Array.isArray(results) && results.length > 0 ? results[0] : results;
      
      if (resultData.isPrecomputed) {
        formattedResult = {
          type: 'aggregation',
          aggregationType: resultData.aggregationType,
          subject: resultData.subject,
          value: resultData.value,
          confidence: executionDetails.confidence,
          precomputed: true,
          lastUpdated: resultData.lastUpdated
        };
        
        explanation = `This answer is based on pre-computed data from ${formattedResult.lastUpdated}. The system identified that you were asking for the ${formattedResult.aggregationType.replace(/_/g, ' ')} for ${formattedResult.subject}.`;
      } else {
        formattedResult = {
          type: 'aggregation',
          aggregationType: resultData.aggregationType || 'unknown',
          subject: resultData.subject || 'unknown',
          value: resultData.value || 0,
          confidence: executionDetails.confidence,
          precomputed: false
        };
        
        explanation = `This answer was calculated by analyzing the data that matches your query. The system identified that you were asking for the ${formattedResult.aggregationType.replace(/_/g, ' ')} for ${formattedResult.subject}.`;
      }
      
      if (resultData.needsImplementation) {
        explanation += " (Note: This feature is currently being implemented for better accuracy)";
      }
      
      return { results: formattedResult, explanation };
    }
    
    // For metadata filter results
    if (executionDetails.strategy === 'metadata_filter') {
      return {
        results,
        explanation: `Found ${results.length} results matching your specific criteria.`
      };
    }
    
    // For hybrid results
    if (executionDetails.strategy === 'hybrid') {
      return {
        results,
        explanation: `Combined filtering and calculation to analyze your data.`
      };
    }
    
    // Default for semantic search
    return {
      results,
      explanation: `Found ${results.length} results relevant to your query.`
    };
  }

  /**
   * Get the underlying RAG service for other operations
   */
  getRagService(): RagService {
    return this.ragService;
  }
}

// Export singleton instance
export const ragAggregationService = new RagAggregationService(); 