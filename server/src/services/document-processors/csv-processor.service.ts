import { injectable } from 'inversify';
import { BaseDocumentProcessor, ProcessingResult, DataSourceStatus } from './base-document-processor';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config.service';
import { ChunkingService } from '../chunking.service';
import { QdrantService } from '../qdrant.service';
import { db } from '../../infrastructure/database';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketService } from '../websocket.service';
import { OpenAIService } from '../openai.service';
import { createServiceLogger } from '../../utils/logger-factory';
import OpenAI from 'openai';

// Define ParseConfig type interface to match csv-parse options
interface ParseConfig {
  delimiter?: string;
  columns?: boolean | string[] | ((...args: any[]) => string[]);
  skip_empty_lines?: boolean;
  trim?: boolean;
  [key: string]: any;
}

/**
 * Processor for CSV files
 */
@injectable()
export class CsvProcessorService extends BaseDocumentProcessor {
  public processorName = 'CSV Processor';
  protected logger = createServiceLogger('CsvProcessorService');
  private batchSize = 50; // Default batch size for processing
  private openaiService: OpenAIService;

  constructor(
    protected readonly configService: ConfigService,
    protected readonly chunkingService: ChunkingService,
    protected readonly qdrantService: QdrantService,
    private readonly websocketService: WebSocketService
  ) {
    super('CsvProcessorService');
    this.openaiService = OpenAIService.getInstance();
    this.logger.info('CSV Processor Service initialized');
  }

  /**
   * Detects CSV delimiter and other format options
   */
  private detectCsvFormat(sampleContent: string): ParseConfig {
    this.logger.info('Detecting CSV format');
    
    // Default options
    const options: ParseConfig = {
      columns: true,
      skip_empty_lines: true,
      trim: true
    };
    
    // Count possible delimiters
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(d => ({
      delimiter: d,
      count: (sampleContent.match(new RegExp(d, 'g')) || []).length
    }));
    
    // Find the most common non-zero delimiter
    const mostCommon = counts
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)[0];
    
    if (mostCommon) {
      options.delimiter = mostCommon.delimiter;
      this.logger.info(`Detected delimiter: "${mostCommon.delimiter}"`);
    } else {
      this.logger.info('Using default delimiter: ","');
    }
    
    // Check if file has a header row (if first row has different types than second row)
    const lines = sampleContent.split('\n').slice(0, 2);
    if (lines.length >= 2) {
      const firstRowColumnCount = lines[0].split(options.delimiter as string).length;
      const secondRowColumnCount = lines[1].split(options.delimiter as string).length;
      
      if (firstRowColumnCount !== secondRowColumnCount) {
        this.logger.info('First two rows have different column counts, assuming header row');
        options.columns = true;
      } else {
        // Try to infer if first row is header by checking if it contains mostly strings
        // while second row contains mostly numbers
        const firstRowIsNumeric = lines[0]
          .split(options.delimiter as string)
          .every(cell => !isNaN(Number(cell.trim())));
          
        const secondRowIsNumeric = lines[1]
          .split(options.delimiter as string)
          .every(cell => !isNaN(Number(cell.trim())));
        
        if (!firstRowIsNumeric && secondRowIsNumeric) {
          this.logger.info('First row appears to be header based on content type difference');
          options.columns = true;
        }
      }
    }
    
