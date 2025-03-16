import * as winston from 'winston';
import { HybridSearchEngine, QueryOptions, QueryResult } from './hybrid-search-engine.service';
import { QueryClassifierService } from './query-classifier.service';
import { QueryStrategySelector, StrategyType, QueryStrategy, StrategyOptions } from './query-strategy-selector.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OpenAIService } from '../openai.service';
import { EnhancedMetadataService, DataSourceType } from '../metadata-extraction/enhanced-metadata-service';

/**
 * Integration options for RAG service
 */
export interface RAGIntegrationOptions {
  dataSourceId?: string | number;
  dataSourceType?: DataSourceType;
  collectionName?: string;
  enhancedMode?: boolean;
  model?: string;
  temperature?: number;
  enableHybridSearch?: boolean;
  enableAggregations?: boolean;
  maxResults?: number;
  conversationId?: string;
  useHistory?: boolean;
  customPrompt?: string;
  customSystemMessage?: string;
  forceStrategy?: string;
  skipStrategySelection?: boolean;
  requireExactMatch?: boolean;
}

/**
 * Result from the RAG integration
 */
export interface RAGIntegrationResult {
  answer: string;
  sources: any[];
  executionDetails: {
    model: string;
    strategy: string;
    timings: Record<string, number>;
    confidence: number;
    queryType?: string;
    aggregations?: {
      function?: string;
      value?: number;
      subject?: string;
    };
  };
  metadata?: Record<string, any>;
  selectedStrategy?: QueryStrategy;
}

// Create a logger using Winston directly
const createLogger = (serviceName: string): winston.Logger => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
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
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
};

// Define StrategyType enum values
const STRATEGY_TYPES = {
  SEMANTIC_SEARCH: 'semantic_search' as StrategyType,
  METADATA_FILTER: 'metadata_filter' as StrategyType,
  PRECOMPUTED_AGGREGATION: 'precomputed_aggregation' as StrategyType,
  FULL_SCAN_AGGREGATION: 'full_scan_aggregation' as StrategyType,
  HYBRID: 'hybrid' as StrategyType
};

/**
 * Service that integrates the Hybrid Search Engine with the RAG service
 * to provide enhanced query capabilities.
 */
export class RAGIntegrationService {
  private readonly logger = createLogger('RAGIntegrationService');
  private static instance: RAGIntegrationService | null = null;
  private strategySelector: QueryStrategySelector;

  private constructor(
    private hybridSearchEngine: HybridSearchEngine,
    private openaiService: OpenAIService,
    private queryClassifier: QueryClassifierService,
    strategySelector: QueryStrategySelector
  ) {
    this.logger.info('RAGIntegrationService initialized');
    this.strategySelector = strategySelector;
  }

  /**
   * Gets the singleton instance of the service
   */
  public static getInstance(): RAGIntegrationService {
    if (!RAGIntegrationService.instance) {
      const hybridSearchEngine = HybridSearchEngine.getInstance();
      const openaiService = OpenAIService.getInstance();
      const queryClassifier = QueryClassifierService.getInstance();
      const strategySelector = QueryStrategySelector.getInstance();

      RAGIntegrationService.instance = new RAGIntegrationService(
        hybridSearchEngine,
        openaiService,
        queryClassifier,
        strategySelector
      );
    }
    return RAGIntegrationService.instance;
  }

