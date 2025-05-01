import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { INLQueryStrategy, NLQueryResult, NLQueryOptions } from './nl-query.strategy.interface';

// Injection token for the strategy map
export const NLQUERY_STRATEGY_MAP = 'NLQUERY_STRATEGY_MAP';

@Injectable()
export class NLQueryService {
  private readonly logger = new Logger(NLQueryService.name);

  constructor(
    // Inject a map where keys are dataSourceType (string) and values are INLQueryStrategy instances
    @Inject(NLQUERY_STRATEGY_MAP)
    private readonly strategyMap: Map<string, INLQueryStrategy>
  ) {
    this.logger.log(`NLQueryService initialized with ${this.strategyMap.size} strategies.`);
  }

  /**
   * Get the appropriate strategy for a given data source type.
   */
  private getStrategy(dataSourceType: string): INLQueryStrategy {
    // Note: We might need to map the primary DataSourceType enum/string 
    // to the specific key used in the map (e.g., 'snowflake')
    const strategy = this.strategyMap.get(dataSourceType.toLowerCase()); 
    if (!strategy) {
      this.logger.error(`No NL Query strategy found for data source type: ${dataSourceType}`);
      throw new NotFoundException(`Unsupported data source type for NL Query: ${dataSourceType}`);
    }
    return strategy;
  }

  /**
   * Executes a natural language query against a specific data source type.
   */
  async executeQuery(
    dataSourceType: string, 
    query: string, 
    // We pass the dataSourceId to the strategy if needed, but the core service 
    // only needs the type to select the strategy.
    // dataSourceId: number | string, 
    options?: NLQueryOptions
  ): Promise<NLQueryResult> {
    this.logger.log(`Executing NL Query for data source type: ${dataSourceType}, Query: "${query.substring(0, 50)}..."`);
    const strategy = this.getStrategy(dataSourceType);
    
    try {
      // Pass the specific dataSourceId to the strategy execution if the strategy needs it
      // For now, assuming the strategy handles ID retrieval or is passed it via options perhaps.
      return await strategy.executeNaturalLanguageQuery(query, options);
    } catch (error) {
        this.logger.error(`Strategy execution failed for ${dataSourceType}: ${error instanceof Error ? error.message : String(error)}`, error);
        // Return a structured error response
        return {
            sql: '', // No SQL generated or executed
            result: null,
            reasoning: 'Failed to execute query via strategy.',
            timing: { total: 0, sqlGeneration: 0, execution: 0 },
            error: error instanceof Error ? error.message : String(error),
        };
    }
  }
} 