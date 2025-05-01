import { DataSourceType } from '../../../types';

/**
 * Options for controlling the NL query execution.
 */
export interface NLQueryOptions {
  dataSourceType: DataSourceType; // Specify the target data source type
  dataSourceId?: number | string;  // ID of the specific data source connection (optional, but often needed)
  model?: string;                // Specify the LLM model to use (e.g., 'gpt-4o')
  temperature?: number;          // LLM temperature (0.0 - 1.0)
  maxTokens?: number;            // Max tokens for LLM response
  filterTables?: string[];       // Limit query generation to specific tables (optional)
  includeReasoning?: boolean;    // Whether to generate step-by-step reasoning (optional, default: false)
  useKnowledgeCollections?: boolean; // Whether to prioritize schema info from vector knowledge (optional, default: true)
  // Add other potential options like userId, custom prompts, etc.
}

/**
 * Represents the result of executing a natural language query.
 */
export interface NLQueryResult {
  sql: string; // The generated SQL query
  result: any; // The raw result from the database execution
  reasoning?: string; // Explanation of how the query was generated (optional)
  timing: { // Performance timing information
    total: number; // ms
    sqlGeneration: number; // ms
    execution: number; // ms
  };
  error?: string; // Error message if execution failed
}

/**
 * Interface for datasource-specific Natural Language Query execution strategies.
 */
export interface INLQueryStrategy {
  /**
   * Executes a natural language query against the specific data source.
   * 
   * @param query The natural language query string.
   * @param options Optional parameters to control query execution and generation.
   * @returns A promise resolving to the structured query result.
   */
  executeNaturalLanguageQuery(
    query: string,
    options?: NLQueryOptions
  ): Promise<NLQueryResult>;
  
  // Potentially add methods for schema retrieval specific to NLQ if needed,
  // although the core implementation might handle this internally.
  // getSchemaForNLQ?(options?: any): Promise<any>;
} 