  /**
   * Execute a RAG query with enhanced capabilities
   */
  async executeRAGQuery(
    query: string,
    options: RAGIntegrationOptions = {}
  ): Promise<RAGIntegrationResult> {
    const startTime = Date.now();
    this.logger.info(`Executing enhanced RAG query: ${query}`);

    // Classify the query first for better understanding
    const classificationStartTime = Date.now();
    const classification = await this.queryClassifier.classifyQuery(query);
    const classificationTime = Date.now() - classificationStartTime;
    
    this.logger.info(`Query classified as ${classification.type} with confidence ${classification.confidence}`);

    // Explicitly select strategy using the QueryStrategySelector
    let selectedStrategy: QueryStrategy | undefined;
    let strategySelectionTime = 0;
    
    if (!options.skipStrategySelection) {
      const strategyStartTime = Date.now();
      
      try {
        // Configure strategy selection options
        const strategyOptions: StrategyOptions = {
          forceStrategy: options.forceStrategy as any,
          requireExactMatch: options.requireExactMatch,
          useParallelProcessing: options.enableHybridSearch !== false,
          maxResults: options.maxResults,
          dataSourceId: options.dataSourceId ? Number(options.dataSourceId) : undefined
        };
        
        // Select strategy based on query and classification
        selectedStrategy = await this.strategySelector.selectStrategy(query, strategyOptions);
        
        this.logger.info(`Selected strategy: ${selectedStrategy.strategyType}`);
      } catch (error) {
        this.logger.error(`Error selecting strategy: ${error}`);
        // Create a default strategy if selection fails
        selectedStrategy = {
          strategyType: 'semantic_search' as StrategyType,
          classification: classification,
          executionPlan: {}
        };
      }
      
      strategySelectionTime = Date.now() - strategyStartTime;
    }

    // Set up hybrid search options
    const queryOptions: QueryOptions = {
      datasourceId: options.dataSourceId ? Number(options.dataSourceId) : undefined,
      collection: options.collectionName,
      limit: options.maxResults || 5,
      includeMetadata: true
    };

    // Add additional properties using type assertion
    const extendedOptions = queryOptions as QueryOptions & {
      useParallelProcessing?: boolean;
      useStrategy?: string;
      customFilters?: Record<string, any>;
      dataSourceType?: DataSourceType;
    };

    extendedOptions.useParallelProcessing = options.enableHybridSearch !== false;
    extendedOptions.useStrategy = selectedStrategy?.strategyType || (options.forceStrategy as string);
    extendedOptions.dataSourceType = options.dataSourceType;

    // If we identified specific entities, add them as filters
    if (Object.keys(classification.entities).length > 0) {
      extendedOptions.customFilters = this.convertEntitiesToFilters(classification.entities);
    }

    // Execute query with the selected strategy
    let queryResult: QueryResult;
    const searchStartTime = Date.now();
    
    try {
      queryResult = await this.hybridSearchEngine.executeQuery(query, extendedOptions);
    } catch (error) {
      this.logger.error(`Error executing hybrid search: ${error}`);
      throw new Error(`Failed to execute hybrid search: ${error.message}`);
    }

    const searchTime = Date.now() - searchStartTime;
    this.logger.info(`Hybrid search completed in ${searchTime}ms with ${queryResult.results.length} results`);

    // Build context for LLM prompt with classification and strategy insights
    const context = this.buildEnhancedContext(
      query, 
      queryResult, 
      classification,
      selectedStrategy
    );

    // Generate answer from LLM
    const llmStartTime = Date.now();
    const answer = await this.generateAnswer(query, context, options);
    const llmTime = Date.now() - llmStartTime;

    // Format and return the result with classification and strategy data
    return {
      answer: answer,
      sources: this.formatSources(queryResult.results),
      executionDetails: {
        model: options.model || 'o3-mini',
        strategy: queryResult.executionDetails.strategy,
        timings: {
          classification: classificationTime,
          strategySelection: strategySelectionTime,
          search: searchTime,
          llm: llmTime,
          total: Date.now() - startTime
        },
        confidence: queryResult.executionDetails.confidence,
        queryType: classification.type,
        ...this.extractAggregations(queryResult)
      },
      metadata: {
        enhancedMetadata: true,
        classification: {
          type: classification.type,
          entities: classification.entities,
          complexity: classification.complexity,
          aggregationFunction: classification.aggregationFunction
        },
        strategyDetails: selectedStrategy ? {
          type: selectedStrategy.strategyType,
          executionPlan: selectedStrategy.executionPlan
        } : undefined,
        resultsCount: queryResult.results.length,
        ...queryResult.executionDetails
      },
      selectedStrategy: selectedStrategy
    };
  }

  /**
   * Directly select a strategy for a query - useful for testing different strategies
   */
  async selectQueryStrategy(
    query: string,
    options: {
      forceStrategy?: string;
      requireExactMatch?: boolean;
    } = {}
  ): Promise<QueryStrategy> {
    const classification = await this.queryClassifier.classifyQuery(query);
    
    // Select strategy based on the classification
    const strategyOptions: StrategyOptions = {
      forceStrategy: options.forceStrategy as any,
      requireExactMatch: options.requireExactMatch
    };
    
    return this.strategySelector.selectStrategy(query, strategyOptions);
  }

  /**
   * Convert entities from classification to filters for search
   */
  private convertEntitiesToFilters(entities: Record<string, string | undefined>): Record<string, any> {
    const filters: Record<string, any> = {};
    
    // Map entity types to filter fields
    for (const [key, value] of Object.entries(entities)) {
      if (value) {
        filters[key] = value;
      }
    }
    
    return filters;
  }

