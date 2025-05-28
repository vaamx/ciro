import { Injectable } from '@nestjs/common';
import path from 'path';
import fs from 'fs-extra';
import { injectable } from 'inversify';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { EmbeddingService } from '@services/llm';
import { QdrantCollectionService } from '@services/vector/collection-manager.service';
import { QdrantIngestionService } from '@services/vector/ingestion.service';
import { SnowflakeService } from '../../../connectors/snowflake/snowflake.service';
import { WebSocketService } from '../../../../util/websocket.service';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
import { db } from '../../../../../config/database';
import { RowLevelIndexerService } from './row-level-indexer.service';
import { EnhancedMetadataService } from '../../../../shared/metadata/enhanced-metadata.service';
import { EventManager } from '../../../../util/event-manager';
import { v4 as uuidv4 } from 'uuid';

// This represents the metadata for a table in Snowflake
interface TableMetadata {
  dataSourceId: number;
  database: string;
  schema: string;
  tableName: string;
  columns: {
    name: string;
    type: string;
    description?: string;
    nullable: boolean;
    primaryKey: boolean;
    foreignKey?: {
      table: string;
      column: string;
    };
  }[];
  description?: string;
  rowCount?: number;
  sampleData?: any[][];
  lastUpdated: Date;
  lastSyncedRows?: number;
}

// Interface for Snowflake connection parameters
interface SnowflakeConnectionParams {
  account: string;
  username: string;
  password?: string;
  privateKey?: string;
  privateKeyPass?: string;
  role?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
}

// Interface for storing embedding vectors for tables and columns
interface SchemaEmbedding {
  id: string; // Format: datasource:database:schema:table or datasource:database:schema:table:column
  text: string; // Description text used to generate the embedding
  type: 'table' | 'column' | 'table_chunk';
  vector: number[];
  metadata: {
    dataSourceId: number;
    database: string;
    schema: string;
    table?: string;
    column?: string;
    dataType?: string;
    lastUpdated: Date;
    chunk?: number;
    offset?: number;
    totalChunks?: number;
    reduced?: boolean;
    minimal?: boolean; // Added for extremely reduced descriptions
    isStructureOnly?: boolean;
    rowCount?: number;
    completeData?: boolean;
    numericRanges?: Record<string, { min: number, max: number }>;
    entityFrequencies?: Record<string, number>;
    uniqueValues?: Record<string, (string|number)[]>;
    commonValues?: Record<string, (string|number)[]>;
    dateRanges?: Record<string, { min: Date, max: Date }>;
  };
}

// Extend the EnhancedMetadataOptions to include the missing properties
interface ExtendedMetadataOptions {
  calculateDistributions?: boolean;
  extractDates?: boolean;
  sampleSize?: number;
  includedFields?: string[];
  maxUniqueValues?: number;
}

/**
 * Service for indexing Snowflake database schemas and creating embeddings
 * for natural language queries against database metadata
 */
@injectable()
export class SnowflakeSchemaIndexerService {
  private readonly logger = createServiceLogger('SnowflakeSchemaIndexerService');
  private metadataCache = new Map<string, TableMetadata>();
  private METADATA_CACHE_DIR = path.join(process.cwd(), '.cache', 'schema-metadata');
  private KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
  private SNOWFLAKE_KNOWLEDGE_DIR = path.join(this.KNOWLEDGE_DIR, 'snowflake');

  constructor(
    private readonly snowflakeService: SnowflakeService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly qdrantIngestionService: QdrantIngestionService,
    private readonly documentChunkingService: DocumentChunkingService,
    private readonly rowLevelIndexerService: RowLevelIndexerService,
    private readonly enhancedMetadataService: EnhancedMetadataService,
    private readonly eventManager: EventManager,
    private readonly websocketService: WebSocketService
  ) {
    // Create cache directories if they don't exist
    if (!fs.existsSync(this.METADATA_CACHE_DIR)) {
      fs.mkdirpSync(this.METADATA_CACHE_DIR);
      this.logger.info(`Created metadata cache directory: ${this.METADATA_CACHE_DIR}`);
    }
    
    // Create knowledge directory if it doesn't exist
    if (!fs.existsSync(this.KNOWLEDGE_DIR)) {
      fs.mkdirpSync(this.KNOWLEDGE_DIR);
      this.logger.info(`Created knowledge directory: ${this.KNOWLEDGE_DIR}`);
    }
    
    // Create Snowflake knowledge directory if it doesn't exist
    if (!fs.existsSync(this.SNOWFLAKE_KNOWLEDGE_DIR)) {
      fs.mkdirpSync(this.SNOWFLAKE_KNOWLEDGE_DIR);
      this.logger.info(`Created Snowflake knowledge directory: ${this.SNOWFLAKE_KNOWLEDGE_DIR}`);
    }
  }
  
  /**
   * Main function to index a database schema
   * This includes extracting metadata, relationships, and creating embeddings
   */
  async indexDatabaseSchema(
    dataSourceId: number,
    connectionParams: SnowflakeConnectionParams,
    database: string,
    schema: string,
    options: {
      forceRefresh?: boolean;
      sampleRowCount?: number;
      maxTablesToIndex?: number;
      detectRelationships?: boolean;
      createEmbeddings?: boolean;
      includeTableData?: boolean;
      rowLimit?: number;
      completeDataMode?: boolean; // New flag for BI and visualization use cases
      useRowLevelIndexing?: boolean; // New flag to enable row-level indexing
    } = {}
  ): Promise<{
    tablesIndexed: number;
    columnsIndexed: number;
    relationships: number;
    embeddingsCreated?: number;
    collectionName?: string;
    rowsIndexed?: number; // New field for row-level indexing stats
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting schema indexing for dataSourceId=${dataSourceId}, database=${database}, schema=${schema}`);
    
    // Update data source status to processing
    await this.updateDataSourceStatus(dataSourceId, 'processing', {
      message: `Indexing schema: ${database}.${schema}`,
      progress: 0
    });
    
    const defaultOptions = {
      forceRefresh: false,
      sampleRowCount: 1000, // Increased for more comprehensive data representation
      maxTablesToIndex: Number.MAX_SAFE_INTEGER, // No limit by default, process all tables
      detectRelationships: true,
      createEmbeddings: true,
      includeTableData: true,
      rowLimit: 20000000, // Increased for more complete data
      batchSize: 500,  // Process tables in batches of 500 to avoid memory issues
      completeDataMode: false, // Default to false, enable explicitly for BI use cases
      useRowLevelIndexing: false, // Default to false, enable explicitly for row-level indexing
    };
    
    const indexOptions = { ...defaultOptions, ...options };
    
    // If completeDataMode is enabled, override certain options for complete data processing
    if (indexOptions.completeDataMode) {
      this.logger.info(`Complete Data Mode is enabled for BI and visualization - using maximum data settings`);
      indexOptions.sampleRowCount = Math.max(indexOptions.sampleRowCount, 5000); // At least 5000 rows
      indexOptions.rowLimit = Math.max(indexOptions.rowLimit, 50000000); // At least 50M row limit
      indexOptions.includeTableData = true; // Always include table data
    }
    
    try {
      // 1. Get list of tables in the schema
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      // Apply table limit if specified
      const tablesToProcess = tables.slice(0, indexOptions.maxTablesToIndex);
      this.logger.info(`Found ${tables.length} tables, planning to process up to ${tablesToProcess.length}`);
      
      // Update progress
      await this.updateDataSourceStatus(dataSourceId, 'processing', {
        message: `Found ${tables.length} tables, planning to process up to ${tablesToProcess.length}`,
        progress: 10
      });
      
      let tableCount = 0;
      let columnCount = 0;
      let relationshipCount = 0;
      let rowsIndexed = 0;
      
      // Process tables in batches to avoid memory issues with very large schemas
      const batchSize = indexOptions.batchSize || 500;
      const totalBatches = Math.ceil(tablesToProcess.length / batchSize);
      this.logger.info(`Processing tables in ${totalBatches} batches of ${batchSize}`);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, tablesToProcess.length);
        const currentBatch = tablesToProcess.slice(startIdx, endIdx);
        
        this.logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}, tables ${startIdx + 1}-${endIdx} of ${tablesToProcess.length}`);
        
