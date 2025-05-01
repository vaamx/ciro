import { Injectable, Logger } from '@nestjs/common';
import { INLQueryStrategy, NLQueryResult, NLQueryOptions } from '../nl-query.strategy.interface';
import { DataSourceType } from '../../../../types'; // Corrected import path again

// Required Service Imports (adjust paths as needed based on actual locations)
import { createServiceLogger } from '../../../../common/utils/logger-factory'; // Adjust path
import { SnowflakeService } from '../../../datasources/connectors/snowflake/snowflake.service'; // Adjust path
import { OpenAIService } from '../../../ai/openai.service'; // Adjust path
import { QdrantSearchService } from '../../../vector/search.service'; // Adjust path
import { QdrantCollectionService } from '../../../vector/collection-manager.service'; // Adjust path
import { ChunkingService } from '../../../rag/chunking.service'; // Adjust path
// Assuming schema indexer is also moved or available via a different path
import { SnowflakeSchemaIndexerService } from '../../../datasources/processors/schema/snowflake-schema/snowflake-schema-indexer.service'; // Adjust path
import { v4 as uuidv4 } from 'uuid';

// Interfaces moved or imported from fixed-snowflake-nl-query.service.ts
interface SchemaMetadata {
  database: string;
  schema: string;
  table: string;
  columns: {
    name: string;
    type: string;
    description?: string;
  }[];
  description?: string;
  rowCount?: number;
  sampleData?: any[][];
}

@Injectable()
export class SnowflakeNLQueryStrategy implements INLQueryStrategy {
  private readonly logger = createServiceLogger('SnowflakeNLQueryStrategy');

  // Inject dependencies needed by the logic moved from the old service
  constructor(
    private snowflakeService: SnowflakeService,
    private openaiService: OpenAIService,
    private qdrantSearchService: QdrantSearchService,
    private qdrantCollectionService: QdrantCollectionService,
    private chunkingService: ChunkingService, // Assuming ChunkingService is needed for schema description processing
    private schemaIndexerService: SnowflakeSchemaIndexerService // Needed for schema discovery
  ) {}

  /**
   * Execute a natural language query against Snowflake.
   * Logic moved from fixed-snowflake-nl-query.service.ts.
   */
  async executeNaturalLanguageQuery(
    query: string, 
    // Use string literal for default dataSourceType
    options: NLQueryOptions = { dataSourceType: 'snowflake' } 
  ): Promise<NLQueryResult> {
    const startTime = Date.now();
    // Explicitly require dataSourceId via options for clarity, or handle error if missing
    const dataSourceIdInput = (options as any).dataSourceId;
    if (dataSourceIdInput === undefined || dataSourceIdInput === null) {
      this.logger.error({ level: 'error', message: 'dataSourceId is required in options for SnowflakeNLQueryStrategy' });
      throw new Error('dataSourceId is required in options for SnowflakeNLQueryStrategy');
    }
    // Ensure dataSourceId is a number
    const dataSourceId = typeof dataSourceIdInput === 'string' ? parseInt(dataSourceIdInput, 10) : dataSourceIdInput;
    if (isNaN(dataSourceId)) {
        this.logger.error({ level: 'error', message: `Invalid dataSourceId received: ${dataSourceIdInput}` });
        throw new Error(`Invalid dataSourceId received: ${dataSourceIdInput}`);
    }
    
    // Use LogEntry format for logger
    this.logger.log({ level: 'info', message: `Executing NL query for Snowflake source ${dataSourceId}: "${query}"` });

    try {
      let schemas: SchemaMetadata[] = [];
      const collectionName = `datasource_${dataSourceId}`; // Use numeric ID
      const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);

      if (options.useKnowledgeCollections !== false && collectionExists) {
        schemas = await this.getSchemaMetadataFromKnowledge(dataSourceId, collectionName, options.filterTables);
        if (schemas.length === 0) {
          this.logger.info({ level: 'info', message: `No knowledge found in ${collectionName}, falling back to direct query for source ${dataSourceId}` });
          schemas = await this.getSchemaMetadataDirectly(dataSourceId, options.filterTables);
        }
      } else {
        schemas = await this.getSchemaMetadataDirectly(dataSourceId, options.filterTables);
      }

      if (schemas.length === 0) {
        throw new Error('Could not retrieve schema metadata for query generation.');
      }
      
      const sqlGenerationStart = Date.now();
      const sqlQuery = await this.generateSqlFromNaturalLanguage(query, schemas, options);
      const sqlGenerationTime = Date.now() - sqlGenerationStart;
      
      const executionStart = Date.now();
      // Pass numeric dataSourceId
      const result = await this.snowflakeService.executeQuery(dataSourceId, sqlQuery); 
      const executionTime = Date.now() - executionStart;
      
      let reasoning = undefined;
      if (options.includeReasoning) {
        reasoning = await this.generateQueryReasoning(query, sqlQuery, result);
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
      this.logger.error({ level: 'error', message: `Error executing Snowflake NL query for source ${dataSourceId}: ${error.message}`, error });
       return { // Return structured error
            sql: 'ERROR',
            result: null,
            reasoning: `Failed during strategy execution: ${error.message}`,
            timing: { total: Date.now() - startTime, sqlGeneration: 0, execution: 0 },
            error: error.message,
        };
    }
  }

