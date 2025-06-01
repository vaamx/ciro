// REMOVE @ts-nocheck - Refactoring complete

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx'; // Using xlsx library
import { v4 as uuidv4 } from 'uuid';
import { BaseDocumentProcessor, ProcessingResult } from '../base-document.processor';
import { DocumentChunkingService } from '../../../../rag/chunking/document-chunking.service';
// import { DataSourceService } from '../data-source.service'; // TODO: Relocate/Refactor
import { EmbeddingService } from '../../../../llm';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { SocketService } from '../../../../util/socket.service';
import { DataSourceProcessingStatus } from '../../../../../types';
import { DataSourceManagementService } from '../../../management/datasource-management.service';
import { FileStatus } from '../../../../../core/database/prisma-types';

// Enhanced ProcessingResult interface with additional properties
interface EnhancedProcessingResult extends ProcessingResult {
  totalChunks: number;
  totalRows: number;
}

/**
 * Enhanced Excel Processor Service
 * Handles processing of Excel files (.xlsx, .xls, .ods)
 */
@Injectable()
export class EnhancedExcelProcessorService extends BaseDocumentProcessor {
  // Configuration constants
  private readonly MAX_SHEETS = 10;
  private readonly MAX_CELLS_PER_SHEET = 1000000;
  private readonly MAX_TOTAL_CELLS = 5000000;
  private readonly BATCH_SIZE = 50; // Increased batch size for better throughput
  private readonly MAX_CONCURRENT_BATCHES = 3; // Limit concurrent processing
  
