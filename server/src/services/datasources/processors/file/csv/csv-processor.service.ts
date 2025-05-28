// @ts-nocheck - TODO: This file needs major refactoring to work with the updated service architecture

import { Injectable, Logger } from '@nestjs/common';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as path from 'path';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { ConfigService } from '@nestjs/config';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
import { QdrantSearchService } from '../../../../vector/search.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { DataSourceService } from '../../../management/datasource-management.service';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingService } from '../../../../llm';
import { SocketService } from '../../../../util/socket.service';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { DataSourceProcessingStatus } from '../../../../../types';
import { readCSVWithDelimiter } from '../../../../../common/utils/csv-utils';
import { VisualizationService } from '../../../../../modules/visualization/visualization.service';
import { AnalysisService } from '../../../../analysis/analysis.service';
import { OpenaiFunctionsService } from '../../../../ai/openai-functions/openai-functions.service';
import { DocumentEmbeddingService } from '../../../../ai/document-embedding/document-embedding.service';
import { MetadataCollectorService } from '../../../../shared/metadata/metadata-collector.service';
import { EnhancedMetadataService } from '../../../../shared/metadata/enhanced-metadata.service';
import { ExtractedHeadersService } from '../../../../shared/metadata/extracted-headers.service';

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
@Injectable()
export class CsvProcessorService extends BaseDocumentProcessor {
  public processorName = 'CSV Processor';
  protected logger = createServiceLogger('CsvProcessorService');
  private batchSize = 50; // Default batch size for processing

  constructor(
    dataSourceService: DataSourceService,
    socketService: SocketService,
    protected readonly configService: ConfigService,
    protected readonly documentChunkingService: DocumentChunkingService,
    protected readonly qdrantSearchService: QdrantSearchService,
    protected readonly qdrantCollectionService: QdrantCollectionService,
    protected readonly qdrantIngestionService: QdrantIngestionService,
    protected readonly embeddingService: EmbeddingService
  ) {
    super('CsvProcessorService', dataSourceService, socketService);
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
   * @param organizationId ID of the organization
   * @param userId ID of the user
   * @param metadata Additional metadata
   * @returns Processing result
   */
  async processFile(
    filePath: string,
    dataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    this.logger.info(`Processing CSV file: ${filePath} for dataSourceId: ${dataSourceId}, orgId: ${organizationId}`);
    await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sampleContent = fileContent.substring(0, 1024); // Use a sample for detection
    const parseOptions = this.detectCsvFormat(sampleContent);

    let records: any[] = [];
    let collectionName = '';

    try {
      // Validate file exists and is accessible (using base class method)
      this.validateFile(filePath);

      records = parse(fileContent, parseOptions);
      records = this.preprocessCsvData(records);

      if (records.length === 0) {
        this.logger.warn(`CSV file ${filePath} is empty or contains no valid data.`);
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, 'CSV file is empty or invalid');
        return { status: 'error', message: 'CSV file is empty or invalid', chunks: 0 };
      }

      collectionName = `datasource_${dataSourceId}`;
      this.logger.info(`Using collection name: ${collectionName}`);

      // Create chunks
      const chunks = this.createDocumentChunks(records, { combineRows: true }); // Use default chunking options
      this.logger.info(`Created ${chunks.length} chunks from ${records.length} records.`);

      // Prepare data for ingestion
      const texts = chunks.map(chunk => chunk.text);
      const metadatas = chunks.map(chunk => chunk.metadata);

      // Generate embeddings in batches
      this.logger.info(`Generating embeddings for ${texts.length} chunks...`);
      await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { stage: 'embedding' });

      const embeddings = await this.generateEmbeddingsInBatches(texts);
      this.logger.info(`Generated ${embeddings.length} embeddings.`);

      // Ingest into Qdrant
      this.logger.info(`Ingesting ${embeddings.length} vectors into collection: ${collectionName}`);
      await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, { stage: 'ingestion' });

      await this.qdrantIngestionService.ingestData(collectionName, {
        vectors: embeddings.map((embedding, index) => ({ id: uuidv4(), vector: embedding })),
        payloads: metadatas
      });

      this.logger.info(`Successfully processed and ingested CSV file: ${filePath}`);
      await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, { chunks: chunks.length });

      return { status: 'success', chunks: chunks.length, metadata: { collectionName } };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing CSV file ${filePath}: ${errorMessage}`, { stack: error instanceof Error ? error.stack : undefined });
      await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, errorMessage);
      return { status: 'error', message: errorMessage, chunks: 0, metadata: { collectionName } };
    }
  }
} 