  // --- Helper methods moved and adapted from fixed-snowflake-nl-query.service.ts --- 

  private async getSchemaMetadataFromKnowledge(
    dataSourceId: number, 
    collectionName: string,
    filterTables?: string[]
  ): Promise<SchemaMetadata[]> {
     this.logger.debug({ level: 'debug', message: `Getting schema from knowledge collection: ${collectionName}` });
     const dummyVector = Array(1536).fill(0.1); // Assuming OpenAI embeddings
     const baseFilter = {
        must: [
            { key: 'source', match: { value: 'snowflake' } },
            // Ensure dataSourceId matches if stored in payload
            // { key: 'dataSourceId', match: { value: dataSourceId } }, 
        ]
     };

     // Fetch tables
     const tableResponse = await this.qdrantSearchService.search(collectionName, dummyVector, {
        ...baseFilter,
        must: [...baseFilter.must, { key: 'sourceType', match: { value: 'table' } }],
        filter: {
            must: [
                { key: 'sourceType', match: { value: 'table' } }
            ]
        }
     } as any, 100);

    const tableMetadataMap = new Map<string, SchemaMetadata>();
    tableResponse.forEach((result: any) => {
        const p = result.payload;
        const tableKey = `${p.database}.${p.schema}.${p.table}`;
        if ((!filterTables || filterTables.includes(p.table)) && !tableMetadataMap.has(tableKey)) {
            tableMetadataMap.set(tableKey, {
                database: p.database,
                schema: p.schema,
                table: p.table,
                description: p.description || '',
                columns: []
            });
        }
    });

    // Fetch columns for relevant tables
    const columnResponse = await this.qdrantSearchService.search(collectionName, dummyVector, {
        ...baseFilter,
        must: [...baseFilter.must, { key: 'sourceType', match: { value: 'column' } }],
        filter: {
            must: [
                { key: 'sourceType', match: { value: 'column' } }
            ]
        }
    } as any, 1000); // Fetch more columns

    columnResponse.forEach((result: any) => {
        const p = result.payload;
        const tableKey = `${p.database}.${p.schema}.${p.table}`;
        const tableMeta = tableMetadataMap.get(tableKey);
        if (tableMeta) {
            tableMeta.columns.push({
                name: p.column,
                type: p.columnType,
                description: p.description || ''
            });
        }
    });

    return Array.from(tableMetadataMap.values());
  }