  // Performance optimization: Cache the selected embedding model
  private cachedEmbeddingModel: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentChunkingService: DocumentChunkingService,
    // readonly dataSourceService: DataSourceService, // TODO: Reinstate
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly qdrantIngestionService: QdrantIngestionService,
    readonly socketService: SocketService,
    private readonly dataSourceManagementService: DataSourceManagementService,
  ) {
    super('enhanced-excel', socketService);
    this.logger.info('EnhancedExcelProcessorService initialized with streaming architecture');
  }

  /**
   * Generate collection name for a data source
   */
  generateCollectionName(dataSourceId: number, sourceName: string): string {
    const sanitizedName = sourceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `data_source_${dataSourceId}_${sanitizedName}`;
  }

  /**
   * Enhanced file processing with performance optimizations
   */
  async processFile(
    filePath: string, 
    dataSourceId: number,
    organizationId: number,
    sourceName: string,
  ): Promise<EnhancedProcessingResult> {
    let processingStarted = false;
    const processingStartTime = Date.now();
    
    try {
      this.logger.info(`🚀 PERFORMANCE: Starting optimized Excel processing for file: ${filePath}`);
      
      // 1. Update status to processing
      await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING);
      processingStarted = true;

      // 2. Generate collection name 
      const collectionName = this.generateCollectionName(dataSourceId, sourceName);
      
      // 3. Ensure collection exists
      if (!(await this.qdrantCollectionService.collectionExists(collectionName))) {
        await this.qdrantCollectionService.createCollection(collectionName, {
          dimension: this.configService.get('EMBEDDING_DIMENSION', 1536),
          vectors: {
            size: this.configService.get('EMBEDDING_DIMENSION', 1536),
            distance: 'Cosine'
          }
        });
        this.logger.info(`Created new Qdrant collection: ${collectionName}`);
      }

      // 4. Read and validate workbook
      this.logger.debug('📖 Reading Excel workbook...');
      const workbook = XLSX.readFile(filePath);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Workbook contains no sheets');
      }
      
      this.logger.info(`📊 Found ${workbook.SheetNames.length} sheet(s) in workbook`);

      // 5. Process the workbook with streaming
      const result = await this.processWorkbookStreaming(
        workbook,
        dataSourceId,
        organizationId,
        collectionName,
        sourceName
      );

      const processingTime = Date.now() - processingStartTime;
      
      // 6. Update final status
      if (result.totalChunks > 0) {
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED);
        this.logger.info(`✅ PERFORMANCE: Excel processing completed successfully in ${processingTime}ms. Processed ${result.totalChunks} chunks from ${result.totalRows} rows`);
      } else {
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, 'No data chunks were created from the file');
        this.logger.warn(`⚠️ Excel processing completed but no chunks were created from ${result.totalRows} rows`);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Error processing Excel file: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      
      if (processingStarted) {
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, errorMessage);
      }
      
      throw error;
    }
  }

  /**
   * Process workbook using streaming approach with optimized batch processing
   */
  private async processWorkbookStreaming(
    workbook: XLSX.WorkBook,
    numericDataSourceId: number,
    organizationId: number,
    collectionName: string,
    sourceName: string
  ): Promise<EnhancedProcessingResult> {
    
    const BATCH_SIZE = 200; // Process 200 chunks at once
    const ROWS_PER_CHUNK = 100; // Combine 100 rows into one chunk
    const PROGRESS_UPDATE_FREQUENCY = 1000; // Update progress every 1000 rows
    const CHUNK_TARGET_SIZE = 2000; // Target characters per chunk (reduced from 4000 to stay under 8192 token limit)
    const MAX_CHUNK_SIZE = 2500; // Maximum characters per chunk (hard limit to prevent token overflow)
    const CHUNK_OVERLAP = 200; // Overlap between chunks (reduced from 400)
    
    let totalRows = 0;
    let totalChunks = 0;
      let processedSheets = 0;
    const sheetNames = workbook.SheetNames.slice(0, this.MAX_SHEETS);
    
    this.logger.info(`Starting optimized batch processing for ${sheetNames.length} sheets`);

    await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, {
      step: 'starting_batch_processing',
      totalSheets: sheetNames.length,
      processingMethod: 'optimized-batch'
    });

    for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      this.logger.info(`Processing sheet: "${sheetName}"`);

      // Get range of data
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const endRow = Math.min(range.e.r, 50000); // Limit to 50k rows per sheet
      const endCol = Math.min(range.e.c, 100); // Limit to 100 columns

      let rowsProcessedInSheet = 0;
      let sheetChunks: string[] = [];
      let currentBatchRows: string[] = [];

      // Process rows in batches, respecting chunk size limits
      for (let rowNum = range.s.r; rowNum <= endRow; rowNum++) {
        const rowText = this.extractRowText(worksheet, rowNum, range.s.c, endCol);
        
        if (rowText.trim()) {
          // Check if adding this row would exceed our chunk size limit
          const potentialChunk = currentBatchRows.length === 0 
            ? rowText 
            : currentBatchRows.join('\n') + '\n' + rowText;
          
          if (potentialChunk.length > CHUNK_TARGET_SIZE && currentBatchRows.length > 0) {
            // Current batch is full, save it and start a new one
            const chunkText = currentBatchRows.join('\n');
            
            // Further split if still too large (safety check)
            const splitChunks = this.chunkTextPiece(chunkText, CHUNK_TARGET_SIZE, CHUNK_OVERLAP);
            sheetChunks.push(...splitChunks);
            
            currentBatchRows = [rowText]; // Start new batch with current row
          } else {
            // Add row to current batch
            currentBatchRows.push(rowText);
          }
          
          rowsProcessedInSheet++;
          totalRows++;

          // Update progress less frequently
          if (rowsProcessedInSheet % PROGRESS_UPDATE_FREQUENCY === 0) {
            await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.PROCESSING, {
              step: 'batch_processing',
              sheet: sheetName,
              rowsProcessed: totalRows,
              chunksCreated: totalChunks,
              currentSheet: processedSheets + 1,
              totalSheets: sheetNames.length
            });
          }
        }
      }

      // Handle remaining rows
      if (currentBatchRows.length > 0) {
        const chunkText = currentBatchRows.join('\n');
        
        // Split if too large (safety check)
        const splitChunks = this.chunkTextPiece(chunkText, CHUNK_TARGET_SIZE, CHUNK_OVERLAP);
        sheetChunks.push(...splitChunks);
      }

      // Process all chunks for this sheet in parallel batches
      await this.processChunksInParallelBatches(
        sheetChunks,
        sourceName,
        numericDataSourceId,
        sheetName,
        collectionName
      );

      totalChunks += sheetChunks.length;
      processedSheets++;
      
      this.logger.info(`Completed sheet "${sheetName}": ${rowsProcessedInSheet} rows -> ${sheetChunks.length} chunks`);
    }

    // Update final status to COMPLETED
    await this.updateStatus(numericDataSourceId, organizationId, DataSourceProcessingStatus.COMPLETED, {
      step: 'completed',
      totalSheets: processedSheets,
      totalRows,
      totalChunks,
      collectionName,
      processingMethod: 'optimized-batch'
    });

    const finalMetadata = {
      processedSheets,
      totalRows,
      sheetNames,
      chunks: totalChunks,
      collectionName,
      records: totalChunks,
      processingMethod: 'optimized-batch'
    };

    this.logger.info(`Optimized batch processing completed: ${totalRows} rows -> ${totalChunks} chunks in ${processedSheets} sheets`);
    return {
      status: 'success',
      message: `Successfully processed ${totalRows} rows into ${totalChunks} chunks`,
      chunks: totalChunks,
      totalChunks: totalChunks,
      totalRows: totalRows,
      metadata: finalMetadata
    };
  }

  /**
   * Process chunks in optimized parallel batches with batched embeddings
   */
  private async processChunksInParallelBatches(
    chunks: string[],
    sourceName: string,
    dataSourceId: number,
    sheetName: string,
    collectionName: string
  ): Promise<void> {
    
    this.logger.info(`🚀 OPTIMIZED: Processing ${chunks.length} chunks in batches of ${this.BATCH_SIZE}`);
    
    // Process in batches with limited concurrency
    for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
      const batch = chunks.slice(i, i + this.BATCH_SIZE);
      
      this.logger.debug(`Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(chunks.length / this.BATCH_SIZE)} (${batch.length} chunks)`);
      
      // Create batched embeddings (much faster)
      const vectorPoints = await this.createBatchedVectorPoints(
        batch,
        sourceName,
        dataSourceId,
        sheetName,
        i
      );
      
      // Store the batch
      await this.processBatch(vectorPoints, collectionName);
      
      this.logger.debug(`✅ Completed batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(chunks.length / this.BATCH_SIZE)}`);
    }
  }

  /**
   * OPTIMIZATION: Create vector points for a batch of chunks using batched embeddings
   * This reduces API calls from N to N/batch_size
   */
  private async createBatchedVectorPoints(
    chunkTexts: string[],
    sourceName: string,
    dataSourceId: number,
    sheetName: string,
    startIndex: number
  ): Promise<Array<{ id: string; vector: number[]; payload: any }>> {
    
    const startTime = Date.now();
    
    // CRITICAL OPTIMIZATION: Use batched embedding API
    this.logger.debug(`🔧 Creating embeddings for ${chunkTexts.length} chunks in single API call`);
    
    // Call the embedding service with multiple texts
    const embeddings = await this.embeddingService.createEmbeddings(chunkTexts);
    
    const endTime = Date.now();
    this.logger.debug(`⚡ Batched embeddings completed in ${endTime - startTime}ms (${chunkTexts.length} chunks)`);
    
    // Create vector points
    return chunkTexts.map((chunkText, index) => ({
      id: uuidv4(),
      vector: embeddings[index],
      payload: {
        text: chunkText,
        source: sourceName,
        dataSourceId,
        sheet: sheetName,
        rowCount: startIndex + index,
        processedAt: new Date().toISOString(),
      }
    }));
  }

  /**
   * Extract text from a single row
   */
  private extractRowText(worksheet: XLSX.WorkSheet, rowNum: number, startCol: number, endCol: number): string {
    const rowData: string[] = [];
    
    for (let col = startCol; col <= endCol; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== null) {
        const cellValue = String(cell.v).trim();
        if (cellValue) {
          rowData.push(cellValue);
        }
      }
    }
    
    return rowData.join(' | ');
  }

  /**
   * Process a batch of vector points
   */
  private async processBatch(
    batch: Array<{ id: string; vector: number[]; payload: any }>,
    collectionName: string
  ): Promise<void> {
    
    this.logger.info(`Processing batch of ${batch.length} chunks to collection "${collectionName}"`);
    
    try {
      await this.qdrantIngestionService.upsertVectors(collectionName, batch);
      this.logger.debug(`Successfully processed batch of ${batch.length} chunks`);
    } catch (error) {
      this.logger.error(`Error processing batch: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Override updateStatus to also update the database
   */
  protected async updateStatus(
    dataSourceId: number,
    organizationId: number,
    status: DataSourceProcessingStatus,
    metrics?: Record<string, any>,
    error?: string
  ): Promise<void> {
    // Call parent method for socket updates
    await super.updateStatus(dataSourceId, organizationId, status, metrics, error);
    
    // Also update the database status
    try {
      await this.updateDatabaseStatus(dataSourceId, organizationId, status, error);
    } catch (dbError) {
      this.logger.error(`Failed to update database status for data source ${dataSourceId}:`, dbError);
      // Don't throw error - socket update already happened
    }
  }

  /**
   * Update the database status directly
   */
  private async updateDatabaseStatus(
    dataSourceId: number,
    organizationId: number,
    status: DataSourceProcessingStatus,
    error?: string
  ): Promise<void> {
    // Convert status to database string
    let statusString: string;
    switch (status) {
      case DataSourceProcessingStatus.PROCESSING:
        statusString = 'processing';
        break;
      case DataSourceProcessingStatus.COMPLETED:
        statusString = 'ready'; // Set to 'ready' when completed
        break;
      case DataSourceProcessingStatus.ERROR:
        statusString = 'error';
        break;
      default:
        statusString = status.toString();
    }

    // Use the dataSourceManagementService if available
    if (this.dataSourceManagementService) {
      await this.dataSourceManagementService.updateStatus(
        dataSourceId,
        organizationId,
        statusString,
        error
      );
      this.logger.info(`Database status updated for data source ${dataSourceId} to ${statusString}`);
    } else {
      this.logger.warn(`DataSourceManagementService not available - cannot update database status for data source ${dataSourceId}`);
    }
  }

  /**
   * Efficient text chunking method for better memory usage
   * Ensures chunks never exceed OpenAI's token limits
   */
  private chunkTextPiece(text: string, targetSize: number, overlap: number = 200): string[] {
    // Hard limit to prevent token overflow (conservative estimate: 1 token ≈ 3.5 characters)
    const MAX_CHARACTERS = 2500; // This should result in ~714 tokens, well under 8192 limit
    const effectiveTargetSize = Math.min(targetSize, MAX_CHARACTERS);
    
    if (text.length <= effectiveTargetSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + effectiveTargetSize, text.length);
      let chunkText = text.slice(start, end);
      
      // Try to break at word boundaries if we're not at the end
      if (end < text.length) {
        const lastSpace = chunkText.lastIndexOf(' ');
        const lastNewline = chunkText.lastIndexOf('\n');
        const breakPoint = Math.max(lastSpace, lastNewline);
        
        if (breakPoint > effectiveTargetSize * 0.7) { // Only break if we don't lose too much content
          chunkText = chunkText.slice(0, breakPoint);
        }
      }
      
      // Double-check chunk size doesn't exceed absolute maximum
      if (chunkText.length > MAX_CHARACTERS) {
        chunkText = chunkText.slice(0, MAX_CHARACTERS);
        // Try to break at last word boundary within limit
        const lastSpace = chunkText.lastIndexOf(' ');
        if (lastSpace > MAX_CHARACTERS * 0.8) {
          chunkText = chunkText.slice(0, lastSpace);
        }
      }
      
      if (chunkText.trim()) {
        chunks.push(chunkText.trim());
      }
      
      // Calculate next start position with overlap
      const nextStart = start + chunkText.length - overlap;
      start = Math.max(nextStart, start + 1); // Ensure we always advance
    }
    
    return chunks;
  }

} // End class
