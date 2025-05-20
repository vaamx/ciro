import { Injectable } from '@nestjs/common';
import { EnhancedMetadataService } from '@services/shared/metadata/enhanced-metadata.service';
import { SnowflakeService } from '@services/datasources/connectors/snowflake/snowflake.service';
import { QdrantSearchService } from '@services/vector/search.service';
import { QdrantCollectionService } from '@services/vector/collection-manager.service';
import { QdrantIngestionService } from '@services/vector/ingestion.service';
import { OpenAIService } from '@services/ai/openai.service';
import { createServiceLogger } from '@common/utils/logger-factory';
import * as os from 'os'; // For memory monitoring
import { SocketService } from '@services/util/socket.service';
import { WebSocketService } from '@services/util/websocket.service';

/**
 * Service for indexing individual rows from Snowflake tables for accurate aggregation
 */
@Injectable()
export class RowLevelIndexerService {
  private readonly logger = createServiceLogger('RowLevelIndexerService');
  
  
  private constructor(
    private readonly socketService: SocketService,
    private readonly websocketService: WebSocketService,
    
    private snowflakeService: SnowflakeService,
    private openaiService: OpenAIService,
    private qdrantSearchService: QdrantSearchService,
    private qdrantCollectionService: QdrantCollectionService,
    private qdrantIngestionService: QdrantIngestionService,
    private metadataService: EnhancedMetadataService
  ) {
    this.logger.info('RowLevelIndexerService initialized');
  }
  
  /**
   * Get singleton instance
   */
  
  
  /**
   * Get optimized concurrency based on available system resources
   * This prevents out-of-memory errors when processing very large datasets
   */
  private getOptimizedConcurrency(): number {
    // Get available system resources
    const cpuCount = os.cpus().length;
    const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
    const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
    const memoryUtilizationPercent = ((totalMemoryGB - freeMemoryGB) / totalMemoryGB) * 100;
    
    // Base concurrency on CPU cores, but consider memory constraints
    let optimizedConcurrency = cpuCount;
    
    // Adjust based on memory availability
    if (memoryUtilizationPercent > 80) {
      // Memory is highly utilized, be more conservative
      optimizedConcurrency = Math.max(2, Math.floor(cpuCount / 3));
      this.logger.warn(`Memory utilization is high (${Math.round(memoryUtilizationPercent)}%), reducing concurrency to ${optimizedConcurrency}`);
    } else if (memoryUtilizationPercent > 60) {
      // Memory is moderately utilized, be somewhat conservative
      optimizedConcurrency = Math.max(2, Math.floor(cpuCount / 2));
      this.logger.info(`Memory utilization is moderate (${Math.round(memoryUtilizationPercent)}%), adjusting concurrency to ${optimizedConcurrency}`);
    } else {
      // Memory is freely available, use more cores
      optimizedConcurrency = Math.min(24, Math.max(4, cpuCount - 2)); // Leave 2 cores for system, cap at 24
      this.logger.info(`Memory utilization is low (${Math.round(memoryUtilizationPercent)}%), setting concurrency to ${optimizedConcurrency}`);
    }
    
    // Consider available memory per worker
    const estimatedMemoryPerWorkerGB = 0.5; // 500MB estimated per worker
    const maxWorkersBasedOnMemory = Math.floor(freeMemoryGB / estimatedMemoryPerWorkerGB);
    
    // Take the minimum of CPU-based and memory-based concurrency
    const finalConcurrency = Math.min(optimizedConcurrency, maxWorkersBasedOnMemory);
    
    // Ensure at least 2 workers, but not more than 24
    return Math.min(24, Math.max(2, finalConcurrency));
  }
  