  private async getSchemaMetadataDirectly(
    dataSourceId: number,
    filterTables?: string[]
  ): Promise<SchemaMetadata[]> {
    this.logger.debug({ level: 'debug', message: `Getting schema directly for source ${dataSourceId}` });
    // This requires SnowflakeService to have methods like listDatabases, listSchemas, listTables, describeTable
    // Assuming these exist based on previous Forms strategy
    const databases = await this.snowflakeService.listDatabases(dataSourceId);
    const allMetadata: SchemaMetadata[] = [];

    for (const dbName of databases) {
      const schemaNames = await this.snowflakeService.listSchemas(dataSourceId, dbName);
      for (const schName of schemaNames) {
        const tableNames = await this.snowflakeService.listTables(dataSourceId, dbName, schName);
        for (const tblName of tableNames) {
           if (!filterTables || filterTables.includes(tblName)) {
               try {
                  const columnsRaw = await this.snowflakeService.describeTable(dataSourceId, dbName, schName, tblName);
                  const columns = columnsRaw.map((c: any) => ({ 
                      name: c.name, 
                      type: c.type, 
                      description: this.inferColumnDescription(c.name, c.type)
                  }));
                  allMetadata.push({
                      database: dbName,
                      schema: schName,
                      table: tblName,
                      columns,
                      description: this.inferTablePurpose({tableName: tblName, columns })
                  });
               } catch (tableError: any) {
                   this.logger.warn({ level: 'warn', message: `Could not describe table ${dbName}.${schName}.${tblName}`, error: tableError });
               }
           }
        }
      }
    }
    return allMetadata;
  }

