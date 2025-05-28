import { Injectable, Optional } from '@nestjs/common';
import { createServiceLogger } from '../../../../common/utils/logger-factory';
import { SnowflakeService, SnowflakeQueryResult } from '../../../datasources/connectors/snowflake/snowflake.service';
import { LLMService, ChatMessage } from '../../../llm';
import { QdrantClientService } from '../../../vector/qdrant-client.service';
import { ChunkingService } from '../../../rag/chunking.service';
import { SnowflakeSchemaIndexerService } from '../../../datasources/processors/schema/snowflake/snowflake-schema-indexer.service';
import { db } from '../../../../config/database';
import { v4 as uuidv4 } from 'uuid';

interface SchemaMetadata {
  database: string;
  schema: string;
  table: string;
  columns: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  description?: string;
  rowCount?: number;
  sampleData?: any[][];
}

interface NLQueryOptions {
  maxTokens?: number;
  temperature?: number;
  cacheResults?: boolean;
  includeReasoning?: boolean;
  model?: string;
  filterTables?: string[];
  useKnowledgeCollections?: boolean;
}

/**
 * Service for handling natural language queries against Snowflake
 * Leverages LLM abstraction layer for semantic understanding
 */
@Injectable()
export class SnowflakeNLQueryService {
  private readonly logger = createServiceLogger('SnowflakeNLQueryService');
  private readonly snowflakeService: SnowflakeService;
  
  constructor(
    private llmService: LLMService,
    private qdrantService: QdrantClientService,
    private chunkingService: ChunkingService,
    @Optional() private schemaIndexerService?: SnowflakeSchemaIndexerService
  ) {
    // Get the singleton instance of the connector service
    this.snowflakeService = SnowflakeService.getInstance();
  }
  