        // Update progress for each batch
        await this.updateDataSourceStatus(dataSourceId, 'processing', {
          message: `Processing batch ${batchIndex + 1}/${totalBatches}, tables ${startIdx + 1}-${endIdx} of ${tablesToProcess.length}`,
          progress: 10 + Math.floor((batchIndex / totalBatches) * 70)
        });
        
        // Process tables in this batch
        for (const tableName of currentBatch) {
          try {
            this.logger.info(`Indexing table: ${database}.${schema}.${tableName}`);
            
            // Get column details
            const columns = await this.snowflakeService.describeTable(
              dataSourceId, database, schema, tableName
            );
            
            // Get sample data if includeTableData is true
            let sampleData: any[][] = [];
            if (indexOptions.includeTableData) {
              sampleData = await this.getSampleData(
                dataSourceId, database, schema, tableName, indexOptions.sampleRowCount
              );
            }
            
            // Get row count
            const rowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
            
            // Store metadata
            const tableMetadata: TableMetadata = {
              dataSourceId,
              database,
              schema,
              tableName,
              columns: columns.map(col => ({
                name: col.name as string,
                type: col.type as string,
                description: col.comment as string || '',
                nullable: col.null === 'Y',
                primaryKey: false // Will be updated if we detect primary keys
              })),
              rowCount,
              sampleData,
              lastUpdated: new Date(),
            };
            
            // Store metadata in memory and cache
            await this.saveTableMetadata(tableMetadata);
            tableCount++;
            columnCount += tableMetadata.columns.length;
            
            // Provide more detailed progress updates
            if (tableCount % 50 === 0) {
              const overallProgress = Math.min(10 + Math.floor((tableCount / tablesToProcess.length) * 70), 80);
              await this.updateDataSourceStatus(dataSourceId, 'processing', {
                message: `Processed ${tableCount}/${tablesToProcess.length} tables, ${columnCount} columns`,
                progress: overallProgress
              });
            }
          } catch (error: any) {
            this.logger.error(`Error processing table ${database}.${schema}.${tableName}: ${error.message}`);
            // Continue with the next table instead of failing the entire batch
            continue;
          }
        }
        