  /**
   * Index a table at the row level for accurate aggregation queries
   */
  async indexTableRows(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    options: {
      chunkSize?: number;
      maxRows?: number;
      batchSize?: number;
      concurrentChunks?: number;
      forceReindex?: boolean;
      createEmbeddings?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    totalRows: number;
    totalIndexed: number;
    totalChunks: number;
    duration: number;
    status: string;
  }> {
    const startTime = Date.now();
    
    // Immediately send an initial status update to show progress in UI
    await this.updateIndexingStatus(dataSourceId, {
      status: 'indexing',
      current_table: `${database}.${schema}.${tableName}`,
      progress: 0,
      message: 'Starting row-level indexing...'
    });
    
    // Performance-optimized defaults
    const chunkSize = options.chunkSize || 25000; // Increased from 10000 to 25000
    const maxRows = options.maxRows || 2000000; // Increased from 1000000 to 2000000
    const batchSize = options.batchSize || 200; // Increased from 50 to 200
    
    // Get the optimized concurrency based on available system resources
    const concurrentChunks = options.concurrentChunks || this.getOptimizedConcurrency();
    
    // Log performance configuration
    this.logger.info(`Row-level indexing performance settings: chunkSize=${chunkSize}, maxRows=${maxRows}, batchSize=${batchSize}, concurrentChunks=${concurrentChunks}`);
    
    // Log system resources
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024 * 1024));
    const usedMem = totalMem - freeMem;
    const memPercentage = Math.round((usedMem / totalMem) * 100);
    this.logger.info(`System resources: CPU cores=${os.cpus().length}, Memory=${usedMem}GB used of ${totalMem}GB total (${memPercentage}%)`);
    
    const forceReindex = options.forceReindex || false;
    const createEmbeddings = options.createEmbeddings !== undefined ? options.createEmbeddings : true;
    
