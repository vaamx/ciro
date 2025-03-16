import { QueryClassifierService, QueryType, QueryClassification } from './query-classifier.service';
import { QdrantService } from '../qdrant.service';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [QueryStrategySelector]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [QueryStrategySelector]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

/**
 * Strategy types for query execution
 */
export type StrategyType = 
  | 'semantic_search'
  | 'metadata_filter'
  | 'precomputed_aggregation'
  | 'full_scan_aggregation'
  | 'hybrid';

/**
 * Execution plan for a query
 */
export interface QueryExecutionPlan {
  filterConditions?: Record<string, any>;
  aggregationStage?: {
    function: string | null;
    targetField?: string;
  };
  parallelScan?: boolean;
  entityValue?: string;
  usePrecomputed?: boolean;
  includeMetadata?: boolean;
  [key: string]: any;
}

/**
 * Selected strategy for a query
 */
export interface QueryStrategy {
  strategyType: StrategyType;
  classification: QueryClassification;
  executionPlan: QueryExecutionPlan;
}

/**
 * Options for strategy selection
 */
export interface StrategyOptions {
  forceStrategy?: StrategyType;
  preferredStrategy?: StrategyType;
  requireExactMatch?: boolean;
  useParallelProcessing?: boolean;
  maxResults?: number;
  similarityThreshold?: number;
  dataSourceId?: number;
}

/**
 * Service for selecting the appropriate execution strategy for a query
 * based on its classification.
 */
export class QueryStrategySelector {
  private static instance: QueryStrategySelector | null = null;

  readonly STRATEGY_TYPE = {
    SEMANTIC_SEARCH: 'semantic_search' as StrategyType,
    METADATA_FILTER: 'metadata_filter' as StrategyType,
    PRECOMPUTED_AGGREGATION: 'precomputed_aggregation' as StrategyType,
    FULL_SCAN_AGGREGATION: 'full_scan_aggregation' as StrategyType,
    HYBRID: 'hybrid' as StrategyType
  };
  
  constructor(
    private queryClassifier: QueryClassifierService,
    private qdrantService: QdrantService,
  ) {}
  
  /**
   * Get the singleton instance of QueryStrategySelector
   */
  public static getInstance(): QueryStrategySelector {
    if (!QueryStrategySelector.instance) {
      const queryClassifier = QueryClassifierService.getInstance();
      const qdrantService = QdrantService.getInstance();
      QueryStrategySelector.instance = new QueryStrategySelector(queryClassifier, qdrantService);
    }
    return QueryStrategySelector.instance;
  }
  
  /**
   * Select the appropriate strategy for a query
   */
  async selectStrategy(query: string, options: StrategyOptions | number = {}): Promise<QueryStrategy> {
    // Handle the case where options is a number (legacy dataSourceId parameter)
    let dataSourceId: number | undefined;
    let strategyOptions: StrategyOptions = {};
    
    if (typeof options === 'number') {
      dataSourceId = options;
    } else {
      strategyOptions = options;
      // Extract dataSourceId from options if it exists
      if ('dataSourceId' in strategyOptions) {
        dataSourceId = typeof strategyOptions.dataSourceId === 'number' 
          ? strategyOptions.dataSourceId 
          : typeof strategyOptions.dataSourceId === 'string'
            ? parseInt(strategyOptions.dataSourceId, 10)
            : undefined;
      }
    }

    // 1. Classify the query
    const classification = await this.queryClassifier.classifyQuery(query);
    
    logger.info(`Query classified as: ${classification.type}`, {
      confidence: classification.confidence,
      aggregationFunction: classification.aggregationFunction,
      aggregationType: classification.aggregationType
    });
    
    // 2. Select appropriate strategy based on classification
    let strategy: StrategyType;
    let executionPlan: any = {};
    
    // If a strategy is forced, use it
    if (strategyOptions.forceStrategy) {
      strategy = strategyOptions.forceStrategy;
      logger.info(`Using forced strategy: ${strategy}`);
    } else {
      switch (classification.type) {
        case QueryType.AGGREGATION:
          // Check if we have a specific aggregation type and if precomputed data exists
          if (classification.aggregationType && dataSourceId) {
            const hasPrecomputed = await this.hasPrecomputedAggregation(
              dataSourceId,
              classification.aggregationType,
              classification.entities
            );
            
            if (hasPrecomputed) {
              logger.info(`Using precomputed aggregation: ${classification.aggregationType}`);
              strategy = this.STRATEGY_TYPE.PRECOMPUTED_AGGREGATION;
              executionPlan = {
                aggregationType: classification.aggregationType,
                entities: classification.entities
              };
              break;
            }
          }
          
          // Otherwise we need to scan and aggregate
          logger.info(`No precomputed aggregation found, using full scan aggregation`);
          strategy = this.STRATEGY_TYPE.FULL_SCAN_AGGREGATION;
          
          // Plan for parallel processing if table is large
          const targetEntity = classification.entities.product;
          if (targetEntity) {
            executionPlan.parallelScan = true;
            executionPlan.entityValue = targetEntity;
            executionPlan.aggregationFunction = classification.aggregationFunction;
            executionPlan.aggregationType = classification.aggregationType;
          }
          break;
          
        case QueryType.FILTER:
          // Use metadata filtering if the query has clear filter conditions
          if (Object.keys(classification.entities).length > 0) {
            strategy = this.STRATEGY_TYPE.METADATA_FILTER;
            executionPlan.filterConditions = this.buildFilterConditions(classification);
          } else {
            // Fall back to semantic search if filters aren't clear
            strategy = this.STRATEGY_TYPE.SEMANTIC_SEARCH;
          }
          break;
          
        case QueryType.HYBRID:
          // If it's a hybrid query with aggregation, check for precomputed first
          if (classification.aggregationType && dataSourceId) {
            const hasPrecomputed = await this.hasPrecomputedAggregation(
              dataSourceId,
              classification.aggregationType,
              classification.entities
            );
            
            if (hasPrecomputed) {
              logger.info(`Using precomputed aggregation for hybrid query: ${classification.aggregationType}`);
              strategy = this.STRATEGY_TYPE.PRECOMPUTED_AGGREGATION;
              executionPlan = {
                aggregationType: classification.aggregationType,
                entities: classification.entities
              };
              break;
            }
          }
          
          // Default hybrid strategy
          strategy = this.STRATEGY_TYPE.HYBRID;
          executionPlan = {
            filterStage: this.buildFilterConditions(classification),
            aggregationStage: {
              function: classification.aggregationFunction,
              targetField: this.determineTargetField(classification)
            }
          };
          break;
          
        default:
          strategy = this.STRATEGY_TYPE.SEMANTIC_SEARCH;
      }
    }
    
    return {
      strategyType: strategy,
      classification,
      executionPlan
    };
  }
  
