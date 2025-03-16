import * as winston from 'winston';
import { QueryClassifierService } from './query-classifier.service';
import { QueryStrategySelector, StrategyType, QueryStrategy } from './query-strategy-selector.service';
import { QdrantService } from '../qdrant.service';
import { OpenAIService } from '../openai.service';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [HybridSearchEngine]: ${message}`;
      return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [HybridSearchEngine]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

export interface QueryOptions {
  datasourceId?: number;
  collection?: string;
  limit?: number;
  includeMetadata?: boolean;
  includeSimilar?: boolean;
}

export interface QueryResult {
  results: any;
  executionDetails: {
    strategy: string;
    timings: Record<string, number>;
    confidence: number;
    error?: string;
    fallback?: boolean;
  };
}

export class HybridSearchEngine {
  private static instance: HybridSearchEngine;

  private constructor(
    private qdrantService: QdrantService,
    private openaiService: OpenAIService,
    private queryClassifier: QueryClassifierService,
    private strategySelector: QueryStrategySelector
  ) {}

  public static getInstance(): HybridSearchEngine {
    if (!HybridSearchEngine.instance) {
      HybridSearchEngine.instance = new HybridSearchEngine(
        QdrantService.getInstance(),
        OpenAIService.getInstance(),
        QueryClassifierService.getInstance(),
        new QueryStrategySelector(
          QueryClassifierService.getInstance(),
          QdrantService.getInstance()
        )
      );
    }
    return HybridSearchEngine.instance;
  }

  async executeQuery(query: string, options: QueryOptions = {}): Promise<QueryResult> {
    // 1. Select the appropriate strategy
    const strategy = await this.strategySelector.selectStrategy(query, options.datasourceId);
    
    // 2. Execute the strategy
    let results: any;
    let executionDetails: any = {
      strategy: strategy.strategyType,
      timings: {},
      confidence: strategy.classification.confidence
    };
    
    const startTime = Date.now();
    
    try {
      switch (strategy.strategyType) {
        case 'semantic_search':
          results = await this.executeSemantic(query, options);
          break;
          
        case 'metadata_filter':
          results = await this.executeMetadataFilter(query, strategy.executionPlan, options);
          break;
          
        case 'precomputed_aggregation':
          results = await this.executePrecomputed(query, strategy, options);
          break;
          
        case 'full_scan_aggregation':
          results = await this.executeFullScanAggregation(query, strategy, options);
          break;
          
        case 'hybrid':
          results = await this.executeHybrid(query, strategy.executionPlan, options);
          break;
          
        default:
          // Fall back to semantic search
          results = await this.executeSemantic(query, options);
      }
      
      executionDetails.timings.total = Date.now() - startTime;
      
      return {
        results,
        executionDetails
      };
    } catch (error) {
      // If strategy fails, fall back to semantic search
      logger.error(`Strategy ${strategy.strategyType} failed, falling back to semantic search`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      executionDetails.error = error instanceof Error ? error.message : String(error);
      executionDetails.fallback = true;
      
      results = await this.executeSemantic(query, options);
      executionDetails.timings.total = Date.now() - startTime;
      
      return {
        results,
        executionDetails
      };
    }
  }
  
  /**
   * Execute semantic search
   */
  private async executeSemantic(
    query: string, 
    options: QueryOptions
  ): Promise<any> {
    if (!options.datasourceId) {
      throw new Error('Data source ID is required for semantic search');
    }
    
    const collection = `datasource_${options.datasourceId}`;
    
    // Generate embedding for the query
    const queryEmbedding = await this.openaiService.createEmbeddings([query]);
    
    // Search for similar vectors
    const searchResults = await this.qdrantService.search(
      collection,
      queryEmbedding[0],
      undefined, // No filter
      options.limit || 10
    );
    
    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      text: result.payload.text,
      metadata: result.payload.metadata
    }));
  }
  
  /**
   * Execute metadata filter
   */
  private async executeMetadataFilter(
    query: string, 
    plan: any, 
    options: QueryOptions
  ): Promise<any> {
    if (!options.datasourceId) {
      throw new Error('Data source ID is required for metadata filter');
    }
    
    const collection = `datasource_${options.datasourceId}`;
    
    // Build filter from conditions
    const filter: any = { must: [] };
    
    // Add filter conditions
    if (plan.filterConditions) {
      for (const [key, value] of Object.entries(plan.filterConditions)) {
        filter.must.push({
          key: key,
          match: { value }
        });
      }
    }
    
    // Generate embedding for the query
    const queryEmbedding = await this.openaiService.createEmbeddings([query]);
    
    // Search with filter
    const searchResults = await this.qdrantService.search(
      collection,
      queryEmbedding[0],
      filter,
      options.limit || 10
    );
    
    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      text: result.payload.text,
      metadata: result.payload.metadata
    }));
  }
  
  /**
   * Execute a query using precomputed aggregation data
   * This method specifically handles queries that can use pre-computed aggregations
   */
  private async executePrecomputed(
    query: string, 
    strategy: QueryStrategy, 
    options: QueryOptions
  ): Promise<any[]> {
    logger.info('Executing precomputed aggregation strategy', { 
      executionPlan: strategy.executionPlan 
    });
    
    const aggregationType = strategy.executionPlan.aggregationType || 
                          strategy.executionPlan.aggregationStage?.function;
    const entities = strategy.classification.entities;
    
    if (!options.datasourceId && !options.collection) {
      throw new Error('Data source ID or collection name is required for precomputed aggregation queries');
    }
    
    // Find the most relevant aggregation for this query
    const collectionName = options.collection || 
                         `datasource_${options.datasourceId}_aggregations`;
    
    // Check if collection exists
    const collectionExists = await this.qdrantService.collectionExists(collectionName);
    if (!collectionExists) {
      logger.warn(`No aggregation collection exists: ${collectionName}`);
      // Fall back to full scan if no precomputed data
      return this.executeFullScanAggregation(query, strategy, options);
    }
    
    // Build filter to find the matching aggregation
    const filter: any = {
      must: [
        { key: "type", match: { value: "aggregation" }}
      ]
    };
    
    // Add aggregation type filter if available
    if (aggregationType) {
      filter.must.push({
        key: "aggregationType", 
        match: { value: aggregationType }
      });
    }
    
    // Add entity filters if available
    if (entities.product) {
      filter.must.push({
        key: "product", 
        match: { value: entities.product }
      });
    }
    
    if (entities.category) {
      filter.must.push({
        key: "category", 
        match: { value: entities.category }
      });
    }
    
    // Create query embedding
    const queryEmbedding = await this.openaiService.createEmbeddings([query]);
    
    // Search for matching aggregation
    const searchResults = await this.qdrantService.search(
      collectionName,
      queryEmbedding[0],
      filter,
      5 // Get top 5 matches
    );
    
    if (!searchResults || searchResults.length === 0) {
      logger.warn('No matching precomputed aggregation found, falling back to full scan');
      return this.executeFullScanAggregation(query, strategy, options);
    }
    
    // Get the best match
    const bestMatch = searchResults[0];
    
    // Check if the match is good enough
    if (bestMatch.score < 0.7) {
      logger.warn(`Low confidence match (${bestMatch.score}), falling back to full scan`);
      return this.executeFullScanAggregation(query, strategy, options);
    }
    
    // Extract the aggregation result
    const payload = bestMatch.payload;
    
    // Return the aggregation result
    const result = {
      id: bestMatch.id,
      score: bestMatch.score,
      value: payload.value,
      aggregationType: payload.aggregationType,
      subject: payload.subject,
      subjectId: payload.subjectId,
      lastUpdated: payload.lastUpdated,
      isPrecomputed: true,
      metadata: payload
    };
    
    logger.info(`Found precomputed aggregation: ${result.subject} ${result.aggregationType} = ${result.value}`);
    return [result];
  }
  
  /**
   * Execute full scan aggregation
   */
  private async executeFullScanAggregation(
    query: string, 
    strategy: QueryStrategy, 
    options: QueryOptions
  ): Promise<any> {
    // This would implement scanning and aggregating data on-the-fly
    // For now, return a simple result indicating this is not fully implemented
    return {
      value: 0,
      aggregationType: strategy.executionPlan.aggregationType || strategy.executionPlan.aggregationStage?.function,
      subject: strategy.classification.entities.product || "",
      isPrecomputed: false,
      needsImplementation: true,
      message: "Full scan aggregation not yet fully implemented"
    };
  }
  
  /**
   * Execute hybrid query (combining filtering and aggregation)
   */
  private async executeHybrid(
    query: string, 
    plan: any, 
    options: QueryOptions
  ): Promise<any> {
    // This would implement hybrid querying
    // For now, return a simple result indicating this is not fully implemented
    return {
      isHybrid: true,
      filterStage: plan.filterStage,
      aggregationStage: plan.aggregationStage,
      needsImplementation: true,
      message: "Hybrid query execution not yet fully implemented"
    };
  }
}

// Export singleton instance
export const hybridSearchEngine = HybridSearchEngine.getInstance(); 