    return options;
  }
  
  /**
   * Preprocesses CSV data to handle common issues
   */
  private preprocessCsvData(records: any[]): any[] {
    this.logger.info(`Preprocessing ${records.length} CSV records`);
    
    // Step 1: Handle empty values consistently
    const processed = records.map(record => {
      const processedRecord: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(record)) {
        // Skip empty column names
        if (!key || key.trim() === '') continue;
        
        // Normalize keys (trim whitespace, replace spaces with underscores)
        const normalizedKey = key.trim().replace(/\s+/g, '_');
        
        // Handle empty values consistently
        if (value === undefined || value === null || value === '') {
          processedRecord[normalizedKey] = null;
        } else if (typeof value === 'string') {
          // Trim string values
          processedRecord[normalizedKey] = value.trim();
        } else {
          processedRecord[normalizedKey] = value;
        }
      }
      
      return processedRecord;
    });
    
    // For DNS records, we keep all values as strings without type conversion
    const enhancedRecords = processed.map(record => {
      const enhancedRecord: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(record)) {
        // Keep all values as strings for DNS records
        enhancedRecord[key] = value !== null ? String(value) : null;
      }
      
      return enhancedRecord;
    });
    
    this.logger.info(`Preprocessing complete, processed ${enhancedRecords.length} records`);
    this.logger.debug('Sample record:', enhancedRecords[0]);
    return enhancedRecords;
  }
  
  /**
   * Creates optimized document chunks from CSV records based on configuration
   */
  private createDocumentChunks(
    records: any[], 
    options: {
      chunkSize?: number;
      includeHeaders?: boolean;
      combineRows?: boolean;
      combineCount?: number;
    } = {}
  ) {
    // For CSV files, we want to combine rows by default for better embeddings
    const {
      includeHeaders = true, // Include column headers in each chunk
      combineRows = true, // Use smart row combination by default
      combineCount = 10 // Combine more rows for better embedding context
    } = options;
    
    this.logger.info(`Creating document chunks with options: ${JSON.stringify({
      includeHeaders, combineRows, combineCount
    })}`);
    
    const chunks = [];
    
    // Get column names once for reference
    let columnNames: string[] = [];
    if (records.length > 0) {
      columnNames = Object.keys(records[0]);
      this.logger.info(`CSV has ${columnNames.length} columns: ${columnNames.join(', ')}`);
    }
    
    // Calculate average row text length to determine optimal chunking
    let totalLength = 0;
    records.forEach(record => {
      let rowText = '';
      for (const [key, value] of Object.entries(record)) {
        rowText += `${key}: ${value !== null ? value : 'N/A'}\n`;
      }
      totalLength += rowText.length;
    });
    
    const avgRowLength = records.length > 0 ? Math.floor(totalLength / records.length) : 0;
    this.logger.info(`Average row text length: ${avgRowLength} characters`, { avgRowLength });
    
    // Adjust combineCount based on row length to optimize for embedding
    // Ideal chunk size for embedding is around 1000-2000 characters
    const targetChunkSize = 1500;
    const calculatedCombineCount = avgRowLength > 0 ? Math.max(1, Math.min(50, Math.floor(targetChunkSize / avgRowLength))) : combineCount;
    
    // Use the calculated or specified combineCount
    const finalCombineCount = combineRows ? calculatedCombineCount : combineCount;
    this.logger.info(`Using ${finalCombineCount} rows per chunk based on row length`, { finalCombineCount, avgRowLength });
    
    if (combineRows) {
      // Combine multiple records into a single chunk for better context
      for (let i = 0; i < records.length; i += finalCombineCount) {
        const recordBatch = records.slice(i, i + finalCombineCount);
        let combinedText = '';
        
        if (includeHeaders && columnNames.length > 0) {
          // Add a header section with column names if useful
          combinedText += `CSV Columns: ${columnNames.join(', ')}\n\n`;
        }
        
        // Add structured data section
        combinedText += `Records ${i + 1} to ${i + recordBatch.length}:\n\n`;
        
        recordBatch.forEach((record, index) => {
          combinedText += `-- Record ${i + index + 1} --\n`;
          
          for (const [key, value] of Object.entries(record)) {
            // Format non-empty values
            const formattedValue = value !== null && value !== undefined && value !== '' ? 
              String(value).trim() : 'N/A';
            
            // Skip empty values to reduce noise
            if (formattedValue !== 'N/A') {
              combinedText += `${key}: ${formattedValue}\n`;
            }
          }
          
          combinedText += '\n';
        });
        
        chunks.push({
          text: combinedText.trim(),
          metadata: {
            source: `csv_records_${i + 1}_to_${i + recordBatch.length}`,
            recordIds: recordBatch.map((_, idx) => i + idx + 1),
            recordCount: recordBatch.length,
            columnCount: columnNames.length,
            columns: columnNames
          }
        });
      }
    } else {
      // Process each record individually (not recommended for most CSV files)
      this.logger.warn('Processing individual CSV rows - this may create too many small chunks');
      records.forEach((record, index) => {
        let text = '';
        
        if (includeHeaders && columnNames.length > 0) {
          // Add column names for context
          text += `CSV Columns: ${columnNames.join(', ')}\n\n`;
        }
        
        text += `Record ${index + 1}:\n`;
        
        // Format as "field: value" pairs
        for (const [key, value] of Object.entries(record)) {
          const formattedValue = value !== null && value !== undefined && value !== '' ? 
            String(value).trim() : 'N/A';
          
          // Skip empty values to reduce noise
          if (formattedValue !== 'N/A') {
            text += `${key}: ${formattedValue}\n`;
          }
        }
        
        chunks.push({
          text: text.trim(),
          metadata: {
            source: `csv_record_${index + 1}`,
            recordId: index + 1,
            recordFields: Object.keys(record),
            columns: columnNames
          }
        });
      });
    }
    
    // Filter out any chunks with too little text
    const filteredChunks = chunks.filter(chunk => {
      if (!chunk.text || chunk.text.trim().length < 10) {
        this.logger.warn(`Filtering out chunk with insufficient text (length ${chunk.text?.length || 0})`);
        return false;
      }
      return true;
    });
    
    this.logger.info(`Created ${filteredChunks.length} document chunks from ${records.length} CSV records`);
    
    if (filteredChunks.length > 0) {
      this.logger.debug(`Sample chunk: "${filteredChunks[0].text.substring(0, 200)}..."`);
    }
    
    return filteredChunks;
  }

  /**
   * Process a CSV file
   * @param filePath Path to the CSV file
   * @param dataSourceId ID of the data source
   * @param metadata Additional metadata
   * @returns Processing result
   */
  async processFile(
    filePath: string, 
    dataSourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    this.logger.info(`Processing CSV file for data source ${dataSourceId}`);
    this.logger.debug(`File path: ${filePath}`);
    this.logger.debug('Metadata:', metadata);
    
    // Initialize resolvedDataSourceId to handle both UUID and integer formats
    let resolvedDataSourceId: number | null = null;
    let dataSource = null;
    
    try {
      // Check if file exists
      let validatedFilePath = filePath;
      
      try {
        this.logger.info(`Validating file existence: ${filePath}`);
        if (!fs.existsSync(filePath)) {
          throw new Error(`File does not exist: ${filePath}`);
        }
        this.logger.info(`CSV file exists at path: ${filePath}`);
      } catch (error) {
        this.logger.error(`File validation error: ${error instanceof Error ? error.message : String(error)}`);
        
        if (metadata?.filePath) {
          this.logger.info(`Attempting to use file path from metadata: ${metadata.filePath}`);
          validatedFilePath = metadata.filePath;
          
          if (!fs.existsSync(validatedFilePath)) {
            this.logger.error(`File from metadata path does not exist either: ${validatedFilePath}`);
            throw new Error(`File does not exist at either path: ${filePath} or ${validatedFilePath}`);
          }
          
          this.logger.info(`Using alternative file path from metadata: ${validatedFilePath}`);
        } else {
          this.logger.error('No alternative file path found in metadata');
          throw error;
        }
      }
      
      // Skip DB query if specified in metadata
      if (!metadata?.skipDatabaseCheck) {
        // Convert the dataSourceId to a number if it's a valid integer string
        // Otherwise, keep it as is (could be a UUID)
        if (!isNaN(Number(dataSourceId)) && Number(dataSourceId).toString() === dataSourceId) {
          resolvedDataSourceId = Number(dataSourceId);
        }
        
        try {
          // First try to look up by direct ID match
          if (resolvedDataSourceId !== null) {
            dataSource = await db('data_sources').where('id', resolvedDataSourceId).first();
          }
          
          // If not found, try to look up by ID in metadata
          if (!dataSource) {
            dataSource = await db('data_sources')
              .whereRaw(`metadata->>'id' = ?`, [dataSourceId])
              .first();
          }
          
          if (dataSource) {
            this.logger.info(`Found data source: ${JSON.stringify({
              id: dataSource.id,
              name: dataSource.name,
              type: dataSource.type,
              status: dataSource.status
            })}`);
            
            // Ensure resolvedDataSourceId is now the numeric ID
            resolvedDataSourceId = dataSource.id;
          } else {
            this.logger.warn(`No data source found for ID: ${dataSourceId}`);
            
            if (!metadata?.directProcessing) {
              throw new Error(`Data source not found for ID: ${dataSourceId}`);
            }
            
            this.logger.info('Continuing with direct processing as specified in metadata');
          }
        } catch (dbError) {
          this.logger.error(`Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          throw new Error(`Failed to query data source: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }
      } else {
        this.logger.info('Skipping database check as specified in metadata');
      }
      
      // Update data source status to processing if found and not in processing state
      if (dataSource && dataSource.status !== 'processing') {
        try {
          await db('data_sources')
            .where('id', dataSource.id)
            .update({
              status: 'processing',
              updated_at: new Date()
            });
          
          this.logger.info(`Updated data source ${dataSource.id} status to 'processing'`);
          
          // Notify clients via WebSocket
          this.websocketService.broadcastDataSourceUpdate(
            dataSource.id,
            'processing',
            {
              id: dataSource.id,
              action: 'dataSource.updated',
              status: 'processing'
            }
          );
        } catch (updateError) {
          this.logger.error(`Error updating data source status: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
          // Continue processing even if status update fails
        }
      }
      
      // Read and parse the CSV file
      let fileContent: string;
      
      try {
        fileContent = fs.readFileSync(validatedFilePath, { encoding: 'utf-8' });
        this.logger.info(`Successfully read CSV file: ${path.basename(validatedFilePath)} (${fileContent.length} bytes)`);
        
        if (!fileContent || fileContent.trim().length === 0) {
          throw new Error('CSV file is empty');
        }
        
        // Parse CSV with fixed options for DNS records
        const parsedRecords = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ',',  // DNS records use comma delimiter
          quote: '"',
          escape: '"',
          relax_quotes: false,
          relax_column_count: false
        });
        
        if (!Array.isArray(parsedRecords) || parsedRecords.length === 0) {
          throw new Error('CSV file contains no valid records');
        }
        
        this.logger.info(`Successfully parsed ${parsedRecords.length} records from CSV file`);
        this.logger.debug('First record sample:', parsedRecords[0]);
        
        // Apply preprocessing to the parsed records
        const processedRecords = this.preprocessCsvData(parsedRecords);
        this.logger.info(`Preprocessed ${processedRecords.length} records`);
        
        // Create collection in Qdrant if it doesn't exist
        const collectionName = `datasource_${resolvedDataSourceId || dataSourceId}`;
        this.logger.info(`Checking if Qdrant collection exists: ${collectionName}`);
        
        let collectionExists = false;
        try {
          collectionExists = await this.qdrantService.collectionExists(collectionName);
          this.logger.info(`Collection ${collectionName} exists: ${collectionExists}`);
        } catch (qdrantError) {
          this.logger.error(`Error checking Qdrant collection: ${qdrantError instanceof Error ? qdrantError.message : String(qdrantError)}`);
          throw new Error(`Failed to check Qdrant collection: ${qdrantError instanceof Error ? qdrantError.message : String(qdrantError)}`);
        }
        
        if (!collectionExists) {
          this.logger.info(`Creating Qdrant collection: ${collectionName}`);
          try {
            await this.qdrantService.createCollection(collectionName, {
              vectors: {
                size: 1536, // OpenAI embeddings are 1536-dimensional
                distance: 'Cosine'
              }
            });
            this.logger.info(`Successfully created Qdrant collection: ${collectionName}`);
            
            // Verify creation
            collectionExists = await this.qdrantService.collectionExists(collectionName);
            if (!collectionExists) {
              throw new Error(`Failed to verify Qdrant collection creation: ${collectionName}`);
            }
          } catch (createError) {
            this.logger.error(`Error creating Qdrant collection: ${createError instanceof Error ? createError.message : String(createError)}`);
            throw new Error(`Failed to create Qdrant collection: ${createError instanceof Error ? createError.message : String(createError)}`);
          }
        }
        
        // Create document chunks for embedding
        const documentChunks = this.createDocumentChunks(processedRecords, {
          includeHeaders: true,
          combineRows: false
        });
        this.logger.info(`Created ${documentChunks.length} document chunks for embedding`);
        
        // Process in batches to avoid memory issues
        const batchSize = this.batchSize;
        let totalProcessed = 0;
        let failedChunks = 0;
        
        // Process chunks in batches
        for (let i = 0; i < documentChunks.length; i += batchSize) {
          const batch = documentChunks.slice(i, i + batchSize);
          this.logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documentChunks.length/batchSize)}`);
          
          try {
            // Generate embeddings for the batch
            const embeddingTexts = batch.map(chunk => chunk.text);
            this.logger.info(`Generating embeddings for ${embeddingTexts.length} chunks`);
            
            const embeddings: number[][] = [];
            for (let j = 0; j < embeddingTexts.length; j++) {
              try {
                const embedding = await this.getEmbedding(embeddingTexts[j]);
                embeddings.push(embedding);
              } catch (embeddingError) {
                this.logger.error(`Error generating embedding for chunk ${j}: ${embeddingError instanceof Error ? embeddingError.message : String(embeddingError)}`);
                // Use a random embedding as fallback
                embeddings.push(Array(1536).fill(0).map(() => Math.random()));
                failedChunks++;
              }
            }
            
            this.logger.info(`Generated ${embeddings.length} embeddings for batch`);
            
            // Prepare points for Qdrant
            const pointsToUpload = batch.map((chunk, idx) => ({
              id: uuidv4(),
              vector: embeddings[idx],
              payload: {
                text: chunk.text,
                metadata: {
                  ...chunk.metadata,
                  dataSourceId: resolvedDataSourceId || dataSourceId,
                  compositeId: `${resolvedDataSourceId || dataSourceId}_${uuidv4()}`
                }
              }
            }));
            
            // Upload vectors to Qdrant
            this.logger.info(`Uploading ${pointsToUpload.length} vectors to Qdrant collection ${collectionName}`);
            
            await this.qdrantService.upsertVectors(collectionName, pointsToUpload);
            this.logger.info(`Successfully uploaded ${pointsToUpload.length} vectors to Qdrant`);
            
            totalProcessed += pointsToUpload.length;
            
            // Update progress if data source exists
            if (resolvedDataSourceId) {
              const progress = Math.round((i + batch.length) / documentChunks.length * 100);
              this.logger.info(`Updating progress: ${progress}%`);
              
              try {
                await db('data_sources')
                  .where('id', resolvedDataSourceId)
                  .update({
                    metrics: db.raw(`
                      jsonb_set(
                        COALESCE(metrics, '{}'::jsonb),
                        '{progress}',
                        ?::jsonb
                      )
                    `, [JSON.stringify(progress)]),
                    updated_at: new Date()
                  });
                
                // Notify clients via WebSocket
                this.websocketService.broadcastDataSourceUpdate(
                  resolvedDataSourceId,
                  'processing',
                  {
                    action: 'dataSource.progress',
                    id: resolvedDataSourceId,
                    progress
                  }
                );
              } catch (progressError) {
                this.logger.error(`Error updating progress: ${progressError instanceof Error ? progressError.message : String(progressError)}`);
                // Continue even if progress update fails
              }
            }
          } catch (batchError) {
            this.logger.error(`Error processing batch: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
            // Continue with next batch
          }
        }
        
        // Update data source with final metrics
        if (resolvedDataSourceId) {
          this.logger.info(`Updating data source ${resolvedDataSourceId} with final metrics`);
          
          try {
            await db('data_sources')
              .where('id', resolvedDataSourceId)
              .update({
                status: 'connected',
                metrics: db.raw(`
                  jsonb_set(
                    jsonb_set(
                      COALESCE(metrics, '{}'::jsonb),
                      '{records}',
                      ?::jsonb
                    ),
                    '{progress}',
                    '100'::jsonb
                  )
                `, [JSON.stringify(processedRecords.length)]),
                last_sync: new Date(),
                updated_at: new Date()
              });
            
            // Also update the data source's metadata
            await db('data_sources')
              .where('id', resolvedDataSourceId)
              .update({
                metadata: db.raw(`
                  jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{records}',
                    ?::jsonb
                  )
                `, [JSON.stringify(processedRecords.length)])
              });
            
            // Notify clients via WebSocket
            this.websocketService.broadcastDataSourceUpdate(
              resolvedDataSourceId,
              'connected',
              {
                action: 'dataSource.updated',
                id: resolvedDataSourceId,
                status: 'connected',
                records: processedRecords.length
              }
            );
          } catch (finalUpdateError) {
            this.logger.error(`Error updating final metrics: ${finalUpdateError instanceof Error ? finalUpdateError.message : String(finalUpdateError)}`);
            // Continue even if final update fails
          }
        }
        
        return {
          status: 'success',
          chunks: totalProcessed,
          message: `Successfully processed ${processedRecords.length} records and stored ${totalProcessed} document chunks in Qdrant`,
          metadata: {
            recordCount: processedRecords.length,
            chunkCount: totalProcessed,
            failedChunks,
            collectionName
          }
        };
      } catch (csvError) {
        this.logger.error(`Error processing CSV file: ${csvError instanceof Error ? csvError.message : String(csvError)}`);
        
        // Update data source with error status if it exists
        if (resolvedDataSourceId) {
          try {
            await db('data_sources')
              .where('id', resolvedDataSourceId)
              .update({
                status: 'error',
                metrics: db.raw(`
                  jsonb_set(
                    COALESCE(metrics, '{}'::jsonb),
                    '{lastError}',
                    ?::jsonb
                  )
                `, [JSON.stringify(csvError instanceof Error ? csvError.message : String(csvError))]),
                updated_at: new Date()
              });
            
            // Notify clients via WebSocket
            if (dataSource) {
              this.websocketService.broadcastDataSourceUpdate(
                resolvedDataSourceId,
                'error',
                {
                  action: 'dataSource.updated',
                  id: resolvedDataSourceId,
                  status: 'error',
                  error: csvError instanceof Error ? csvError.message : String(csvError)
                }
              );
            }
          } catch (errorUpdateError) {
            this.logger.error(`Error updating data source with error status: ${errorUpdateError instanceof Error ? errorUpdateError.message : String(errorUpdateError)}`);
          }
        }
        
        throw new Error(`CSV processing failed: ${csvError instanceof Error ? csvError.message : String(csvError)}`);
      }
    } catch (error) {
      this.logger.error(`Error in processFile: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        status: 'error',
        chunks: 0,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get embeddings for a text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      // Simple 1536-dimension random vector for testing
      // Replace with actual embedding code in production
      if (process.env.NODE_ENV === 'test') {
        return Array(1536).fill(0).map(() => Math.random());
      }
      
      // Use the OpenAI service for embeddings
      // Always skip cache for CSV data to ensure fresh embeddings
      const embeddings = await this.openaiService.createEmbeddings([text], { skipCache: true });
      this.logger.debug(`Generated embedding with ${embeddings[0].length} dimensions`);
      return embeddings[0];
    } catch (error) {
      this.logger.error(`Error creating embedding: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to create embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 