  /**
   * Build enhanced context with classification and strategy insights
   */
  private buildEnhancedContext(
    query: string, 
    queryResult: QueryResult, 
    classification: any,
    strategy?: QueryStrategy
  ): string {
    // Format search results into a context string
    let context = '';

    // Add query classification information
    context += `Query: ${query}\n`;
    context += `Query Type: ${classification.type}\n`;
    
    if (classification.aggregationFunction) {
      context += `Aggregation Function: ${classification.aggregationFunction}\n`;
    }
    
    if (Object.keys(classification.entities).length > 0) {
      context += `Identified Entities:\n`;
      for (const [key, value] of Object.entries(classification.entities)) {
        if (value) {
          context += `- ${key}: ${value}\n`;
        }
      }
    }
    
    // Add strategy information if available
    if (strategy) {
      context += `\nSelected Strategy: ${strategy.strategyType}\n`;
      
      if (strategy.executionPlan.aggregationStage) {
        context += `Aggregation: ${strategy.executionPlan.aggregationStage.function} on ${strategy.executionPlan.aggregationStage.targetField}\n`;
      }
      
      if (strategy.executionPlan.filterConditions) {
        context += `Filters: ${JSON.stringify(strategy.executionPlan.filterConditions)}\n`;
      }
    }
    
    context += `\n`;

    // Add search results
    context += `Search Results (${queryResult.results.length}):\n\n`;

    // Add each result as context
    queryResult.results.forEach((result, index) => {
      context += `Document ${index + 1}:\n`;
      context += `${result.content}\n\n`;
    });

    // If it's an aggregation result, add that specifically
    const aggregationResult = this.findAggregationResult(queryResult.results);
    if (aggregationResult) {
      context += `Aggregation Result:\n`;
      context += `Function: ${aggregationResult.aggregationType}\n`;
      context += `Subject: ${aggregationResult.subject}\n`;
      context += `Value: ${aggregationResult.value}\n\n`;
    }

    return context;
  }

  /**
   * Generate answer from LLM based on context
   */
  private async generateAnswer(
    query: string,
    context: string,
    options: RAGIntegrationOptions
  ): Promise<string> {
    // Create system message
    const systemMessage = options.customSystemMessage || 
      `You are an AI assistant that answers questions based on the provided information. 
      Only use the information from the search results to answer the question. 
      If you don't have enough information, say so. 
      If you find an exact numerical answer in an aggregation result, use that.
      Format your answer in a clear, concise way. Use markdown for formatting.`;

    // Create messages for the LLM
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: `Context Information:\n${context}\n\nUser Question: ${query}` }
    ];

    // Generate the answer
    const completion = await this.openaiService.generateChatCompletion(
      messages,
      {
        model: options.model || 'o3-mini',
        temperature: options.temperature || 0.3,
        max_tokens: 1000
      }
    );

    // Extract the answer text
    return completion.choices[0].message.content || 'No answer generated';
  }

  /**
   * Format sources for response
   */
  private formatSources(results: any[]): any[] {
    return results.map(result => ({
      content: result.content,
      metadata: result.metadata || {},
      score: result.score
    }));
  }

  /**
   * Detect the query type based on the result
   */
  private detectQueryType(queryResult: QueryResult): string {
    const strategy = queryResult.executionDetails.strategy;
    
    if (strategy.includes('aggregation')) {
      return 'AGGREGATION';
    } else if (strategy.includes('filter')) {
      return 'FILTER';
    } else if (strategy.includes('hybrid')) {
      return 'HYBRID';
    } else {
      return 'SEMANTIC';
    }
  }

  /**
   * Extract aggregation details if present
   */
  private extractAggregations(queryResult: QueryResult): { aggregations?: any } {
    // Look for aggregation results
    const aggregationResult = this.findAggregationResult(queryResult.results);
    
    if (aggregationResult) {
      return {
        aggregations: {
          function: aggregationResult.aggregationType,
          value: aggregationResult.value,
          subject: aggregationResult.subject
        }
      };
    }
    
    return {};
  }

  /**
   * Find aggregation result in results array
   */
  private findAggregationResult(results: any[]): any | null {
    // Look for a result with aggregationType and value properties
    return results.find(result => 
      result.aggregationType && 
      result.value !== undefined &&
      result.subject
    ) || null;
  }
} 