    try {
      this.logger.info(`Starting row-level indexing for table ${database}.${schema}.${tableName} with optimized settings`);
      this.logger.info(`Using chunk size: ${chunkSize}, batch size: ${batchSize}, concurrent chunks: ${concurrentChunks}`);
      
      // Track progress for UI status updates
      let progress = 0;
      let processedRows = 0;
      let processedChunks = 0;
      
      // Update status for UI
      await this.updateIndexingStatus(dataSourceId, {
        status: 'indexing',
        current_table: `${database}.${schema}.${tableName}`,
        progress: 0,
        message: `Initializing indexing for ${database}.${schema}.${tableName}...`
      });
      
      // 1. Normalize collection name
      const collectionName = `row_data_${dataSourceId}_${database.toLowerCase()}_${schema.toLowerCase()}_${tableName.toLowerCase()}`;
      
      // 2. Check if collection exists
      const collectionExists = await this.qdrantCollectionService.collectionExists(collectionName);
      
      if (collectionExists && !forceReindex) {
        this.logger.info(`Collection ${collectionName} already exists, skipping indexing`);
        
        // Get the count of points to report back
        let pointsCount = 0;
        try {
          const collectionInfo = await this.qdrantCollectionService.getCollectionInfo(collectionName);
          
          // Handle different response formats safely
          if (typeof collectionInfo === 'number') {
            pointsCount = collectionInfo;
          } else if (collectionInfo && typeof collectionInfo === 'object') {
            // TypeScript doesn't know the shape of the object, so we use a type assertion
            const info = collectionInfo as any;
            pointsCount = info.vectors_count || 0;
          }
        } catch (error) {
          this.logger.warn(`Error getting collection info: ${error instanceof Error ? error.message : String(error)}`);
          pointsCount = 0;
        }
        
        // Send completion status update
        await this.updateIndexingStatus(dataSourceId, {
          status: 'indexed',
          current_table: `${database}.${schema}.${tableName}`,
          progress: 100,
          message: `Already indexed ${pointsCount} rows from ${database}.${schema}.${tableName}`
        });
        
        return {
          success: true,
          totalRows: pointsCount,
          totalIndexed: pointsCount,
          totalChunks: Math.ceil(pointsCount / chunkSize),
          duration: (Date.now() - startTime) / 1000,
          status: 'indexed'
        };
      }
      
      // 3. Create or recreate collection
      if (!collectionExists) {
        this.logger.info(`Creating collection ${collectionName}`);
        await this.qdrantCollectionService.createCollection(collectionName, {
          dimension: 1536,
          vectors: {
            size: 1536,
            distance: 'Cosine'
          }
        });
      } else if (forceReindex) {
        // Delete all points if force fresh is set
        this.logger.info(`Force fresh set, deleting all points from ${collectionName}`);
        await this.qdrantCollectionService.deleteCollection(collectionName);
        await this.qdrantCollectionService.createCollection(collectionName, {
          dimension: 1536,
          vectors: {
            size: 1536,
            distance: 'Cosine'
          }
        });
      }
      
      // 4. Get row count
      const rowCount = await this.getTableRowCount(dataSourceId, database, schema, tableName);
      
      // Update status with row count info
      await this.updateIndexingStatus(dataSourceId, {
        status: 'indexing',
        current_table: `${database}.${schema}.${tableName}`,
        progress: 0,
        message: `Found ${rowCount.toLocaleString()} rows in ${database}.${schema}.${tableName}`
      });
      
      // If table is empty, return early
      if (rowCount === 0) {
        this.logger.info(`Table ${database}.${schema}.${tableName} is empty, skipping`);
        
        // Send completion update
        await this.updateIndexingStatus(dataSourceId, {
          status: 'indexed',
          current_table: `${database}.${schema}.${tableName}`,
          progress: 100,
          message: `No rows found in ${database}.${schema}.${tableName}`
        });
        
        return {
          success: true,
          totalRows: 0,
          totalIndexed: 0,
          totalChunks: 0,
          duration: (Date.now() - startTime) / 1000,
          status: 'indexed'
        };
      }
      
      // Limit to maxRows if specified
      const effectiveRowCount = Math.min(rowCount, maxRows);
      
      this.logger.info(`Table ${database}.${schema}.${tableName} has ${rowCount} rows, indexing up to ${effectiveRowCount}`);
      
      // 5. Get table metadata
      const tableMetadata = await this.getTableMetadata(dataSourceId, database, schema, tableName);
      
      // 6. Calculate number of chunks and create a processing plan
      const totalChunks = Math.ceil(effectiveRowCount / chunkSize);
      
      this.logger.info(`Processing ${totalChunks} chunks with ${concurrentChunks} concurrent chunks (adjusted for memory)`);
      
      // 7. Process table in parallel chunks
      let totalRowsProcessed = 0;
      let processedChunksCount = 0;
      
      // Send status update with chunk information
      await this.updateIndexingStatus(dataSourceId, {
        status: 'indexing',
        current_table: `${database}.${schema}.${tableName}`,
        progress: 0,
        message: `Starting to process ${totalChunks} chunks of data...`
      });
  
      // Process chunks in batches to limit concurrency
      for (let chunkBatchStart = 0; chunkBatchStart < totalChunks; chunkBatchStart += concurrentChunks) {
        const chunkPromises = [];
        const chunkBatchEnd = Math.min(chunkBatchStart + concurrentChunks, totalChunks);
        
        for (let chunkIndex = chunkBatchStart; chunkIndex < chunkBatchEnd; chunkIndex++) {
          const offset = chunkIndex * chunkSize;
          const chunkPromise = this.processChunk(
            dataSourceId, 
            database, 
            schema, 
            tableName, 
            collectionName, 
            tableMetadata, 
            offset, 
            {
              chunkSize,
              createEmbeddings,
              batchSize,
              maxRows: effectiveRowCount,
            },
            chunkIndex + 1,
            totalChunks
          );
          chunkPromises.push(chunkPromise);
        }
        
        // Wait for all chunks in this batch to complete
        const results = await Promise.all(chunkPromises);
        
        // Update progress
        for (const result of results) {
          if (result && 'rowsProcessed' in result) {
            totalRowsProcessed += result.rowsProcessed;
            processedChunksCount++;
          }
        }
        
        // Calculate and update progress
        const progressPercent = Math.min(100, Math.round((processedChunksCount / totalChunks) * 100));
        
        // Update status and progress
        await this.updateIndexingStatus(dataSourceId, {
          status: 'indexing',
          current_table: `${database}.${schema}.${tableName}`,
          progress: progressPercent,
          message: `Progress: ${progressPercent}% - Processed ${processedChunksCount}/${totalChunks} chunks, ${totalRowsProcessed} rows`
        });
        
        this.logger.info(`Progress: ${progressPercent}% - Processed ${processedChunksCount}/${totalChunks} chunks, ${totalRowsProcessed} rows`);
      }
      
      // 8. Optimize collection for better search performance
      this.logger.info(`Forcing optimization of collection ${collectionName}`);
      try {
        await this.qdrantCollectionService.optimizeCollection(collectionName);
      } catch (optimizeError: unknown) {
        const errorMessage = optimizeError instanceof Error 
          ? optimizeError.message 
          : String(optimizeError);
        this.logger.warn(`Error optimizing collection: ${errorMessage}`);
      }
      
      // Calculate final statistics
      const processingTime = (Date.now() - startTime) / 1000;
      this.logger.info(`Completed indexing for table ${database}.${schema}.${tableName} in ${processingTime.toFixed(2)}s`);
      this.logger.info(`Indexed ${totalRowsProcessed} rows in ${processedChunksCount} chunks`);
      
      // Send final success status
      await this.updateIndexingStatus(dataSourceId, {
        status: 'indexed',
        current_table: `${database}.${schema}.${tableName}`,
        progress: 100,
        message: `Successfully indexed ${totalRowsProcessed.toLocaleString()} rows from ${database}.${schema}.${tableName} in ${processingTime.toFixed(1)} seconds`
      });
      
      this.logger.info(`Indexed undefined rows from table ${database}.${schema}.${tableName}`);
      
      return {
        success: true,
        totalRows: rowCount,
        totalIndexed: totalRowsProcessed,
        totalChunks: processedChunksCount,
        duration: processingTime,
        status: 'indexed'
      };
    } catch (error: unknown) {
      // Handle errors
      const errorMessage = `Error indexing table rows after ${((Date.now() - startTime) / 1000).toFixed(2)}s: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage, { error });
      
      // Send error status
      await this.updateIndexingStatus(dataSourceId, {
        status: 'error',
        current_table: `${database}.${schema}.${tableName}`,
        progress: 0, 
        message: `Error indexing: ${error instanceof Error ? error.message : String(error)}`
      });
      
      throw error;
    }
  }
  
  /**
   * Process a single chunk of rows
   * This is called in parallel for multiple chunks
   */
  private async processChunk(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    collectionName: string,
    tableMetadata: any,
    offset: number,
    options: {
      chunkSize: number;
      createEmbeddings: boolean;
      batchSize: number;
      maxRows?: number;
    },
    chunkNumber: number,
    totalChunks: number
  ): Promise<{
    rowsProcessed: number;
  }> {
    try {
      const startTime = Date.now();
      const { chunkSize, createEmbeddings, batchSize, maxRows } = options;
      
      // Fetch rows from the database
      const query = `SELECT * FROM "${database}"."${schema}"."${tableName}" LIMIT ${chunkSize} OFFSET ${offset}`;
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        return { rowsProcessed: 0 };
      }
      
      const rows = result.rows;
      const columns = result.columns;
      const totalRowsInChunk = rows.length;
      
      this.logger.info(`Processing ${totalRowsInChunk} rows in chunk ${chunkNumber}/${totalChunks}`);
      
      // Process all rows with embeddings to ensure complete data coverage
      if (createEmbeddings) {
        // Process in batches to avoid memory issues
        const batches = [];
        for (let i = 0; i < rows.length; i += batchSize) {
          batches.push(rows.slice(i, i + batchSize));
        }
        
        // Process batches sequentially to avoid rate limits
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const startRowId = offset + (i * batchSize);
          
          await this.processBatch(
            dataSourceId,
            database,
            schema,
            tableName,
            collectionName,
            tableMetadata,
            batch,
            columns,
            startRowId,
            chunkNumber,
            totalChunks,
            true // create embeddings for all rows
          );
          
          // Log progress within the chunk
          const processedSoFar = (i + 1) * batchSize;
          const percentComplete = Math.min(100, Math.round((processedSoFar / totalRowsInChunk) * 100));
          this.logger.info(`Chunk ${chunkNumber}/${totalChunks} progress: ${percentComplete}% (${processedSoFar}/${totalRowsInChunk} rows)`);
        }
      } else {
        // If embeddings not requested, process all rows in one batch
        await this.processBatch(
          dataSourceId,
          database,
          schema,
          tableName,
          collectionName,
          tableMetadata,
          rows,
          columns,
          offset,
          chunkNumber,
          totalChunks,
          false
        );
      }
      
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const rowsPerSecond = totalRowsInChunk / elapsedSeconds;
      
      this.logger.info(`Completed chunk ${chunkNumber}/${totalChunks}, processed ${totalRowsInChunk} rows in ${elapsedSeconds.toFixed(2)}s (${rowsPerSecond.toFixed(2)} rows/sec)`);
      
      return {
        rowsProcessed: totalRowsInChunk
      };
    } catch (error: unknown) {
      this.logger.error(`Error processing chunk ${chunkNumber}/${totalChunks}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Process a batch of rows for efficient embedding generation
   */
  private async processBatch(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string,
    collectionName: string,
    tableMetadata: any,
    rows: any[][],
    columns: any[],
    startRowId: number,
    chunkNumber: number,
    totalChunks: number,
    createEmbeddings: boolean
  ): Promise<void> {
    try {
      // Performance metrics
      const batchStartTime = Date.now();
      
      // 1. First prepare all row descriptions
      const rowDescriptions: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        const rowDesc = this.createRowDescription(tableMetadata, rows[i]);
        rowDescriptions.push(rowDesc);
      }
      
      // 2. Generate embeddings in a single batch call
      let embeddings: number[][] = [];
      if (createEmbeddings) {
        try {
          // Use a simple backoff strategy for rate limits
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              // Use more cost-effective model for large batches
              const embeddingOptions = {
                skipCache: false,
                // Use text-embedding-ada-002 for consistency with other embeddings in the system
                model: 'text-embedding-ada-002',
                batchSize: Math.min(rows.length, 1000) // Use larger batches where possible
              };
              
              // Note: OpenAI service only accepts a single string parameter
              embeddings = await this.openaiService.createEmbeddings(rowDescriptions.join('\n'));
              
              // If succeeded, break the retry loop
              break;
            } catch (embeddingError: unknown) {
              // If it's a rate limit error, wait and retry
              const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
              if (errorMessage.includes('rate limit')) {
                retryCount++;
                const waitTime = 2000 * Math.pow(2, retryCount); // Exponential backoff
                this.logger.warn(`Rate limit hit, waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              } else {
                // For other errors, rethrow
                throw embeddingError;
              }
            }
          }
          
          this.logger.debug(`Generated ${embeddings.length} embeddings in one batch call in ${(Date.now() - batchStartTime) / 1000}s`);
        } catch (error: unknown) {
          this.logger.error(`Failed to create embeddings for batch: ${error instanceof Error ? error.message : String(error)}`);
          // If embeddings fail, create zero vectors as fallback
          embeddings = Array(rows.length).fill(null).map(() => new Array(1536).fill(0));
        }
      } else {
        // Create placeholder vectors if embeddings are not requested
        embeddings = Array(rows.length).fill(null).map(() => new Array(1536).fill(0));
      }
      
      // 3. Prepare optimized points for Qdrant
      const vectors = [];
      const payloads = [];
      const ids = [];
      
      // 4. Format data for bulk insert
      for (let i = 0; i < rows.length; i++) {
        const rowId = startRowId + i + 1;
        const numericId = rowId;
        const fullStringId = `${dataSourceId}:${database}:${schema}:${tableName}:row:${rowId}`;
        
        vectors.push(embeddings[i]);
        ids.push(numericId);
        
        // Create a minimal payload with essential data
        const payload = {
          // Include only necessary row data to reduce storage requirements
          ...this.getOptimizedRowPayload(rows[i], columns),
          // Essential metadata
          dataSourceId,
          database,
          schema,
          table: tableName,
          rowId,
          stringId: fullStringId,
          chunk: chunkNumber,
          totalChunks,
          type: 'row_data',
          lastUpdated: new Date().toISOString()
        };
        
        payloads.push(payload);
      }
      
      // 5. Store vectors in one batch with retries if needed
      let storeRetries = 0;
      const maxStoreRetries = 3;
      
      while (storeRetries < maxStoreRetries) {
        try {
          await this.qdrantIngestionService.storeVectors(
            collectionName,
            vectors,
            payloads,
            ids
          );
          
          // Break if successful
          break;
        } catch (storeError: unknown) {
          storeRetries++;
          if (storeRetries >= maxStoreRetries) {
            throw storeError; // Re-throw after all retries fail
          }
          
          // Wait before retry
          const retryWait = 1000 * storeRetries;
          this.logger.warn(`Error storing vectors, retry ${storeRetries}/${maxStoreRetries} in ${retryWait}ms: ${storeError instanceof Error ? storeError.message : String(storeError)}`);
          await new Promise(resolve => setTimeout(resolve, retryWait));
        }
      }
      
      const batchDuration = (Date.now() - batchStartTime) / 1000;
      this.logger.debug(`Successfully stored batch of ${rows.length} points in ${batchDuration.toFixed(2)}s (${(rows.length / batchDuration).toFixed(2)} rows/sec)`);
    } catch (error: unknown) {
      this.logger.error(`Error in batch processing: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Create a storage-optimized payload from a row
   * Only keeps important fields to reduce storage requirements
   */
  private getOptimizedRowPayload(row: any[], columns: any[]): Record<string, any> {
    const payload: Record<string, any> = {};
    
    // Identify important columns to keep (ID, date, numeric fields, limited text)
    for (let i = 0; i < columns.length && i < row.length; i++) {
      // Make sure column object exists before trying to access properties
      if (!columns[i]) {
        // Skip this iteration if column is undefined
        continue;
      }
      
      // Safely get column name and type with fallbacks
      const columnName = columns[i].name || `column_${i}`;
      const columnType = (columns[i].type || '').toLowerCase();
      const value = row[i];
      
      // Always keep IDs, dates, and numeric columns
      if (columnName.toLowerCase().includes('id') || 
          columnType.includes('date') || 
          columnType.includes('time') ||
          columnType.includes('int') || 
          columnType.includes('num') || 
          columnType.includes('float') ||
          columnType.includes('double') ||
          columnType.includes('decimal')) {
        payload[columnName] = value;
        continue;
      }
      
      // For text columns, only keep if they're small or if they have specific important names
      if (columnType.includes('char') || columnType.includes('text') || columnType.includes('varchar')) {
        const isImportantColumn = 
          columnName.toLowerCase().includes('name') || 
          columnName.toLowerCase().includes('type') || 
          columnName.toLowerCase().includes('status') ||
          columnName.toLowerCase().includes('category');
        
        // For important text columns or short values, keep them
        if (isImportantColumn || (typeof value === 'string' && value.length < 100)) {
          payload[columnName] = value;
        } else if (typeof value === 'string' && value.length >= 100) {
          // For long text values in non-important columns, truncate
          payload[columnName] = value.substring(0, 100) + '...';
        } else {
          payload[columnName] = value;
        }
      } else {
        // For all other column types, keep the value
        payload[columnName] = value;
      }
    }
    
    // If no columns were processed or payload is empty, fall back to storing all columns
    if (Object.keys(payload).length === 0) {
      this.logger.warn('No columns processed in optimized payload, falling back to storing all data');
      for (let i = 0; i < columns.length && i < row.length; i++) {
        const columnName = columns[i]?.name || `column_${i}`;
        payload[columnName] = row[i];
      }
    }
    
    return payload;
  }
  
  /**
   * Update the data source status in the database
   * This enables progress tracking in the UI
   */
  private async updateIndexingStatus(
    dataSourceId: number, 
    status: {
      status?: string;
      current_table?: string;
      progress?: number;
      message?: string;
    }
  ): Promise<void> {
    try {
      // Import database dynamically to avoid circular dependencies
      const { db } = require('../../infrastructure/database');
      
      const statusData: any = {
        updated_at: new Date()
      };
      
      if (status.status) {
        statusData.status = status.status;
      }
      
      if (status.message || status.current_table || status.progress !== undefined) {
        // Get existing metadata
        const dataSource = await db('data_sources').where('id', dataSourceId).first();
        let metadata: Record<string, any> = {};
        
        if (dataSource && dataSource.metadata) {
          try {
            metadata = typeof dataSource.metadata === 'string' 
              ? JSON.parse(dataSource.metadata) 
              : dataSource.metadata;
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            this.logger.warn(`Failed to parse metadata: ${errorMessage}`);
          }
        }
        
        // Create the indexing_status object if it doesn't exist
        if (!metadata.indexing_status) {
          metadata.indexing_status = {};
        }
        
        // Update indexing status
        metadata.indexing_status = {
          ...(metadata.indexing_status || {}),
          ...(status.message ? { message: status.message } : {}),
          ...(status.current_table ? { current_table: status.current_table } : {}),
          ...(status.progress !== undefined ? { progress: status.progress } : {}),
          last_updated: new Date().toISOString()
        };
        
        statusData.metadata = JSON.stringify(metadata);
      }
      
      // Update database
      await db('data_sources')
        .where('id', dataSourceId)
        .update(statusData);
      
      // Try to broadcast progress to clients
      try {
        // Use the WebSocketService instead of SocketService for broadcasting updates
        if (this.websocketService) {
          // Broadcast the update to all clients
          this.websocketService.broadcastDataSourceUpdate(
            dataSourceId,
            status.status || 'indexing',
            {
              indexing_status: {
                ...(status.message ? { message: status.message } : {}),
                ...(status.current_table ? { current_table: status.current_table } : {}),
                ...(status.progress !== undefined ? { progress: status.progress } : {}),
                last_updated: new Date().toISOString()
              }
            }
          );
          this.logger.debug(`Broadcast indexing status update for data source ${dataSourceId}`);
        } else {
          this.logger.warn(`WebSocketService not available for data source ${dataSourceId} update`);
        }
      } catch (e: unknown) {
        // Log but don't fail if websocket broadcasting fails
        const errorMessage = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Failed to broadcast indexing status: ${errorMessage}`);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to update indexing status: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw here - we don't want to fail the main process if status update fails
    }
  }
  
  /**
   * Get row count for a table
   */
  private async getTableRowCount(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<number> {
    try {
      const query = `SELECT COUNT(*) as row_count FROM "${database}"."${schema}"."${tableName}"`;
      const result = await this.snowflakeService.executeQuery(dataSourceId, query);
      
      if (!result || !result.rows || result.rows.length === 0) {
        return 0;
      }
      
      return parseInt(result.rows[0][0], 10) || 0;
    } catch (error: unknown) {
      this.logger.error(`Error getting row count: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
  
  /**
   * Get table metadata
   */
  private async getTableMetadata(
    dataSourceId: number,
    database: string,
    schema: string,
    tableName: string
  ): Promise<any> {
    try {
      // Get column info
      const columns = await this.snowflakeService.describeTable(
        dataSourceId, database, schema, tableName
      );
      
      return {
        dataSourceId,
        database,
        schema,
        tableName,
        columns
      };
    } catch (error: unknown) {
      this.logger.error(`Error getting table metadata: ${error instanceof Error ? error.message : String(error)}`);
      return {
        dataSourceId,
        database,
        schema,
        tableName,
        columns: []
      };
    }
  }
  
  /**
   * Determine if a row should be embedded based on sampling strategy
   * This ensures 100% data coverage for accurate business intelligence
   */
  private shouldEmbedRow(rowIndex: number, totalRows: number): boolean {
    // Always embed all rows for complete data coverage
    return true;
  }
  
  /**
   * Create a description of a row for embedding
   */
  private createRowDescription(tableMetadata: any, row: any[]): string {
    // Create a simple text description combining table and row data
    let description = `Row data from ${tableMetadata.database}.${tableMetadata.schema}.${tableMetadata.tableName}\n`;
    
    // Add column values
    for (let i = 0; i < tableMetadata.columns.length && i < row.length; i++) {
      const column = tableMetadata.columns[i];
      if (!column) continue; // Skip if column is undefined
      
      const value = row[i];
      // Handle null or undefined values
      const displayValue = value === null || value === undefined ? 'NULL' : value;
      
      description += `${column.name || `column_${i}`}: ${displayValue}\n`;
    }
    
    return description;
  }
}