  // --- generateSqlFromNaturalLanguage --- 
  // (Requires significant adaptation potentially, imports ChatMessage?)
  // This needs careful review of dependencies like OpenAIService method signatures.
  private async generateSqlFromNaturalLanguage(
    query: string,
    schemas: SchemaMetadata[],
    options: NLQueryOptions
  ): Promise<string> {
      this.logger.info({ level: 'info', message: 'Generating SQL from natural language query...' });
      const model = options.model || 'gpt-4o'; // Use a powerful model
      const temperature = options.temperature ?? 0.1; // Low temperature for determinism

      // Construct a detailed prompt with schema information
      let prompt = `Given the following Snowflake database schemas:\n\n`;
      schemas.forEach(schema => {
          prompt += `Table: ${schema.database}.${schema.schema}.${schema.table}\n`;
          if (schema.description) {
              prompt += `  Description: ${schema.description}\n`;
          }
          prompt += `  Columns:\n`;
          schema.columns.forEach(col => {
              prompt += `    - ${col.name} (${col.type})${col.description ? ': ' + col.description : ''}\n`;
          });
          prompt += '\n';
      });

      prompt += `Generate a SINGLE, syntactically correct Snowflake SQL query that answers the following natural language question:\n\nQuestion: "${query}"\n\nConsider the following constraints:\n- Only use tables and columns listed above.\n- Ensure correct Snowflake SQL syntax.\n- If the question involves calculations or joins, implement them correctly.\n- If a specific table is mentioned or clearly implied, prioritize using it.\n- Do not include any explanations, comments, or markdown formatting. Output ONLY the raw SQL query.\n\nSQL Query:`;

      this.logger.debug({ level: 'debug', message: `Generated SQL prompt (length: ${prompt.length})` });

      // Use OpenAIService (ensure method signature matches)
      try {
          // Assuming OpenAIService has a method like generateText or similar
          // Adjust based on the actual OpenAIService implementation
          const messages = [{ role: 'user', content: prompt }];
          const response = await this.openaiService.generateChatCompletion(messages as any, { // Use type assertion carefully
              model: model,
              temperature: temperature,
          });

          const responseData = await response.json() as any; // Use type assertion carefully
          let generatedSql = responseData?.content?.trim() || '';

          // Basic cleanup: remove potential markdown code blocks
          generatedSql = generatedSql.replace(/^```(?:sql)?\s*|\s*```$/g, '').trim();
          
          if (!generatedSql) {
              throw new Error('LLM failed to generate SQL query.');
          }

          this.logger.info({ level: 'info', message: `Generated SQL: ${generatedSql.substring(0, 100)}...` });
          return generatedSql;
      } catch (error: any) {
          this.logger.error({ level: 'error', message: 'Error generating SQL from LLM', error });
          throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : String(error)}`);
      }
  }

  // --- inferTablePurpose --- (Helper function)
  private inferTablePurpose(table: { tableName: string; columns: Array<{ name: string }>; rowCount?: number; }): string {
    const name = table.tableName.toLowerCase();
    const cols = table.columns.map(c => c.name.toLowerCase());

    if (name.includes('sale') || name.includes('order') || name.includes('transaction')) return 'Sales or Order Data';
    if (name.includes('customer') || name.includes('user')) return 'Customer or User Information';
    if (name.includes('product') || name.includes('item')) return 'Product or Item Catalog';
    if (name.includes('inventory') || name.includes('stock')) return 'Inventory or Stock Levels';
    if (name.includes('log') || name.includes('event')) return 'Log or Event Data';
    if (cols.includes('address') && cols.includes('city')) return 'Location or Address Data';
    if (cols.includes('start_date') && cols.includes('end_date')) return 'Date Range or Event Timing Data';

    return 'General Data Table';
  }
  
  // --- inferColumnDescription --- (Helper function)
  private inferColumnDescription(name: string, type: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName === 'id' || lowerName.endsWith('_id')) return 'Unique identifier';
    if (lowerName.includes('name')) return 'Name or label';
    if (lowerName.includes('desc') || lowerName.includes('description')) return 'Descriptive text';
    if (lowerName.includes('date') || lowerName.includes('time') || type.includes('TIMESTAMP')) return 'Date or timestamp';
    if (lowerName.includes('price') || lowerName.includes('cost') || lowerName.includes('amount') || lowerName.includes('revenue') || lowerName.includes('value')) return 'Monetary value';
    if (lowerName.includes('quantity') || lowerName.includes('qty') || lowerName.includes('count')) return 'Numerical count or quantity';
    if (lowerName.includes('address')) return 'Street address';
    if (lowerName === 'city') return 'City name';
    if (lowerName === 'state') return 'State or province';
    if (lowerName === 'country') return 'Country name';
    if (lowerName.includes('zip') || lowerName.includes('postal')) return 'Postal code';
    if (lowerName.includes('email')) return 'Email address';
    if (lowerName.includes('phone')) return 'Phone number';
    if (lowerName.includes('url') || lowerName.includes('website')) return 'Website URL';
    if (type.includes('BOOLEAN')) return 'Boolean flag (True/False)';
    return ''; // Default empty description
  }
  
  // --- generateQueryReasoning --- 
  private async generateQueryReasoning(
    naturalLanguageQuery: string,
    sqlQuery: string,
    results: any // Consider typing this more strictly if possible
  ): Promise<string> {
      this.logger.info({ level: 'info', message: 'Generating reasoning for the query...' });
      const model = 'gpt-4o'; // Use a reasoning-capable model
      const temperature = 0.3;

      let resultSummary = 'Query executed successfully.';
      if (results && Array.isArray(results) && results.length > 0) {
          resultSummary = `Query returned ${results.length} rows. Sample row: ${JSON.stringify(results[0])}`;
      } else if (results === null || (Array.isArray(results) && results.length === 0)) {
          resultSummary = 'Query executed successfully but returned no rows.';
      }

      const prompt = `Given the natural language query:\n"${naturalLanguageQuery}"\n\nAnd the generated SQL query:\n\`\`\`sql\n${sqlQuery}\n\`\`\`\n\nAnd the query result summary:\n"${resultSummary}"\n\nPlease explain step-by-step how the SQL query was constructed to answer the natural language query, referencing the specific tables and columns used. Explain any assumptions made. Keep the explanation concise and clear.`;

      try {
           const messages = [{ role: 'user', content: prompt }];
            const response = await this.openaiService.generateChatCompletion(messages as any, { // Use type assertion carefully
                model: model,
                temperature: temperature,
            });

            const responseData = await response.json() as any; // Use type assertion carefully
            const reasoning = responseData?.content?.trim() || 'Could not generate reasoning.';

          this.logger.info({ level: 'info', message: 'Successfully generated reasoning.' });
          return reasoning;
      } catch (error: any) {
          this.logger.error({ level: 'error', message: 'Error generating query reasoning', error });
          return `Failed to generate reasoning: ${error instanceof Error ? error.message : String(error)}`;
      }
  }

} 