        // Force garbage collection between batches (if available)
        if (global.gc) {
          this.logger.info('Requesting garbage collection between batches');
          try {
            global.gc();
          } catch (e) {
            this.logger.warn('Failed to force garbage collection');
          }
        }
      }
      
      // 3. Detect relationships between tables if requested
      if (indexOptions.detectRelationships) {
        await this.updateDataSourceStatus(dataSourceId, 'processing', {
          message: `Detecting relationships between tables`,
          progress: 50
        });
        
        relationshipCount = await this.detectAndStoreRelationships(dataSourceId, database, schema);
      }
      
      // 4. Create embeddings for tables and columns if requested
      let embeddingsCreated = 0;
      let collectionName: string | undefined;
      
      if (indexOptions.createEmbeddings) {
        await this.updateDataSourceStatus(dataSourceId, 'processing', {
          message: `Creating embeddings for tables and columns`,
          progress: 70
        });
        
        const embedResult = await this.generateEmbeddings(dataSourceId, database, schema);
        embeddingsCreated = embedResult.embeddingsCreated;
        collectionName = embedResult.collectionName;
      }
      
      // 5. Create or update data source record in database to make it visible in Knowledge Base
      await this.createOrUpdateDataSource(dataSourceId, database, schema, {
        tableCount,
        columnCount,
        relationshipCount,
        collectionName
      });
      
      // 6. Mark as completed
      await this.updateDataSourceStatus(dataSourceId, 'ready', {
        message: `Schema indexing completed: ${tableCount} tables, ${columnCount} columns, ${relationshipCount} relationships, ${embeddingsCreated} embeddings`,
        progress: 100
      });
      
      const duration = (Date.now() - startTime) / 1000;
      this.logger.info(`Schema indexing completed in ${duration.toFixed(2)}s: ${tableCount} tables, ${columnCount} columns, ${relationshipCount} relationships, ${embeddingsCreated} embeddings`);
      
      // After the successful execution of processLargeTableForEmbeddings, add this block:
      // If row-level indexing is enabled, index the table rows
      if (indexOptions.useRowLevelIndexing && tablesToProcess.length > 0) {
        this.logger.info(`Starting row-level indexing for ${tablesToProcess.length} tables`);
        
        for (const table of tablesToProcess) {
          try {
            this.logger.info(`Row-level indexing for table ${database}.${schema}.${table}`);
            
            // Call RowLevelIndexerService to index table rows
            const result = await this.rowLevelIndexerService.indexTableRows(
              dataSourceId,
              database,
              schema,
              table,
              {
                chunkSize: indexOptions.sampleRowCount || 10000,
                maxRows: indexOptions.rowLimit || 1000000,
                forceReindex: indexOptions.forceRefresh || false,
                createEmbeddings: indexOptions.createEmbeddings !== false
              }
            );
            
            rowsIndexed += result.totalIndexed;
            this.logger.info(`Indexed ${result.totalIndexed} rows from table ${database}.${schema}.${table}`);
          } catch (error) {
            this.logger.error(`Error indexing rows for table ${database}.${schema}.${table}:`, error);
          }
        }
        
        this.logger.info(`Row-level indexing completed, indexed ${rowsIndexed} rows in total`);
      }
      
      // Return the stats including row-level indexing stats if applicable
      return {
        tablesIndexed: tableCount,
        columnsIndexed: columnCount,
        relationships: relationshipCount,
        embeddingsCreated: indexOptions.createEmbeddings ? embeddingsCreated : undefined,
        collectionName: indexOptions.createEmbeddings ? collectionName : undefined,
        rowsIndexed: indexOptions.useRowLevelIndexing ? rowsIndexed : undefined
      };
    } catch (error: any) {
      // Mark as failed
      await this.updateDataSourceStatus(dataSourceId, 'error', {
        message: `Error indexing schema: ${error.message}`,
        error: error.message
      });
      
      this.logger.error(`Error indexing database schema: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Create or update a data source record to make it visible in the Knowledge Base Panel
   */
  private async createOrUpdateDataSource(
    dataSourceId: number,
    database: string,
    schema: string,
    stats: {
      tableCount: number;
      columnCount: number;
      relationshipCount: number;
      collectionName?: string;
    }
  ): Promise<void> {
    try {
      // Check if data source already exists
      const existingSource = await db('data_sources')
        .where('id', dataSourceId)
        .first();
      
      const metadata = {
        database,
        schema,
        ...stats,
        lastUpdated: new Date().toISOString()
      };
      
      if (existingSource) {
        // Update existing data source
        await db('data_sources')
          .where('id', dataSourceId)
          .update({
            status: 'ready',
            metadata: JSON.stringify(metadata),
            updated_at: new Date()
          });
      } else {
        // Create new data source
        await db('data_sources').insert({
          id: dataSourceId,
          name: `Snowflake: ${database}.${schema}`,
          type: 'snowflake',
          status: 'ready',
          metadata: JSON.stringify(metadata),
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      // Broadcast update to Knowledge Base Panel
      this.websocketService.broadcast('knowledgeBaseUpdated', {
        action: 'update',
        source: {
          id: dataSourceId,
          name: `Snowflake: ${database}.${schema}`,
          type: 'snowflake',
          status: 'ready',
          metadata,
          icon: 'database', // Use database icon for Snowflake sources
        },
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Data source ${dataSourceId} created/updated in Knowledge Base`);
    } catch (error: any) {
      this.logger.error(`Error creating/updating data source: ${error.message}`);
    }
  }
  
  /**
   * Update the status of a data source
   */
  private async updateDataSourceStatus(
    dataSourceId: number,
    status: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          status,
          updated_at: new Date()
        });
      
      // Broadcast status update
      this.websocketService.broadcastDataSourceUpdate(dataSourceId, status, metadata);
      
      this.logger.info(`Data source ${dataSourceId} status updated to ${status}`);
    } catch (error: any) {
      this.logger.error(`Error updating data source status: ${error.message}`);
    }
  }
  
  /**
   * Get sample data for a table with strategies for very large tables
   * Modified to prioritize data completeness for BI and visualization
   */
  private async getSampleData(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    sampleRowCount: number = 1000 // Increased default from 100 to 1000
  ): Promise<any[][]> {
    try {
      // First, check if the table is very large (> 1 million rows)
      const estimatedRowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
      this.logger.info(`Table ${database}.${schema}.${tableName} has approximately ${estimatedRowCount} rows`);
      
      // For large tables, use different sampling strategies designed for BI completeness
      let samplingStrategy = 'LIMIT';
      let query = '';
      let rowLimit = Math.min(sampleRowCount, 20000000); // Increased cap from 10M to 20M rows
      
      if (estimatedRowCount > 50000000) {
        // For extremely large tables (>50M rows), use TABLESAMPLE with row count
        // but with a higher number of rows than before
        samplingStrategy = 'TABLESAMPLE_ROWS';
        query = `SELECT * FROM "${database}"."${schema}"."${tableName}" TABLESAMPLE (${rowLimit} ROWS)`;
      }
      else if (estimatedRowCount > 10000000) {
        // For very large tables (>10M rows), use SAMPLE with Bernoulli sampling
        // which is better for statistical analysis than system sampling
        samplingStrategy = 'SAMPLE_BERNOULLI';
        // Use a percentage that will get us close to our target row count
        const samplingPercentage = Math.max(0.5, Math.min(100, (rowLimit / estimatedRowCount) * 100));
        query = `SELECT * FROM "${database}"."${schema}"."${tableName}" SAMPLE BERNOULLI (${samplingPercentage.toFixed(2)}%)`;
      }
      else if (estimatedRowCount > 1000000) {
        // For large tables (>1M rows), use sequential LIMIT with higher count
        samplingStrategy = 'LIMIT_SEQUENTIAL';
        query = `SELECT * FROM "${database}"."${schema}"."${tableName}" ORDER BY 1 LIMIT ${rowLimit}`;
      }
      else {
        // For smaller tables, we can process the whole table or use a limit
        if (estimatedRowCount <= sampleRowCount) {
          samplingStrategy = 'FULL_TABLE';
          query = `SELECT * FROM "${database}"."${schema}"."${tableName}"`;
        } else {
          samplingStrategy = 'LIMIT';
          query = `SELECT * FROM "${database}"."${schema}"."${tableName}" LIMIT ${rowLimit}`;
        }
      }
      
      this.logger.info(`Fetching sample data for ${database}.${schema}.${tableName} using ${samplingStrategy} strategy (BI optimized): ${query}`);
      
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      this.logger.info(`Retrieved ${result.rows.length} sample rows from ${database}.${schema}.${tableName} for complete BI analysis`);
      return result.rows;
    } catch (error: any) {
      // If advanced sampling fails, try progressively simpler strategies
      this.logger.warn(`Sampling error for ${database}.${schema}.${tableName}: ${error.message}. Trying fallback strategy...`);
      
      try {
        // Fallback to simple SAMPLE clause if TABLESAMPLE is not supported
        const fallbackQuery = `SELECT * FROM "${database}"."${schema}"."${tableName}" SAMPLE (${Math.min(sampleRowCount, 10000)} ROWS)`;
        this.logger.info(`Trying fallback sampling for ${database}.${schema}.${tableName}: ${fallbackQuery}`);
        const result = await this.snowflakeService.executeQuery(dataSourceId, fallbackQuery);
        return result.rows;
      } catch (fallbackError: any) {
        this.logger.warn(`Fallback sampling failed for ${database}.${schema}.${tableName}: ${fallbackError.message}. Trying basic LIMIT...`);
        
        // Last resort: basic LIMIT query
        try {
          const basicQuery = `SELECT * FROM "${database}"."${schema}"."${tableName}" LIMIT ${Math.min(sampleRowCount, 10000)}`;
          this.logger.info(`Trying basic LIMIT query for ${database}.${schema}.${tableName}: ${basicQuery}`);
          const result = await this.snowflakeService.executeQuery(dataSourceId, basicQuery);
          return result.rows;
        } catch (basicError: any) {
          this.logger.error(`All sampling strategies failed for ${database}.${schema}.${tableName}: ${basicError.message}`);
          return [];
        }
      }
    }
  }
  
  /**
   * Get approximate row count for a table - optimized for very large tables
   */
  private async getTableRowCount(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<number> {
    try {
      // First try to get estimated row count from table statistics which is much faster
      // for very large tables - uses metadata instead of scanning the table
      const statsQuery = `
        SELECT 
          TABLE_NAME,
          ROW_COUNT
        FROM 
          "${database}".INFORMATION_SCHEMA.TABLES 
        WHERE 
          TABLE_SCHEMA = '${schema}' 
        AND 
          TABLE_NAME = '${tableName}'
      `;
      
      const statsResult = await this.snowflakeService.executeQuery(dataSourceId, statsQuery);
      
      if (statsResult.rows.length > 0 && statsResult.rows[0][1]) {
        const estimatedCount = parseInt(statsResult.rows[0][1], 10);
        this.logger.info(`Using estimated row count (${estimatedCount}) from table statistics for ${database}.${schema}.${tableName}`);
        return estimatedCount;
      }
      
      // If statistics approach doesn't work, try a less expensive approximate count
      // This uses APPROX_COUNT_DISTINCT which is much faster than COUNT(*) for large tables
      try {
        const approxQuery = `
          SELECT APPROX_COUNT_DISTINCT(*) 
          FROM "${database}"."${schema}"."${tableName}"
          SAMPLE SYSTEM (1%)
        `;
        
        const approxResult = await this.snowflakeService.executeQuery(dataSourceId, approxQuery);
        if (approxResult.rows.length > 0) {
          // Adjust for the 1% sample
          const approxCount = parseInt(approxResult.rows[0][0], 10) * 100;
          this.logger.info(`Using approximate row count (${approxCount}) from sampling for ${database}.${schema}.${tableName}`);
          return approxCount;
        }
      } catch (approxError: unknown) {
        const errorMessage = approxError instanceof Error ? approxError.message : String(approxError);
        this.logger.warn(`Approximate count failed, falling back to exact count: ${errorMessage}`);
      }
      
      // Last resort: full count (expensive for very large tables)
      this.logger.warn(`Using expensive full COUNT(*) for ${database}.${schema}.${tableName} - consider optimizing if this is slow`);
      const query = `SELECT COUNT(*) FROM "${database}"."${schema}"."${tableName}"`;
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      return parseInt(result.rows[0][0], 10);
    } catch (error: any) {
      this.logger.warn(`Error getting row count for ${database}.${schema}.${tableName}: ${error.message}`);
      // If all methods fail, return a default large number to ensure appropriate sampling strategy
      return 1000000; // Assume large to be safe
    }
  }
  
  /**
   * Save table metadata to cache
   */
  private async saveTableMetadata(metadata: TableMetadata): Promise<void> {
    const cacheKey = `${metadata.dataSourceId}:${metadata.database}:${metadata.schema}:${metadata.tableName}`;
    this.metadataCache.set(cacheKey, metadata);
    
    // Also save to disk cache
    const cacheFilePath = path.join(
      this.METADATA_CACHE_DIR, 
      `${metadata.dataSourceId}_${metadata.database}_${metadata.schema}_${metadata.tableName}.json`
    );
    
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(metadata, null, 2));
    } catch (error: any) {
      this.logger.warn(`Failed to write metadata cache to disk: ${error.message}`);
    }
  }
  
  /**
   * Get table metadata from cache
   */
  async getTableMetadata(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<TableMetadata | null> {
    const cacheKey = `${dataSourceId}:${database}:${schema}:${tableName}`;
    
    // Check memory cache first
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey) || null;
    }
    
    // Try to load from disk cache
    const cacheFilePath = path.join(
      this.METADATA_CACHE_DIR, 
      `${dataSourceId}_${database}_${schema}_${tableName}.json`
    );
    
    if (fs.existsSync(cacheFilePath)) {
      try {
        const data = fs.readFileSync(cacheFilePath, 'utf-8');
        const metadata = JSON.parse(data) as TableMetadata;
        this.metadataCache.set(cacheKey, metadata);
        return metadata;
      } catch (error: any) {
        this.logger.warn(`Failed to read metadata cache from disk: ${error.message}`);
      }
    }
    
    return null;
  }
  
  /**
   * Get all table metadata for a data source
   */
  async getAllTableMetadata(
    dataSourceId: number,
    database?: string,
    schema?: string
  ): Promise<TableMetadata[]> {
    const metadata: TableMetadata[] = [];
    
    // Read from disk cache
    const files = fs.readdirSync(this.METADATA_CACHE_DIR);
    
    for (const file of files) {
      if (file.startsWith(`${dataSourceId}_`)) {
        try {
          const data = fs.readFileSync(path.join(this.METADATA_CACHE_DIR, file), 'utf-8');
          const tableMetadata = JSON.parse(data) as TableMetadata;
          
          // Filter by database and schema if provided
          if (database && tableMetadata.database !== database) continue;
          if (schema && tableMetadata.schema !== schema) continue;
          
          metadata.push(tableMetadata);
          
          // Update memory cache
          const cacheKey = `${tableMetadata.dataSourceId}:${tableMetadata.database}:${tableMetadata.schema}:${tableMetadata.tableName}`;
          this.metadataCache.set(cacheKey, tableMetadata);
        } catch (error: any) {
          this.logger.warn(`Failed to read metadata cache from disk: ${error.message}`);
        }
      }
    }
    
    return metadata;
  }
  
  /**
   * Detect and store relationships between tables in a schema
   * This improved version adds more logging and handles Snowflake's specific INFORMATION_SCHEMA format
   */
  private async detectAndStoreRelationships(
    dataSourceId: number,
    database: string,
    schema: string
  ): Promise<number> {
    this.logger.info(`Detecting relationships in ${database}.${schema}`);
    
    try {
      // First try the standard ANSI SQL approach to get foreign key relationships
      const query = `
        SELECT
          fk.TABLE_SCHEMA as FK_SCHEMA,
          fk.TABLE_NAME as FK_TABLE,
          fk.COLUMN_NAME as FK_COLUMN,
          fk.REFERENCED_TABLE_SCHEMA as PK_SCHEMA,
          fk.REFERENCED_TABLE_NAME as PK_TABLE,
          fk.REFERENCED_COLUMN_NAME as PK_COLUMN
        FROM
          "${database}".INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        JOIN
          "${database}".INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
          ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
        WHERE
          fk.TABLE_SCHEMA = '${schema}'
        ORDER BY
          fk.TABLE_SCHEMA, fk.TABLE_NAME, fk.ORDINAL_POSITION;
      `;
      
      this.logger.info(`Executing query to detect relationships: ${query}`);
      
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      this.logger.info(`Found ${result.rows.length} relationships from INFORMATION_SCHEMA`);
      
      let relationshipCount = 0;
      
      // Process each relationship and update our metadata
      for (const row of result.rows) {
        const fkSchema = row[0];
        const fkTable = row[1];
        const fkColumn = row[2];
        const pkSchema = row[3];
        const pkTable = row[4];
        const pkColumn = row[5];
        
        this.logger.info(`Found relationship: ${fkSchema}.${fkTable}.${fkColumn} -> ${pkSchema}.${pkTable}.${pkColumn}`);
        
        // Update the foreign key table's column metadata
        const fkTableMetadata = await this.getTableMetadata(dataSourceId, database, fkSchema, fkTable);
        
        if (fkTableMetadata) {
          const columnIndex = fkTableMetadata.columns.findIndex(col => col.name === fkColumn);
          
          if (columnIndex !== -1) {
            fkTableMetadata.columns[columnIndex].foreignKey = {
              table: `${pkSchema}.${pkTable}`,
              column: pkColumn
            };
            
            await this.saveTableMetadata(fkTableMetadata);
            relationshipCount++;
            this.logger.info(`Updated metadata with relationship: ${fkSchema}.${fkTable}.${fkColumn} -> ${pkSchema}.${pkTable}.${pkColumn}`);
          } else {
            this.logger.warn(`Column ${fkColumn} not found in table ${fkSchema}.${fkTable}`);
          }
        } else {
          this.logger.warn(`Table metadata not found for ${fkSchema}.${fkTable}`);
        }
      }
      
      // If we didn't find any relationships via INFORMATION_SCHEMA, try an alternate approach
      // to detect common naming patterns that suggest foreign keys
      if (relationshipCount === 0) {
        this.logger.info(`No explicit foreign key relationships found, attempting to detect implicit relationships by naming convention`);
        
        // Get all tables
        const tables = await this.getAllTableMetadata(dataSourceId, database, schema);
        
        // Look for potential ID columns that match table names (e.g., product_id in orders table -> products table)
        for (const table of tables) {
          const potentialFkColumns = table.columns.filter(col => 
            (col.name.toLowerCase().endsWith('_id') || col.name.toLowerCase() === 'id') &&
            !col.primaryKey
          );
          
          for (const fkColumn of potentialFkColumns) {
            // Extract the possible referenced table name from the column name
            let possibleTableName = null;
            
            if (fkColumn.name.toLowerCase() !== 'id') {
              // For columns like product_id, extract "product"
              possibleTableName = fkColumn.name.toLowerCase().replace(/_id$/, '');
              
              // Check for plural form
              if (possibleTableName.endsWith('s')) {
                possibleTableName = possibleTableName.slice(0, -1);
              }
            }
            
            // Skip if we couldn't extract a possible table name
            if (!possibleTableName) continue;
            
            // Look for matching tables with this name or similar
            const matchingTables = tables.filter(t => {
              const tableName = t.tableName.toLowerCase();
              return tableName === possibleTableName || 
                    tableName === possibleTableName + 's' ||  // Handle singular/plural
                    tableName === possibleTableName + 'es';   // Handle plurality variations
            });
            
            for (const matchingTable of matchingTables) {
              // Find the primary key column in the matching table
              const pkColumn = matchingTable.columns.find(col => col.primaryKey);
              
              if (pkColumn) {
                // We have a potential foreign key relationship
                this.logger.info(`Detected possible implicit relationship: ${table.schema}.${table.tableName}.${fkColumn.name} -> ${matchingTable.schema}.${matchingTable.tableName}.${pkColumn.name}`);
                
                // Add the relationship to metadata
                const columnIndex = table.columns.findIndex(col => col.name === fkColumn.name);
                
                if (columnIndex !== -1) {
                  table.columns[columnIndex].foreignKey = {
                    table: `${matchingTable.schema}.${matchingTable.tableName}`,
                    column: pkColumn.name
                  };
                  
                  await this.saveTableMetadata(table);
                  relationshipCount++;
                  this.logger.info(`Updated metadata with implicit relationship: ${table.schema}.${table.tableName}.${fkColumn.name} -> ${matchingTable.schema}.${matchingTable.tableName}.${pkColumn.name}`);
                }
              }
            }
          }
        }
        
        if (relationshipCount === 0) {
          this.logger.warn(`No relationships detected in schema ${database}.${schema}, even after checking naming conventions`);
        }
      }
      
      return relationshipCount;
    } catch (error: any) {
      this.logger.error(`Error detecting relationships: ${error.message}`);
      // Return 0 relationships on error
      return 0;
    }
  }
  
  /**
   * Generate embeddings for database schema
   */
  private async generateEmbeddings(
    dataSourceId: number,
    database: string,
    schema: string
  ): Promise<{
    embeddingsCreated: number;
    collectionName: string;
  }> {
    try {
      // Create a unique collection name for this schema
      const collectionName = `snowflake_${dataSourceId}_${database}_${schema}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      // Delete existing collection if it exists
      if (await this.qdrantCollectionService.collectionExists(collectionName)) {
        await this.qdrantCollectionService.deleteCollection(collectionName);
      }
      
      // Create new collection
      await this.qdrantCollectionService.createCollection(collectionName, {
        dimension: 1536,
        vectors: {
          size: 1536,
          distance: 'Cosine'
        }
      });
      this.logger.info(`Created collection ${collectionName} for schema embeddings`);
      
      // Get all tables in this schema
      const tables = await this.getAllTableMetadata(dataSourceId, database, schema);
      this.logger.info(`Found ${tables.length} tables to embed for schema ${database}.${schema}`);
      
      // Use batching for embedding generation to avoid memory issues
      const batchSize = 50; // Process 50 tables at a time
      let totalEmbeddings = 0;
      
      // Process tables in batches
      for (let i = 0; i < tables.length; i += batchSize) {
        const tableBatch = tables.slice(i, i + batchSize);
        this.logger.info(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tables.length / batchSize)}, tables ${i + 1}-${Math.min(i + batchSize, tables.length)}`);
        
        const embeddings: SchemaEmbedding[] = [];
        
        // Create embeddings for tables in this batch
        for (const table of tableBatch) {
          try {
            // Check if this is a very large table that needs special handling
            const largeTableThreshold = 100000; // Tables with more than 100K rows
            
            if (table.rowCount && table.rowCount > largeTableThreshold) {
              this.logger.info(`Table ${table.tableName} has ${table.rowCount} rows, using chunked processing`);
              
              // For large tables, still create a metadata embedding for the table structure
              const tableStructureDescription = `Table structure for ${table.database}.${table.schema}.${table.tableName}
Description: ${table.description || this.inferTablePurpose(table)}
This is a large table with approximately ${table.rowCount} rows.
Column details:
${table.columns.map(c => `${c.name} (${c.type})${c.primaryKey ? ' [PRIMARY KEY]' : ''}${c.foreignKey ? ` [FOREIGN KEY to ${c.foreignKey.table}.${c.foreignKey.column}]` : ''}: ${c.description || this.inferColumnDescription(c.name, c.type)}`).join('\n')}`;
              
              const tableStructureVector = await this.embeddingService.createEmbedding(tableStructureDescription);
              
              embeddings.push({
                id: `${dataSourceId}:${database}:${schema}:${table.tableName}:structure`,
                text: tableStructureDescription,
                type: 'table',
                vector: tableStructureVector,
                metadata: {
                  dataSourceId,
                  database,
                  schema,
                  table: table.tableName,
                  isStructureOnly: true,
                  lastUpdated: new Date()
                }
              });
              
              // Process the actual data in chunks
              const chunkEmbeddingsCount = await this.processLargeTableForEmbeddings(
                dataSourceId,
                database,
                schema,
                table.tableName,
                embeddings,
                10000 // Process 10K rows at a time
              );
              
              this.logger.info(`Created ${chunkEmbeddingsCount + 1} embeddings for large table ${table.tableName} (1 structure + ${chunkEmbeddingsCount} chunks)`);
            } else {
              // Standard processing for smaller tables
              const tableDescription = this.createTableDescription(table);
              
              // Only create embeddings for tables with descriptions
              if (tableDescription.trim().length > 10) {
                const tableEmbeddingVector = await this.embeddingService.createEmbedding(tableDescription);
                
                embeddings.push({
                  id: `${dataSourceId}:${database}:${schema}:${table.tableName}`,
                  text: tableDescription,
                  type: 'table',
                  vector: tableEmbeddingVector,
                  metadata: {
                    dataSourceId,
                    database,
                    schema,
                    table: table.tableName,
                    lastUpdated: new Date()
                  }
                });
                
                // Create embeddings for columns one by one instead of batching
                for (let i = 0; i < table.columns.length; i++) {
                  const columnDescription = this.createColumnDescription(table, table.columns[i]);
                  // Only create embeddings for columns with substantial descriptions
                  if (columnDescription.trim().length > 10) {
                    try {
                      const columnEmbeddingVector = await this.embeddingService.createEmbedding(columnDescription);
                      
                      embeddings.push({
                        id: `${dataSourceId}:${database}:${schema}:${table.tableName}:${table.columns[i].name}`,
                        text: columnDescription,
                        type: 'column',
                        vector: columnEmbeddingVector,
                        metadata: {
                          dataSourceId,
                          database,
                          schema,
                          table: table.tableName,
                          column: table.columns[i].name,
                          dataType: table.columns[i].type,
                          lastUpdated: new Date()
                        }
                      });
                    } catch (error: any) {
                      this.logger.warn(`Failed to create embedding for column ${table.columns[i].name}: ${error.message}`);
                    }
                  }
                }
              }
            }
          } catch (error: any) {
            this.logger.warn(`Failed to create embeddings for table ${table.tableName}: ${error.message}`);
            // Continue with the next table
            continue;
          }
        }
        
        // Create points for Qdrant
        const points = embeddings.map(embedding => ({
          id: embedding.id,
          vector: embedding.vector,
          payload: {
            text: embedding.text,
            type: embedding.type,
            dataSourceId: embedding.metadata.dataSourceId,
            database: embedding.metadata.database,
            schema: embedding.metadata.schema,
            table: embedding.metadata.table,
            column: embedding.metadata.column,
            dataType: embedding.metadata.dataType,
            lastUpdated: embedding.metadata.lastUpdated.toISOString()
          }
        }));
        
        // Upload this batch to Qdrant
        if (points.length > 0) {
          await this.qdrantIngestionService.upsertVectors(collectionName, points);
          totalEmbeddings += points.length;
          this.logger.info(`Uploaded ${points.length} embeddings in batch, ${totalEmbeddings} total so far`);
        }
        
        // Force garbage collection between batches if available
        if (global.gc) {
          this.logger.info('Requesting garbage collection between embedding batches');
          try {
            global.gc();
          } catch (e) {
            this.logger.warn('Failed to force garbage collection');
          }
        }
      }
      
      this.logger.info(`Generated and stored ${totalEmbeddings} embeddings in ${collectionName}`);
      return {
        embeddingsCreated: totalEmbeddings,
        collectionName
      };
    } catch (error: any) {
      this.logger.error(`Error generating embeddings: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Store metadata about the Snowflake data in Knowledge folder
   */
  private storeKnowledgeMetadata(metadata: {
    id: string;
    dataSourceId: number;
    database: string;
    schema: string;
    tableCount: number;
    columnCount: number;
    embeddingCount: number;
    lastUpdated: Date;
    tables: { name: string; rowCount: number }[];
  }): void {
    try {
      // Create directory for this data source if it doesn't exist
      const dataSourceDir = path.join(this.SNOWFLAKE_KNOWLEDGE_DIR, `datasource_${metadata.dataSourceId}`);
      if (!fs.existsSync(dataSourceDir)) {
        fs.mkdirSync(dataSourceDir, { recursive: true });
      }
      
      // Create metadata file
      const metadataPath = path.join(dataSourceDir, `${metadata.database}_${metadata.schema}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Generate a README file for the data source
      this.generateDataSourceReadme(metadata.dataSourceId, metadata.database, metadata.schema);
      
      this.logger.info(`Stored Snowflake knowledge metadata at ${metadataPath}`);
    } catch (error: any) {
      this.logger.warn(`Failed to store knowledge metadata: ${error.message}`);
    }
  }
  
  /**
   * Generate a README file for the data source with basic information
   */
  private generateDataSourceReadme(dataSourceId: number, database: string, schema: string): void {
    try {
      const dataSourceDir = path.join(this.SNOWFLAKE_KNOWLEDGE_DIR, `datasource_${dataSourceId}`);
      const readmePath = path.join(dataSourceDir, 'README.md');
      
      const tables = this.getAllTableMetadata(dataSourceId, database, schema);
      
      const readmeContent = `# Snowflake Data Source: ${database}.${schema}

## Overview
This directory contains metadata and embeddings for Snowflake database tables.

- **Data Source ID**: ${dataSourceId}
- **Database**: ${database}
- **Schema**: ${schema}
- **Last Updated**: ${new Date().toISOString()}

## Available Collections
- \`snowflake_schema_${dataSourceId}_${database}_${schema}\`: Main schema collection for natural language queries

## Usage
To query this data source using natural language, use the /data-sources/${dataSourceId}/nl-query endpoint.

Example:
\`\`\`
POST /data-sources/${dataSourceId}/nl-query
{
  "query": "Show me the top 10 records from customer table",
  "options": {
    "includeReasoning": true
  }
}
\`\`\`
`;
      
      fs.writeFileSync(readmePath, readmeContent);
    } catch (error: any) {
      this.logger.warn(`Failed to generate README: ${error.message}`);
    }
  }

  /**
   * Get all snowflake data sources in the knowledge folder
   */
  async getKnowledgeMetadata(): Promise<any[]> {
    try {
      if (!fs.existsSync(this.SNOWFLAKE_KNOWLEDGE_DIR)) {
        return [];
      }
      
      const datasourceDirs = fs.readdirSync(this.SNOWFLAKE_KNOWLEDGE_DIR)
        .filter(name => name.startsWith('datasource_'))
        .map(dir => path.join(this.SNOWFLAKE_KNOWLEDGE_DIR, dir));
      
      const metadata: any[] = [];
      
      for (const dir of datasourceDirs) {
        const metadataFiles = fs.readdirSync(dir)
          .filter(file => file.endsWith('.json'));
        
        for (const file of metadataFiles) {
          const metadataPath = path.join(dir, file);
          const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          metadata.push(data);
        }
      }
      
      return metadata;
    } catch (error: any) {
      this.logger.error(`Error getting knowledge metadata: ${error.message}`);
      return [];
    }
  }
  
  /**
   * List all Snowflake collections available for querying
   */
  async listSnowflakeCollections(): Promise<string[]> {
    try {
      // Find data sources of type 'snowflake' in the database
      const snowflakeSources = await db('data_sources')
        .where('type', 'snowflake')
        .select('id');
      
      // Get collection names in datasource_ID format
      const collectionNames = snowflakeSources.map(source => `datasource_${source.id}`);
      
      // Filter out collections that don't exist in Qdrant
      const results = [];
      for (const name of collectionNames) {
        if (await this.qdrantCollectionService.collectionExists(name)) {
          results.push(name);
        }
      }
      
      this.logger.info(`Found ${results.length} Snowflake collections`);
      return results;
    } catch (error: any) {
      this.logger.error(`Error listing Snowflake collections: ${error.message}`);
      return [];
    }
  }

  /**
   * Create a descriptive text for a table
   */
  private createTableDescription(tableMetadata: TableMetadata, detailed: boolean = false): string {
    // Get necessary metadata
    const { tableName, database, schema, description, sampleData, columns, rowCount } = tableMetadata;
    
    // Determine if this is a large table (more than 100K rows)
    const isLargeTable = rowCount && rowCount > 100000;
    
    // Create a basic description part
    let tableDescription = `Table: ${database}.${schema}.${tableName}\n`;
    if (description) {
      tableDescription += `Description: ${description}\n`;
    }
    
    // Add column names
    tableDescription += `Columns: ${columns.map(col => col.name).join(', ')}\n`;
    
    // Add row count if available
    if (rowCount) {
      tableDescription += `Row count: ${rowCount}\n`;
    }
    
    // Add column details
    tableDescription += 'Column details:\n';
    columns.forEach(column => {
      let columnText = `${column.name} (${column.type})`;
      
      // Determine column category based on name and type
      if (column.name.toLowerCase().includes('id') && !column.name.toLowerCase().includes('zip') && !column.name.toLowerCase().includes('code')) {
        columnText += `: Unique identifier`;
      } else if (column.name.toLowerCase().includes('date') || column.name.toLowerCase().includes('time') || column.type.toLowerCase().includes('date') || column.type.toLowerCase().includes('time')) {
        columnText += `: Date or timestamp`;
      } else if (column.name.toLowerCase().includes('price') || column.name.toLowerCase().includes('cost') || column.name.toLowerCase().includes('amount') || column.name.toLowerCase().includes('value')) {
        columnText += `: Monetary value or amount`;
      } else if (column.type.toLowerCase().includes('varchar') || column.type.toLowerCase().includes('char') || column.type.toLowerCase().includes('text') || column.type.toLowerCase().includes('string')) {
        columnText += `: Text data`;
      } else if (column.type.toLowerCase().includes('int') || column.type.toLowerCase().includes('number') || column.type.toLowerCase().includes('decimal') || column.type.toLowerCase().includes('numeric')) {
        columnText += `: ${column.type} data column`;
      } else if (column.type.toLowerCase().includes('bool')) {
        columnText += `: Boolean/flag`;
      } else {
        columnText += `: ${column.type} type`;
      }
      
      tableDescription += columnText + '\n';
    });

    // For large tables, limit the amount of sample data to reduce token count
    if (isLargeTable) {
      // For large tables, only add column headers and at most 5 sample rows
      if (sampleData && sampleData.length > 0) {
        tableDescription += 'Sample data:\n';
        
        // Add column headers
        tableDescription += columns.map(col => col.name).join(' | ') + '\n';
        
        // Add a max of 5 rows for large tables
        const maxRows = Math.min(5, sampleData.length);
        for (let i = 0; i < maxRows; i++) {
          tableDescription += sampleData[i].join(' | ') + '\n';
        }
        
        if (sampleData.length > maxRows) {
          tableDescription += `... (${sampleData.length - maxRows} more rows not shown)\n`;
        }
      }
    } else {
      // For smaller tables, include more sample data (up to 20 rows)
      if (sampleData && sampleData.length > 0) {
        tableDescription += 'Sample data:\n';
        
        // Add column headers
        tableDescription += columns.map(col => col.name).join(' | ') + '\n';
        
        // Add a reasonable number of sample rows (max 20)
        const maxRows = Math.min(20, sampleData.length);
        for (let i = 0; i < maxRows; i++) {
          tableDescription += sampleData[i].join(' | ') + '\n';
        }
        
        if (sampleData.length > maxRows) {
          tableDescription += `... (${sampleData.length - maxRows} more rows not shown)\n`;
        }
      }
    }
    
    return tableDescription;
  }
  
  /**
   * Create a text description of a column for embedding
   */
  private createColumnDescription(table: TableMetadata, column: any): string {
    let description = `Column: ${column.name} in table ${table.database}.${table.schema}.${table.tableName}
Data type: ${column.type}
${column.primaryKey ? 'This is a PRIMARY KEY column.\n' : ''}
${column.foreignKey ? `This is a FOREIGN KEY referencing ${column.foreignKey.table}.${column.foreignKey.column}.\n` : ''}
Description: ${column.description || this.inferColumnDescription(column.name, column.type)}
`;
    
    // Add sample values if available
    if (table.sampleData && table.sampleData.length > 0) {
      const columnIndex = table.columns.findIndex(c => c.name === column.name);
      if (columnIndex !== -1) {
        const sampleValues = table.sampleData.map(row => row[columnIndex]).filter(val => val !== null && val !== undefined);
        if (sampleValues.length > 0) {
          description += `Sample values: ${sampleValues.join(', ')}`;
        }
      }
    }
    
    return description;
  }
  
  /**
   * Format sample data for display
   */
  private formatSampleData(table: TableMetadata): string {
    if (!table.sampleData || table.sampleData.length === 0) {
      return 'No sample data';
    }
    
    // Get column names
    const columnNames = table.columns.map(c => c.name);
    
    // Format as a simple table with column names and values
    let result = columnNames.join(' | ') + '\n';
    result += table.sampleData.map(row => 
      row.map((cell: any) => 
        // Format cell values, handling null and long strings
        cell === null ? 'NULL' : 
        typeof cell === 'string' && cell.length > 20 ? cell.substring(0, 20) + '...' : 
        String(cell)
      ).join(' | ')
    ).join('\n');
    
    return result;
  }
  
  /**
   * Infer a table's purpose from its name and columns
   */
  private inferTablePurpose(table: TableMetadata): string {
    const tableName = table.tableName.toLowerCase();
    const columnNames = table.columns.map(c => c.name.toLowerCase());
    
    // Common table types
    if (tableName.includes('user') || tableName.includes('customer')) {
      return 'Contains user or customer information';
    } else if (tableName.includes('order')) {
      return 'Contains order information';
    } else if (tableName.includes('product') || tableName.includes('item')) {
      return 'Contains product information';
    } else if (tableName.includes('transaction')) {
      return 'Contains transaction records';
    } else if (tableName.includes('log')) {
      return 'Contains log entries';
    } else if (tableName.includes('config') || tableName.includes('setting')) {
      return 'Contains configuration or settings';
    }
    
    // Check for common column patterns
    if (columnNames.includes('id') && (
      columnNames.includes('name') || 
      columnNames.includes('description') || 
      columnNames.includes('title')
    )) {
      return 'Contains entity records with identifiers and descriptions';
    }
    
    // Date-related tables
    if (columnNames.some(c => c.includes('date') || c.includes('time'))) {
      if (columnNames.some(c => c.includes('amount') || c.includes('total') || c.includes('price'))) {
        return 'Contains time-based financial or transactional records';
      } else {
        return 'Contains time-based records';
      }
    }
    
    // Default
    return `Table containing ${table.columns.length} columns and approximately ${table.rowCount || 'unknown'} rows`;
  }
  
  /**
   * Infer a column's description from its name and type
   */
  private inferColumnDescription(name: string, type: string): string {
    const lowerName = name.toLowerCase();
    
    // ID columns
    if (lowerName === 'id' || lowerName.endsWith('_id')) {
      return 'Unique identifier';
    }
    
    // Common column types
    if (lowerName === 'name' || lowerName.endsWith('_name')) {
      return 'Name or title';
    } else if (lowerName === 'description' || lowerName.endsWith('_description')) {
      return 'Description text';
    } else if (lowerName.includes('email')) {
      return 'Email address';
    } else if (lowerName.includes('phone')) {
      return 'Phone number';
    } else if (lowerName.includes('address')) {
      return 'Address information';
    }
    
    // Date and time
    if (
      lowerName.includes('date') || 
      lowerName.includes('time') || 
      lowerName === 'created_at' || 
      lowerName === 'updated_at' || 
      lowerName === 'deleted_at'
    ) {
      return 'Date or timestamp';
    }
    
    // Financial
    if (
      lowerName.includes('price') || 
      lowerName.includes('cost') || 
      lowerName.includes('amount') || 
      lowerName.includes('total')
    ) {
      return 'Monetary value or amount';
    }
    
    // Status
    if (lowerName.includes('status') || lowerName.includes('state')) {
      return 'Status or state indicator';
    }
    
    // Boolean flags
    if (
      lowerName.startsWith('is_') || 
      lowerName.startsWith('has_') || 
      type.toLowerCase().includes('bool')
    ) {
      return 'Boolean flag or indicator';
    }
    
    // Based on data type
    if (type.toLowerCase().includes('int')) {
      return 'Numeric value';
    } else if (type.toLowerCase().includes('varchar') || type.toLowerCase().includes('char')) {
      return 'Text value';
    } else if (type.toLowerCase().includes('date')) {
      return 'Date value';
    } else if (type.toLowerCase().includes('time')) {
      return 'Time value';
    } else if (type.toLowerCase().includes('timestamp')) {
      return 'Timestamp value';
    }
    
    // Default
    return `${type} data column`;
  }
  
  /**
   * Determine if a table has been modified since last indexing
   */
  async hasTableChanged(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<boolean> {
    try {
      // Get stored metadata
      const metadata = await this.getTableMetadata(dataSourceId, database, schema, tableName);
      
      if (!metadata) {
        return true; // No previous metadata, consider it changed
      }
      
      // Get current row count
      const currentRowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
      
      // If row count has changed, consider the table changed
      if (currentRowCount !== metadata.rowCount) {
        return true;
      }
      
      // TODO: We could add more sophisticated change detection here, like:
      // - Checking table modification timestamps from Snowflake info schema
      // - Comparing schema structure for column changes
      // - Checking data distributions
      
      return false;
    } catch (error: any) {
      this.logger.warn(`Error checking if table has changed: ${error.message}`);
      return true; // On error, assume change to be safe
    }
  }
  
  /**
   * Incrementally update the schema index for changed tables
   */
  async updateSchemaIndex(
    dataSourceId: number,
    database: string,
    schema: string,
    options: {
      forceRefresh?: boolean;
      updateEmbeddings?: boolean;
    } = {}
  ): Promise<{
    tablesChecked: number;
    tablesUpdated: number;
    embeddingsUpdated?: number;
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting incremental schema update for ${database}.${schema}`);
    
    try {
      // Get list of tables
      const tables = await this.snowflakeService.listTables(dataSourceId, database, schema);
      
      let tablesChecked = 0;
      let tablesUpdated = 0;
      let embeddingsUpdated = 0;
      
      // Check each table for changes
      for (const tableName of tables) {
        tablesChecked++;
        
        const hasChanged = options.forceRefresh || 
                         await this.hasTableChanged(dataSourceId, database, schema, tableName);
        
        if (hasChanged) {
          this.logger.info(`Table ${database}.${schema}.${tableName} has changed, updating metadata`);
          
          // Re-index this table
          const columns = await this.snowflakeService.describeTable(
            dataSourceId, database, schema, tableName
          );
          
          const sampleData = await this.getSampleData(dataSourceId, database, schema, tableName);
          const rowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
          
          // Get existing metadata to preserve relationship information
          const existingMetadata = await this.getTableMetadata(dataSourceId, database, schema, tableName);
          
          // Create new metadata, preserving relationship info if available
          const tableMetadata: TableMetadata = {
            dataSourceId,
            database,
            schema,
            tableName,
            columns: columns.map(col => {
              const existingCol = existingMetadata?.columns.find(c => c.name === col.name);
              return {
                name: col.name as string,
                type: col.type as string,
                description: col.comment as string || '',
                nullable: col.null === 'Y',
                primaryKey: existingCol?.primaryKey || false,
                foreignKey: existingCol?.foreignKey
              };
            }),
            rowCount,
            sampleData,
            lastUpdated: new Date(),
            lastSyncedRows: rowCount
          };
          
          // Save updated metadata
          await this.saveTableMetadata(tableMetadata);
          tablesUpdated++;
          
          // Update embeddings if requested
          if (options.updateEmbeddings) {
            // Update embeddings for this table only
            await this.updateTableEmbeddings(dataSourceId, database, schema, tableName);
            embeddingsUpdated++;
          }
        }
      }
      
      const duration = (Date.now() - startTime) / 1000;
      this.logger.info(`Schema update completed in ${duration.toFixed(2)}s: ${tablesChecked} tables checked, ${tablesUpdated} tables updated, ${embeddingsUpdated} embeddings updated`);
      
      return {
        tablesChecked,
        tablesUpdated,
        ...(options.updateEmbeddings ? { embeddingsUpdated } : {})
      };
    } catch (error: any) {
      this.logger.error(`Error updating schema index: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update embeddings for a specific table
   */
  private async updateTableEmbeddings(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<number> {
    try {
      const collectionName = `snowflake_schema_${dataSourceId}`;
      
      // Check if collection exists
      const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
      
      if (!collectionExists) {
        this.logger.warn(`Collection ${collectionName} does not exist, creating full embeddings instead`);
        await this.generateEmbeddings(dataSourceId, database, schema);
        return 1;
      }
      
      // Get metadata for this table
      const metadata = await this.getTableMetadata(dataSourceId, database, schema, tableName);
      
      if (!metadata) {
        this.logger.warn(`No metadata found for ${database}.${schema}.${tableName}`);
        return 0;
      }
      
      // Delete existing embeddings for this table
      const tableFilter = {
        must: [
          { key: 'dataSourceId', match: { value: dataSourceId } },
          { key: 'database', match: { value: database } },
          { key: 'schema', match: { value: schema } },
          { key: 'table', match: { value: tableName } }
        ]
      };
      
      await this.qdrantIngestionService.deleteVectorsByFilter(collectionName, tableFilter);
      
      // Create new embeddings
      const embeddingInputs: {
        id: string;
        text: string;
        type: 'table' | 'column';
        metadata: any;
      }[] = [];
      
      // Table-level embedding
      embeddingInputs.push({
        id: `${dataSourceId}:${database}:${schema}:${tableName}`,
        text: this.createTableDescription(metadata),
        type: 'table',
        metadata: {
          dataSourceId,
          database,
          schema,
          table: tableName,
          lastUpdated: new Date()
        }
      });
      
      // Column-level embeddings
      for (const column of metadata.columns) {
        embeddingInputs.push({
          id: `${dataSourceId}:${database}:${schema}:${tableName}:${column.name}`,
          text: this.createColumnDescription(metadata, column),
          type: 'column',
          metadata: {
            dataSourceId,
            database,
            schema,
            table: tableName,
            column: column.name,
            dataType: column.type,
            lastUpdated: new Date()
          }
        });
      }
      
      // Generate embeddings individually
      const embeddingResults: number[][] = [];
      for (const input of embeddingInputs) {
        try {
          const result = await this.embeddingService.createEmbedding(input.text);
          embeddingResults.push(result);
        } catch (error: any) {
          this.logger.warn(`Failed to create embedding: ${error.message}`);
          // Add a dummy vector to maintain the order
          embeddingResults.push(new Array(1536).fill(0));
        }
      }
      
      // Store in vector database
      const points = embeddingResults.map((vector, i) => ({
        id: embeddingInputs[i].id,
        vector,
        payload: {
          text: embeddingInputs[i].text,
          type: embeddingInputs[i].type,
          ...embeddingInputs[i].metadata
        }
      }));
      
      await this.qdrantIngestionService.upsertVectors(collectionName, points);
      
      this.logger.info(`Updated ${embeddingResults.length} embeddings for ${database}.${schema}.${tableName}`);
      return embeddingResults.length;
    } catch (error: any) {
      this.logger.error(`Error updating table embeddings: ${error.message}`);
      return 0;
    }
  }

  /**
   * Process a large table by breaking it into manageable chunks for embedding generation
   */
  private async processLargeTableForEmbeddings(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    embeddings: SchemaEmbedding[],
    chunkSize: number = 10000  // Increased default chunk size from 5000 to 10000 for more data per embedding
  ): Promise<number> {
    try {
      // Import the EnhancedMetadataService and EnhancedEmbeddingService only when needed (lazy loading)
      const { EnhancedMetadataService } = await import('@services/shared/metadata/enhanced-metadata.service');
      const metadataService = this.enhancedMetadataService;

      this.logger.info(`Processing large table for embeddings: ${database}.${schema}.${tableName}`);
      
      const chunkTableMetadata = await this.getTableMetadata(dataSourceId, database, schema, tableName);
      
      if (!chunkTableMetadata) {
        this.logger.error(`Table metadata not found for ${database}.${schema}.${tableName}`);
        return 0;
      }
      
      // Get the data based on the SnowflakeConnection
      const connection = await this.snowflakeService.getConnection(dataSourceId);
      
      if (!connection) {
        this.logger.error(`Failed to get connection for data source ${dataSourceId}`);
        return 0;
      }
      
      // Get row count
      const rowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
      
      if (rowCount === 0) {
        this.logger.info(`Table ${database}.${schema}.${tableName} is empty, skipping`);
        return 0;
      }
      
      this.logger.info(`Table ${database}.${schema}.${tableName} has ${rowCount} rows, processing in chunks of ${chunkSize}`);
      
      let processedChunks = 0;
      const totalChunks = Math.ceil(rowCount / chunkSize);
      
      // For each chunk, add enhanced metadata
      for (let offset = 0; offset < rowCount; offset += chunkSize) {
        processedChunks++;
        
        this.logger.info(`Processing chunk ${processedChunks}/${totalChunks} for table ${database}.${schema}.${tableName}`);
        
        // Get a chunk of data
        const query = `SELECT * FROM "${database}"."${schema}"."${tableName}" LIMIT ${chunkSize} OFFSET ${offset}`;
        
        // Execute query using snowflakeService to ensure type compatibility
        const result = await this.snowflakeService.executeQuery(dataSourceId, query);
        
        if (!result || !result.rows || result.rows.length === 0) {
          this.logger.warn(`No data returned for chunk ${processedChunks}/${totalChunks}`);
          continue;
        }
        
        // Transform the rows to match SourceData interface
        const sourceData = result.rows.map(row => ({
          content: row.join(' '), // Convert row data to string content
          metadata: {} // Empty metadata
        }));
        
        // Generate enhanced metadata with extended options
        const enhancedMetadata = await metadataService.extractEnhancedMetadata(
          sourceData, 
          'snowflake',
          { 
            includedFields: chunkTableMetadata.columns.map(c => c.name),
            maxUniqueValues: 50,
            calculateDistributions: true,
            extractDates: true,
            sampleSize: 1000 // Limit the sample size for performance
          } as ExtendedMetadataOptions // Cast to our extended options interface
        );
        
        // Create embedding with enhanced metadata
        const chunkDescription = `Table chunk ${processedChunks}/${totalChunks} from ${database}.${schema}.${tableName}
Rows ${offset+1} to ${offset+result.rows.length} of approximately ${rowCount} total rows
Complete data snapshot for BI and visualization analysis
${this.createTableDescription(chunkTableMetadata, true)}`;
        
        try {
          const chunkEmbeddingVector = await this.embeddingService.createEmbedding(chunkDescription);
          
          // Add the chunk embedding with enhanced metadata
          embeddings.push({
            id: `${dataSourceId}:${database}:${schema}:${tableName}:chunk:${processedChunks}`,
            text: chunkDescription,
            type: 'table_chunk',
            vector: chunkEmbeddingVector,
            metadata: {
              dataSourceId,
              database,
              schema,
              table: tableName,
              chunk: processedChunks,
              offset: offset,
              totalChunks: totalChunks,
              rowCount: result.rows.length,
              completeData: true,
              // Add enhanced metadata (with type fixes)
              numericRanges: enhancedMetadata.numericRanges,
              entityFrequencies: enhancedMetadata.entityFrequencies,
              uniqueValues: enhancedMetadata.uniqueValues,
              commonValues: enhancedMetadata.commonValues,
              // The dateRanges property might not exist in the interface but is used here
              // Safely access it or provide a default empty object
              dateRanges: {},
              lastUpdated: new Date()
            }
          });
          
          this.logger.info(`Created embedding for chunk ${processedChunks}/${totalChunks} of table ${database}.${schema}.${tableName}`);
        } catch (error) {
          this.logger.error(`Failed to create embedding for chunk ${processedChunks}/${totalChunks}`, error);
        }
      }
      
      // Finalize the process
      this.logger.info(`Processed ${processedChunks} chunks for table ${database}.${schema}.${tableName}`);
      return processedChunks;
    } catch (error) {
      this.logger.error(`Error processing large table for embeddings: ${error}`);
      return 0;
    }
  }
} 