  /**
   * Execute a natural language query against Snowflake
   */
  async executeNaturalLanguageQuery(
    dataSourceId: number,
    query: string,
    options: NLQueryOptions = {}
  ): Promise<{
    sql: string;
    result: any;
    reasoning?: string;
    timing: {
      total: number;
      sqlGeneration: number;
      execution: number;
    }
  }> {
    const startTime = Date.now();
    this.logger.info(`Executing NL query for data source ${dataSourceId}: "${query}"`);
    
    try {
      let schemas: SchemaMetadata[] = [];
      
      // Determine how to get schema metadata
      if (options.useKnowledgeCollections !== false) {
        schemas = await this.getSchemaMetadataFromKnowledge(dataSourceId, options.filterTables);
        
        if (schemas.length === 0) {
          this.logger.info('No knowledge collections found, falling back to direct schema query');
          schemas = await this.getSchemaMetadata(dataSourceId, options.filterTables);
        }
      } else {
        schemas = await this.getSchemaMetadata(dataSourceId, options.filterTables);
      }
      
      // Generate SQL from natural language using LLM
      const sqlGenerationStart = Date.now();
      const sqlQuery = await this.generateSqlFromNaturalLanguage(query, schemas, options);
      const sqlGenerationTime = Date.now() - sqlGenerationStart;
      
      // Execute the generated SQL
      const executionStart = Date.now();
      const result = await this.snowflakeService.executeQuery(dataSourceId, sqlQuery);
      const executionTime = Date.now() - executionStart;
      
      // Generate reasoning if requested
      let reasoning = undefined;
      if (options.includeReasoning) {
        const resultArray = this.convertSnowflakeResultToArray(result);
        reasoning = await this.generateQueryReasoning(query, sqlQuery, resultArray);
      }
      
      const totalTime = Date.now() - startTime;
      return {
        sql: sqlQuery,
        result,
        ...(reasoning ? { reasoning } : {}),
        timing: {
          total: totalTime,
          sqlGeneration: sqlGenerationTime,
          execution: executionTime
        }
      };
    } catch (error: any) {
      this.logger.error(`Error executing NL query: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Convert SnowflakeQueryResult to array of records
   */
  private convertSnowflakeResultToArray(result: SnowflakeQueryResult): Record<string, any>[] {
    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }
    
    const records: Record<string, any>[] = [];
    for (const row of result.rows) {
      const record: Record<string, any> = {};
      for (let i = 0; i < result.columns.length; i++) {
        record[result.columns[i]] = row[i];
      }
      records.push(record);
    }
    
    return records;
  }
  
  /**
   * Get schema metadata from knowledge collections
   */
  private async getSchemaMetadataFromKnowledge(
    dataSourceId: number,
    filterTables?: string[]
  ): Promise<SchemaMetadata[]> {
    try {
      this.logger.info(`Getting schema metadata from knowledge collections for data source ${dataSourceId}`);
      
      const collectionName = `datasource_${dataSourceId}`;
      
      // Check if collection exists using QdrantClientService
      const collections = await this.qdrantService.listCollections();
      const collectionExists = collections.some((c: any) => c.name === collectionName);
      
      if (!collectionExists) {
        this.logger.warn(`No knowledge collection found for data source ${dataSourceId}`);
        return [];
      }
      
      this.logger.info(`Found knowledge collection for data source ${dataSourceId}: ${collectionName}`);
      
      // Search for schema-related content
      const searchResults = await this.qdrantService.search(
        collectionName, 
        Array(1536).fill(0.1), // dummy vector for search
        {
          must: [
            { key: 'source', match: { value: 'schema' } }
          ]
        } as any,
        50
      );
      
      // Convert search results to schema metadata
      const schemas: SchemaMetadata[] = [];
      for (const result of searchResults) {
        if (result.payload && result.payload.metadata) {
          const metadata = result.payload.metadata;
          if (metadata.table && metadata.columns) {
            schemas.push({
              database: metadata.database || 'UNKNOWN',
              schema: metadata.schema || 'UNKNOWN', 
              table: metadata.table,
              columns: metadata.columns,
              description: metadata.description,
              rowCount: metadata.rowCount,
              sampleData: metadata.sampleData
            });
          }
        }
      }
      
      // Apply table filtering if specified
      if (filterTables && filterTables.length > 0) {
        return schemas.filter(s => filterTables.includes(s.table));
      }
      
      return schemas;
    } catch (error: any) {
      this.logger.error(`Error getting schema metadata from knowledge: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get schema metadata directly from Snowflake
   */
  private async getSchemaMetadata(
    dataSourceId: number,
    filterTables?: string[]
  ): Promise<SchemaMetadata[]> {
    try {
      this.logger.info(`Getting schema metadata directly from Snowflake for data source ${dataSourceId}`);
      
      // Get table information
      let tablesQuery = `
        SELECT 
          table_catalog as database_name,
          table_schema as schema_name,
          table_name,
          comment as table_comment
        FROM information_schema.tables 
        WHERE table_type = 'BASE TABLE'
      `;
      
      if (filterTables && filterTables.length > 0) {
        const tableList = filterTables.map(t => `'${t}'`).join(',');
        tablesQuery += ` AND table_name IN (${tableList})`;
      }
      
      const tablesResult = await this.snowflakeService.executeQuery(dataSourceId, tablesQuery);
      
      const schemas: SchemaMetadata[] = [];
      
      for (const tableRow of tablesResult.rows) {
        const [database, schema, tableName, comment] = tableRow;
        
        // Get column information for this table
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            comment as column_comment
          FROM information_schema.columns 
          WHERE table_catalog = '${database}' 
            AND table_schema = '${schema}' 
            AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `;
        
        const columnsResult = await this.snowflakeService.executeQuery(dataSourceId, columnsQuery);
        
        const columns = columnsResult.rows.map(([name, type, columnComment]) => ({
          name,
          type,
          description: columnComment || undefined
        }));
        
        schemas.push({
          database,
          schema,
          table: tableName,
          columns,
          description: comment || undefined
        });
      }
      
      return schemas;
    } catch (error: any) {
      this.logger.error(`Error getting schema metadata: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate SQL from natural language using LLM
   */
  private async generateSqlFromNaturalLanguage(
    query: string,
    schemas: SchemaMetadata[],
    options: NLQueryOptions
  ): Promise<string> {
    const schemaContext = this.buildSchemaContext(schemas);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert SQL developer specializing in Snowflake. Your task is to convert natural language queries into valid Snowflake SQL.

Available Schema:
${schemaContext}

Guidelines:
1. Generate only valid Snowflake SQL syntax
2. Use proper table and column names from the schema
3. Include appropriate WHERE clauses, JOINs, and aggregations
4. Use Snowflake-specific functions when beneficial
5. Return only the SQL query, no explanations
6. Ensure the query is optimized and follows best practices`
      },
      {
        role: 'user',
        content: `Convert this natural language query to SQL: "${query}"`
      }
    ];

    const response = await this.llmService.generateChatCompletion(messages, {
      taskType: 'code_generation',
      taskComplexity: 'medium',
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 1000
    });

    // Extract SQL from response (remove any markdown formatting)
    let sql = response.content.trim();
    if (sql.startsWith('```sql')) {
      sql = sql.replace(/```sql\n?/, '').replace(/\n?```$/, '');
    } else if (sql.startsWith('```')) {
      sql = sql.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    return sql.trim();
  }
  
  /**
   * Build schema context for LLM prompt
   */
  private buildSchemaContext(schemas: SchemaMetadata[]): string {
    if (schemas.length === 0) {
      return 'No schema information available.';
    }
    
    return schemas.map(schema => {
      const columns = schema.columns.map(col => 
        `  ${col.name} (${col.type})${col.description ? ` -- ${col.description}` : ''}`
      ).join('\n');
      
      return `Table: ${schema.database}.${schema.schema}.${schema.table}
${schema.description ? `Description: ${schema.description}\n` : ''}Columns:
${columns}`;
    }).join('\n\n');
  }
  
  /**
   * Generate reasoning for the query execution
   */
  private async generateQueryReasoning(
    originalQuery: string,
    sqlQuery: string,
    results: Record<string, any>[]
  ): Promise<string> {
    const resultSummary = results.length > 0 
      ? `Found ${results.length} rows. Sample data: ${JSON.stringify(results.slice(0, 3))}`
      : 'No results found.';
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert data analyst. Explain how the SQL query addresses the natural language question and summarize the results.'
      },
      {
        role: 'user',
        content: `Original question: "${originalQuery}"

Generated SQL:
${sqlQuery}

Results: ${resultSummary}

Please explain:
1. How the SQL query addresses the original question
2. What the results tell us
3. Any insights or patterns in the data`
      }
    ];

    const response = await this.llmService.generateChatCompletion(messages, {
      taskType: 'simple_qa',
      taskComplexity: 'medium',
      temperature: 0.3,
      maxTokens: 500
    });

    return response.content;
  }
} 