  /**
   * Check if we have precomputed aggregation data for this query
   */
  private async hasPrecomputedAggregation(
    dataSourceId: number,
    aggregationType: string,
    entities: any
  ): Promise<boolean> {
    try {
      // Check if the collection exists
      const collectionName = `datasource_${dataSourceId}_aggregations`;
      const collectionExists = await this.qdrantService.collectionExists(collectionName);
      
      if (!collectionExists) {
        logger.info(`No aggregation collection exists for data source ${dataSourceId}`);
        return false;
      }
      
      // Build filter to check for matching aggregations
      const filter: any = {
        must: [
          { key: "type", match: { value: "aggregation" }},
          { key: "aggregationType", match: { value: aggregationType }}
        ]
      };
      
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
      
      // Check if there are any matching points
      // We need to:
      // 1. Create an embedding vector for the aggregation type
      // 2. Search for it with the filter
      
      // For simplicity, we'll just check if collection has any matching documents
      // This could be improved by creating a proper vector to search with
      
      // Create a dummy vector of the right dimension (1536 for OpenAI embeddings)
      const dummyVector = new Array(1536).fill(0).map(() => Math.random());
      
      const searchResults = await this.qdrantService.search(
        collectionName,
        dummyVector,
        filter,
        1 // limit
      );
      
      return searchResults && searchResults.length > 0;
    } catch (error) {
      logger.error('Error checking for precomputed aggregations', {
        error: error instanceof Error ? error.message : String(error),
        dataSourceId,
        aggregationType
      });
      return false;
    }
  }
  
  private buildFilterConditions(classification: QueryClassification): any {
    // Convert entities to filter conditions - more general approach
    const conditions: any = {};
    
    // If classification.entities is an object, process all keys dynamically
    if (classification.entities && typeof classification.entities === 'object') {
      // Include all entity types, not just hardcoded ones
      for (const [key, value] of Object.entries(classification.entities)) {
        if (value) {
          conditions[key] = value;
        }
      }
    } else if (Array.isArray(classification.entities)) {
      // Handle case where entities might be an array
      classification.entities.forEach(entity => {
        if (typeof entity === 'object' && entity.type && entity.value) {
          conditions[entity.type] = entity.value;
        }
      });
    }
    
    // Log the conditions for debugging
    logger.info(`Generated filter conditions: ${JSON.stringify(conditions)}`);
    
    return conditions;
  }
  
  private determineTargetField(classification: QueryClassification): string {
    // Figure out which field to aggregate based on the function and aggregation type
    if (classification.aggregationType === 'total_sales_by_product') {
      return 'total';
    }
    
    if (classification.aggregationType === 'total_quantity_by_product') {
      return 'quantity';
    }
    
    if (classification.aggregationType === 'average_price_by_product') {
      return 'price';
    }
    
    // Default behavior based on function
    if (classification.aggregationFunction === 'sum' || 
        classification.aggregationFunction === 'avg') {
      // For sum/avg, usually want quantity or value
      return 'value';
    }
    
    return 'id'; // Default for count
  }
}