import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { BaseDocumentProcessor, ProcessingResult, DataSourceStatus } from './base-document-processor';
import { ConfigService } from '../config.service';
import { ChunkingService } from '../chunking.service';
import { QdrantService } from '../qdrant.service';
import { OpenAIService } from '../openai.service';
import { createLogger } from '../../utils/logger';
import { db } from '../../infrastructure/database';
import * as ExcelJsLib from 'exceljs';

// Define missing type
interface DocumentProcessorOptions {
  [key: string]: any;
}

// Constant for embedding dimension
const EMBEDDING_DIMENSION = 1536;

// Define the interface that matches what we're returning
interface ExcelProcessingResult {
  plainText: string;
  chunks: string[];
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    processingMethod: string;
    sheets?: number;
    totalCells?: number;
    error?: string;
  }
}

/**
 * Enhanced Excel Processor Service
 * Handles processing of Excel files (.xlsx, .xls, .ods)
 */
export class EnhancedExcelProcessorService extends BaseDocumentProcessor {
  private readonly MAX_CELLS_PER_SHEET = 50000;
  private readonly MAX_SHEET_SIZE_DEFAULT = 10;
  private readonly CHUNK_SIZE = 1000;
  private readonly CHUNK_OVERLAP = 200;
  private readonly configService: ConfigService;
  private readonly chunkingService: ChunkingService;
  private readonly openaiService: OpenAIService;

  constructor(
    configService: ConfigService,
    chunkingService: ChunkingService,
    qdrantService: QdrantService
  ) {
    super('EnhancedExcelProcessorService');
    this.configService = configService;
    this.chunkingService = chunkingService;
    this.openaiService = OpenAIService.getInstance();
    this.logger.info('Enhanced Excel Processor Service initialized');
  }

  /**
   * Process an Excel file
   * @param filePath Path to the Excel file
   * @param dataSourceId ID of the data source
   * @param metadata Additional metadata
   * @returns Processing result
   */
  async processFile(
    filePath: string,
    dataSourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    try {
      this.logger.info(`Processing Excel file: ${path.basename(filePath)}`);
      
      // Immediately update data source to processing status with 0% to show progress bar in UI right away
      await this.updateDataSourceStatus(dataSourceId, 'processing', {
        stage: 'started',
        message: 'Starting Excel file processing',
        timestamp: new Date().toISOString(),
        progress: 0,
        processedChunks: 0,
        totalChunks: 100 // Initial estimate, will be updated later
      });
      
      // Store the original dataSourceId which may be a UUID
      const originalDataSourceId = dataSourceId;
      let uuidCollection = null;
      let numericCollection = null;
      
      // If dataSourceId is a UUID, try to get the numeric ID from the database
      if (dataSourceId.includes('-')) {
        try {
          // Try to find the numeric ID from the database if this is a UUID
          const dataSource = await db('data_sources')
            .whereRaw("metadata->>'id' = ?", [dataSourceId])
            .orWhereRaw("metadata->>'filename' LIKE ?", [`%${dataSourceId}%`])
            .orWhereRaw("metadata->>'originalFilename' LIKE ?", [`%${dataSourceId}%`])
            .first('id');
          
          if (dataSource && dataSource.id) {
            this.logger.info(`Found numeric ID ${dataSource.id} for UUID ${dataSourceId}`);
            
            // Store both collection names for later use
            uuidCollection = `datasource_${dataSourceId}`;
            numericCollection = `datasource_${dataSource.id}`;
            
            // Update dataSourceId to use the numeric ID
            dataSourceId = String(dataSource.id);
          }
        } catch (error) {
          this.logger.warn(`Could not find numeric ID for UUID ${dataSourceId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // For numeric IDs, just use it directly
        numericCollection = `datasource_${dataSourceId}`;
      }
      
      // Always use numeric ID collection name when available
      const collectionName = numericCollection || `datasource_${dataSourceId}`;
      this.logger.info(`Using normalized collection name: ${collectionName}`);
      
      // Validate file exists and is accessible
      this.validateFile(filePath);
      
      // Check if we need to migrate vectors from UUID collection to numeric collection
      if (uuidCollection && numericCollection) {
        const uuidCollectionExists = await this.qdrantService.collectionExists(uuidCollection);
        if (uuidCollectionExists) {
          this.logger.info(`UUID collection ${uuidCollection} exists. Checking for vectors to migrate...`);
          
          try {
            // Get info about both collections
            const uuidInfo = await this.qdrantService.getInfo(uuidCollection);
            const numericInfo = await this.qdrantService.getInfo(numericCollection);
            
            // If UUID collection has vectors and numeric collection is empty, migrate the vectors
            if (uuidInfo && uuidInfo.vectors_count > 0 && 
                (!numericInfo || numericInfo.vectors_count === 0)) {
              this.logger.info(`Found ${uuidInfo.vectors_count} vectors in UUID collection. Migrating to numeric collection...`);
              
              // Get all points from UUID collection
              const points = await this.qdrantService.getAllPoints(uuidCollection, 1000); // Limit to 1000 to avoid memory issues
              
              if (points && points.length > 0) {
                // Ensure all points have required vector property
                const validPoints = points.filter(point => 
                  point && typeof point === 'object' && 'id' in point && 'vector' in point && Array.isArray(point.vector)
                ) as { id: string; vector: number[]; payload: any }[];
                
                if (validPoints.length > 0) {
                  // Upsert points to numeric collection
                  await this.qdrantService.upsertVectors(numericCollection, validPoints);
                  this.logger.info(`Successfully migrated ${validPoints.length} vectors from ${uuidCollection} to ${numericCollection}`);
                } else {
                  this.logger.warn(`Found ${points.length} points but none had valid vector data`);
                }
              }
            }
          } catch (error) {
            this.logger.error(`Error migrating vectors: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      // Set default options
      const options = {
        processAllSheets: metadata.processAllSheets ?? true,
        preserveNumericPrecision: metadata.preserveNumericPrecision ?? true,
        extractMeasurementUnits: metadata.extractMeasurementUnits ?? true,
        identifyPartNumbers: metadata.identifyPartNumbers ?? true,
        generateSummaries: metadata.generateSummaries ?? true,
        sheetPriority: metadata.sheetPriority ?? [],
        maxSheetsToProcess: metadata.maxSheetsToProcess ?? this.MAX_SHEET_SIZE_DEFAULT,
        chunkSize: metadata.chunkSize ?? this.CHUNK_SIZE,
        chunkOverlap: metadata.chunkOverlap ?? this.CHUNK_OVERLAP,
        includeStatistics: metadata.includeStatistics ?? true
      };
      
      // Load the Excel file
      try {
        // First try with the default options
        const workbook = XLSX.readFile(filePath, {
          cellFormula: false, 
          cellHTML: false,
          cellText: true,
          cellDates: true,
          cellStyles: false,
          cellNF: true,
          dateNF: 'yyyy-mm-dd',
          type: 'array', // Try array type first (more robust)
          WTF: false 
        });
        
        if (!workbook.SheetNames || !workbook.SheetNames.length) {
          this.logger.warn('Excel file parsing with array type didn\'t produce any sheets, trying binary mode');
          // Try binary mode
          const data = fs.readFileSync(filePath, 'binary');
          const binaryWorkbook = XLSX.read(data, {
            type: 'binary',
            cellFormula: false,
            cellNF: false,
            cellStyles: false
          });
          
          if (binaryWorkbook.SheetNames && binaryWorkbook.SheetNames.length) {
            this.logger.info('Binary parsing method succeeded');
            Object.assign(workbook, binaryWorkbook);
          } else {
            // Try buffer approach
            this.logger.warn('Binary mode failed, trying buffer approach');
            const buffer = fs.readFileSync(filePath);
            const bufferWorkbook = XLSX.read(buffer, { type: 'buffer' });
            
            if (bufferWorkbook.SheetNames && bufferWorkbook.SheetNames.length) {
              this.logger.info('Buffer parsing method succeeded');
              Object.assign(workbook, bufferWorkbook);
            }
          }
        }

        if (!workbook.SheetNames || !workbook.SheetNames.length) {
          throw new Error('Excel file contains no sheets or the file format is not compatible');
        }
        
        this.logger.info(`Found ${workbook.SheetNames.length} sheets in file: ${workbook.SheetNames.join(', ')}`);
        
        // Determine which sheets to process
        let sheetsToProcess = [...workbook.SheetNames];
        
        // Apply sheet priority if provided
        if (options.sheetPriority && options.sheetPriority.length > 0) {
          const priorityMap = new Map<string, number>();
          options.sheetPriority.forEach((name: string, index: number) => {
            priorityMap.set(name, index);
          });
          
          sheetsToProcess.sort((a, b) => {
            const aIndex = priorityMap.has(a) ? priorityMap.get(a)! : Number.MAX_SAFE_INTEGER;
            const bIndex = priorityMap.has(b) ? priorityMap.get(b)! : Number.MAX_SAFE_INTEGER;
            return aIndex - bIndex;
          });
        }
        
        // Limit sheets if not processing all
        if (!options.processAllSheets) {
          sheetsToProcess = sheetsToProcess.slice(0, options.maxSheetsToProcess);
        }
        
        this.logger.info(`Will process ${sheetsToProcess.length} sheets: ${sheetsToProcess.join(', ')}`);
        
        // Extract the data from each sheet
        const extractedSheets = [];
        let totalRowsProcessed = 0;
        
        // Update data source status with progress
        const updateProgress = async (stage: string, processedChunks: number, totalChunks: number, message: string) => {
          // Calculate percentage progress (0-100)
          const progress = Math.min(Math.floor((processedChunks / totalChunks) * 100), 99); // Cap at 99% until complete
          
          await this.updateDataSourceStatus(dataSourceId, 'processing', {
            stage,
            message,
            timestamp: new Date().toISOString(),
            progress,
            processedChunks,
            totalChunks
          });
        };
        
        for (const sheetName of sheetsToProcess) {
          // Skip if we've reached the max sheets to process
          if (extractedSheets.length >= options.maxSheetsToProcess) {
            this.logger.info(`Reached maximum sheets to process (${options.maxSheetsToProcess}), skipping remaining sheets`);
            break;
          }
          
          try {
            const worksheet = workbook.Sheets[sheetName];
            
            // Get sheet dimensions
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
            const rowCount = range.e.r - range.s.r + 1;
            const colCount = range.e.c - range.s.c + 1;
            
            this.logger.info(`Processing sheet "${sheetName}" with ${rowCount} rows and ${colCount} columns`);
            
            // Skip empty or oversized sheets
            if (rowCount <= 1) {
              this.logger.info(`Skipping empty sheet "${sheetName}"`);
              continue;
            }
            
            if (rowCount * colCount > this.MAX_CELLS_PER_SHEET) {
              this.logger.warn(`Sheet "${sheetName}" exceeds maximum cell count (${rowCount * colCount} > ${this.MAX_CELLS_PER_SHEET})`);
              
              // We'll still process but with a limit
              this.logger.info(`Processing first ${Math.floor(this.MAX_CELLS_PER_SHEET / colCount)} rows of sheet "${sheetName}"`);
            }
            
            // Extract headers (assuming first row contains headers)
            const headers = XLSX.utils.sheet_to_json<string[]>(worksheet, { 
              header: 1,
              range: { s: { r: range.s.r, c: range.s.c }, e: { r: range.s.r, c: range.e.c } }
            })[0] || [];
            
            // Clean and normalize headers
            const normalizedHeaders = headers.map((header, index) => {
              if (!header) return `Column_${index + 1}`;
              return String(header).trim() || `Column_${index + 1}`;
            });
            
            // Determine max rows to read (respecting cell limit)
            const maxRows = Math.min(
              rowCount,
              Math.floor(this.MAX_CELLS_PER_SHEET / colCount)
            );
            
            // Extract rows with header mapping
            const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
              header: 1,
              range: { 
                s: { r: range.s.r + 1, c: range.s.c }, 
                e: { r: Math.min(range.s.r + maxRows, range.e.r), c: range.e.c } 
              },
              raw: !options.preserveNumericPrecision
            });
            
            totalRowsProcessed += rows.length;
            
            // Format dates and nulls for JSON serialization
            const formattedRows = rows.map(row => {
              return row.map(cell => {
                if (cell instanceof Date) {
                  return cell.toISOString();
                }
                return cell === null || cell === undefined ? '' : cell;
              });
            });
            
            // Create the 2D array with headers in first row
            const tableData = [normalizedHeaders, ...formattedRows];
            
            // Generate statistics about numeric columns if requested
            let statistics = null;
            if (options.includeStatistics) {
              statistics = this.generateBasicStatistics(normalizedHeaders, formattedRows);
            }
            
            // Record units from headers if requested
            let units = [];
            if (options.extractMeasurementUnits) {
              units = this.extractUnitsFromHeaders(normalizedHeaders);
            }
            
            extractedSheets.push({
              name: sheetName,
              rowCount: rows.length + 1, // +1 for header
              columnCount: normalizedHeaders.length,
              headers: normalizedHeaders,
              tableData: tableData,
              statistics: statistics,
              units: units
            });
          } catch (error) {
            this.logger.error(`Error processing sheet "${sheetName}":`, error);
          }
        }
        
        // Create text chunks from the extracted sheets
        this.logger.info(`Creating chunks from ${extractedSheets.length} sheets`);
        
        // Create chunks for embedding from the sheet data
        const chunksToEmbed: {
          text: string;
          metadata: Record<string, any>;
        }[] = [];
        
        for (const sheet of extractedSheets) {
          // First, add a sheet summary
          const sheetSummary = `Sheet: ${sheet.name}\nColumns: ${sheet.headers.join(', ')}\nRows: ${sheet.rowCount}\n`;
          chunksToEmbed.push({
            text: sheetSummary,
            metadata: {
              id: uuidv4(),
              type: 'sheet_summary',
              sheetName: sheet.name,
              dataSourceId: dataSourceId
            }
          });
          
          // If there's statistics, add it as a separate chunk
          if (sheet.statistics) {
            chunksToEmbed.push({
              text: `Sheet: ${sheet.name}\nStatistics:\n${sheet.statistics}`,
              metadata: {
                id: uuidv4(),
                type: 'statistics',
                sheetName: sheet.name,
                dataSourceId: dataSourceId
              }
            });
          }
          
          // Process the actual rows in chunks
          const headers = sheet.headers;
          
          // Group rows into chunks for better semantic understanding
          const rowsPerChunk = options.chunkSize / 50; // Estimate about 50 chars per cell on average
          
          for (let i = 0; i < sheet.tableData.length; i += rowsPerChunk) {
            const rowChunk = sheet.tableData.slice(i, i + rowsPerChunk);
            
            if (rowChunk.length <= 1) continue; // Skip if only header row or empty
            
            let chunkText = `Sheet: ${sheet.name}\n\n`;
            
            // Add the header row
            chunkText += headers.join('\t') + '\n';
            
            // Add the data rows
            for (let j = 1; j < rowChunk.length; j++) { // Start at 1 to skip header if included
              const row = rowChunk[j];
              if (row) {
                chunkText += row.join('\t') + '\n';
              }
            }
            
            chunksToEmbed.push({
              text: chunkText,
              metadata: {
                id: uuidv4(),
                type: 'data_rows',
                sheetName: sheet.name,
                rowRange: `${i}-${i + rowChunk.length - 1}`,
                dataSourceId: dataSourceId
              }
            });
          }
          
          // For each column, create a column profile chunk
          for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const header = headers[colIndex];
            
            // Extract column values
            const columnValues = sheet.tableData
              .slice(1) // Skip header
              .map(row => (colIndex < row.length ? row[colIndex] : null))
              .filter(val => val !== null && val !== '')
              .slice(0, 100); // Limit to 100 values for the profile
            
            if (columnValues.length > 0) {
              const columnText = `Sheet: ${sheet.name}\nColumn: ${header}\nSample Values: ${columnValues.join(', ')}`;
              
              chunksToEmbed.push({
                text: columnText,
                metadata: {
                  id: uuidv4(),
                  type: 'column_profile',
                  sheetName: sheet.name,
                  columnName: header,
                  dataSourceId: dataSourceId
                }
              });
            }
          }
        }
        
        this.logger.info(`Created ${chunksToEmbed.length} chunks for embedding`);
        
        // Generate embeddings and store in Qdrant
        const totalChunks = chunksToEmbed.length;
        this.logger.info(`Generating embeddings for ${totalChunks} chunks`);
        
        // Update progress status to reflect starting embedding generation
        await updateProgress('embedding', 0, totalChunks, `Starting to generate embeddings for ${totalChunks} chunks`);
        
        const batchSize = 10; // Process in smaller batches to avoid timeouts
        let processedCount = 0;
        let embeddingsStoredCount = 0;
        
        // Process chunks in batches
        for (let i = 0; i < chunksToEmbed.length; i += batchSize) {
          const batch = chunksToEmbed.slice(i, i + batchSize);
          
          try {
            // Update progress
            await updateProgress('embedding', processedCount, totalChunks, 
              `Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(totalChunks/batchSize)}`);
            
            // Extract just the text for embedding generation
            const batchTexts = batch.map(chunk => chunk.text);
            
            // Generate embeddings
            const embeddings = await this.openaiService.createEmbeddings(batchTexts);
            
            // Verify that we have embeddings for all chunks
            if (embeddings.length !== batchTexts.length) {
              this.logger.error(`Embedding count mismatch: got ${embeddings.length} for ${batchTexts.length} texts`);
              continue;
            }
            
            // Prepare points for Qdrant
            const points = batch.map((chunk, index) => ({
              id: chunk.metadata.id,
              vector: embeddings[index],
              payload: {
                text: chunk.text,
                metadata: chunk.metadata
              }
            }));
            
            // Store points in Qdrant
            await this.qdrantService.addPoints(collectionName, points);
            
            processedCount += batch.length;
            embeddingsStoredCount += points.length;
            
            // Log progress
            this.logger.info(`Processed ${processedCount}/${totalChunks} chunks, stored ${embeddingsStoredCount} embeddings in ${collectionName}`);
            
            // Update progress after successful batch completion
            await updateProgress('embedding', processedCount, totalChunks,
              `Embedded ${processedCount} of ${totalChunks} chunks`);
            
            // Brief pause to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            this.logger.error(`Error processing batch ${i / batchSize + 1}:`, error);
          }
        }
        
        // Final verification step - check if points were actually stored
        try {
          const info = await this.qdrantService.getInfo(collectionName);
          this.logger.info(`Collection ${collectionName} info: ${JSON.stringify(info)}`);
          
          if (info && info.vectors_count === 0) {
            this.logger.error(`WARNING: No vectors were stored in collection ${collectionName} despite processing ${embeddingsStoredCount} embeddings`);
          } else {
            this.logger.info(`Successfully stored ${info.vectors_count} vectors in collection ${collectionName}`);
          }
        } catch (verifyError) {
          this.logger.error(`Error verifying collection data: ${verifyError}`);
        }
        
        // Update data source status
        await this.updateDataSourceStatus(dataSourceId, 'completed', {
          stage: 'completed',
          message: `Successfully processed ${totalRowsProcessed} rows from ${extractedSheets.length} sheets and stored ${embeddingsStoredCount} embeddings`,
          timestamp: new Date().toISOString(),
          stats: {
            total_rows: totalRowsProcessed,
            sheets_processed: extractedSheets.length,
            sheets_total: workbook.SheetNames.length,
            chunks_created: chunksToEmbed.length,
            embeddings_stored: embeddingsStoredCount
          }
        });
        
        // Return the processing result
        const processingResult: ProcessingResult = {
          status: 'success',
          message: `Processed ${extractedSheets.length} sheets with ${totalRowsProcessed} total rows and created ${embeddingsStoredCount} embeddings`,
          chunks: chunksToEmbed.length,
          metadata: {
            file_name: path.basename(filePath),
            file_size: fs.promises.stat(filePath).then(stats => stats.size),
            file_type: 'excel',
            sheet_count: extractedSheets.length,
            total_rows: totalRowsProcessed,
            sheets: extractedSheets.map(sheet => ({
              name: sheet.name,
              row_count: sheet.rowCount,
              column_count: sheet.columnCount
            })),
            processed_at: new Date().toISOString(),
            processing_options: options,
            embeddings_stored: embeddingsStoredCount,
            collection_name: collectionName,
            // Add the additional data to the metadata
            data: {
              // Include the full table data for the first sheet (most common scenario)
              tableData: extractedSheets.length > 0 ? extractedSheets[0].tableData : [],
              // Include a summary of all sheets
              sheets: extractedSheets.map(sheet => ({
                name: sheet.name,
                rowCount: sheet.rowCount,
                columnCount: sheet.columnCount,
                // Only include the first few rows for preview in multi-sheet scenarios
                preview: sheet.tableData.slice(0, Math.min(6, sheet.tableData.length))
              }))
            }
          }
        };
        
        return processingResult;
        
      } catch (xlsxError) {
        // Handle XLSX parsing error
        this.logger.error(`Error parsing Excel file: ${xlsxError instanceof Error ? xlsxError.message : String(xlsxError)}`);
        
        // Update data source with error
        await this.updateDataSourceStatus(dataSourceId, 'error', {
          stage: 'failed',
          message: `Error parsing Excel file: ${xlsxError instanceof Error ? xlsxError.message : String(xlsxError)}`,
          timestamp: new Date().toISOString()
        });
        
        // Return error result
        return {
          status: 'error',
          chunks: 0,
          message: `Error parsing Excel file: ${xlsxError instanceof Error ? xlsxError.message : String(xlsxError)}`,
        };
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Excel file: ${errorMessage}`, error);
      
      try {
        // Update data source status
        await this.updateDataSourceStatus(dataSourceId, 'error', {
          stage: 'failed',
          message: `Error processing Excel file: ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      } catch (statusError) {
        this.logger.error(`Failed to update data source status:`, statusError);
      }
      
      return {
        status: 'error',
        chunks: 0,
        message: `Error processing Excel file: ${errorMessage}`,
      };
    }
  }
  
  /**
   * Generate basic statistics for Excel data
   * @param headers Headers from the sheet
   * @param dataRows Data rows from the sheet
   * @returns Formatted statistics text
   */
  private generateBasicStatistics(headers: any[], dataRows: any[][]): string | null {
    if (!headers.length || !dataRows.length) {
      return null;
    }
    
    try {
      let statsText = 'Statistics:\n';
      
      // For each column, calculate basic statistics for numeric data
      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        const header = headers[colIndex];
        if (!header) continue;
        
        // Extract all numeric values from the column
        const numericValues = dataRows
          .map(row => (colIndex < row.length ? row[colIndex] : null))
          .filter(val => val !== null && val !== undefined && !isNaN(Number(val)))
          .map(val => Number(val));
        
        // Skip columns with no numeric data
        if (numericValues.length === 0) continue;
        
        // Calculate basic statistics
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const avg = sum / numericValues.length;
        
        // Add statistics to the text
        statsText += `- ${header}: Min=${min.toFixed(2)}, Max=${max.toFixed(2)}, Avg=${avg.toFixed(2)}, Count=${numericValues.length}\n`;
      }
      
      return statsText;
    } catch (error) {
      this.logger.error(`Error generating statistics: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract units from header text (if available)
   * @param headers Array of header strings
   * @returns Array of detected units by column
   */
  private extractUnitsFromHeaders(headers: any[]): Array<{ column: string; unit: string }> {
    const units: Array<{ column: string; unit: string }> = [];
    const unitRegex = /\((.*?)\)|\[(.*?)\]/;
    
    for (const header of headers) {
      if (!header || typeof header !== 'string') continue;
      
      const match = header.match(unitRegex);
      if (match) {
        const unit = match[1] || match[2];
        units.push({
          column: header,
          unit: unit
        });
      }
    }
    
    return units;
  }

  /**
   * Update the data source status in the database
   * @param dataSourceId ID of the data source
   * @param status New status
   * @param details Additional details
   */
  protected async updateDataSourceStatus(
    dataSourceId: string,
    status: DataSourceStatus,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Check if we're in test mode with a generated ID
      if (dataSourceId.startsWith('test-excel-processor-')) {
        this.logger.info(`Test mode detected, skipping status update for test ID: ${dataSourceId}`);
        return;
      }
      
      // Call the parent class method if this is not a test ID
      await super.updateDataSourceStatus(dataSourceId, status, details);
    } catch (error) {
      this.logger.error(`Error updating data source status: ${error}`);
    }
  }

  private normalizeCollectionName(dataSourceId: string | number): string {
    // Always prefer numeric IDs when possible
    if (typeof dataSourceId === 'number' || (!isNaN(Number(dataSourceId)) && !String(dataSourceId).includes('-'))) {
      return `datasource_${dataSourceId}`;
    }
    
    // For UUIDs, just return with prefix - but this should be avoided when possible
    return `datasource_${String(dataSourceId)}`;
  }

  /**
   * Update the collection metadata to store both numeric ID and UUID for easier lookups
   */
  private async updateCollectionMetadata(collectionName: string, dataSourceId: number): Promise<void> {
    try {
      // First check if the collection exists
      const exists = await this.qdrantService.collectionExists(collectionName);
      if (!exists) {
        this.logger.warn(`Collection ${collectionName} does not exist, cannot update metadata`);
        return;
      }

      // Get the data source record to find metadata
      const dataSource = await db('data_sources')
        .where('id', dataSourceId)
        .first('metadata');

      // Store collection name in the database for easier retrieval
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          collection_name: collectionName
        });

      // Prepare the metadata object
      const metadataObj = {
        numeric_id: dataSourceId, // Always store the numeric ID
        uuid: dataSource?.metadata?.id || null,
        updated_at: new Date().toISOString()
      };

      // Use the Qdrant API to update collection metadata
      await this.qdrantService.getClient().updateCollection(collectionName, {
        params: {
          metadata: metadataObj
        }
      });

      this.logger.info(`Updated collection ${collectionName} with metadata: ${JSON.stringify(metadataObj)}`);
    } catch (error) {
      this.logger.error(`Failed to update collection metadata: ${error}`);
    }
  }

  /**
   * Process an Excel file and extract its content
   */
  async processExcel(filePath: string, options: DocumentProcessorOptions = {}): Promise<ExcelProcessingResult> {
    try {
      this.logger.info(`Processing Excel file: ${filePath}`);
      
      // Get file stats before processing
      const fileStats = await fs.promises.stat(filePath);
      
      // Read the Excel file
      const workbook = new ExcelJsLib.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      let plainTextContent = '';
      let structuredContent: any = {};
      let chunks: string[] = [];
      
      // Safety check to verify the workbook has sheets
      if (!workbook.worksheets || workbook.worksheets.length === 0) {
        this.logger.warn(`Excel file ${filePath} has no worksheets`);
        return {
          plainText: '',
          chunks: [],
          metadata: {
            fileName: path.basename(filePath),
            fileSize: fileStats.size,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            processingMethod: 'enhanced-excel',
            sheets: 0,
            totalCells: 0,
            error: 'No worksheets found in Excel file'
          }
        };
      }
      
      // Process each worksheet
      workbook.worksheets.forEach((worksheet, sheetIndex) => {
        try {
          if (!worksheet) {
            this.logger.warn(`Worksheet at index ${sheetIndex} is undefined, skipping`);
            return; // Skip this worksheet
          }
          
          const sheetName = worksheet.name || `Sheet${sheetIndex + 1}`;
          
          // Initialize the structured content for this sheet
          structuredContent[sheetName] = [];
          
          // Get the header row (first row)
          const headerRow = worksheet.getRow(1);
          const headers: string[] = [];
          
          // Extract headers
          headerRow.eachCell((cell, colNumber) => {
            if (cell && cell.value !== null && cell.value !== undefined) {
              const headerValue = String(cell.value).trim();
              headers[colNumber - 1] = headerValue;
            }
          });
          
          // Process each row
          worksheet.eachRow((row, rowNumber) => {
            if (!row) {
              this.logger.warn(`Row ${rowNumber} in sheet ${sheetName} is undefined, skipping`);
              return; // Skip this row
            }
            
            // Skip header row if we're processing with headers
            if (rowNumber === 1) {
              return;
            }
            
            const rowData: Record<string, any> = {};
            let rowText = '';
            
            // Process each cell in the row
            row.eachCell((cell, colNumber) => {
              if (!cell) {
                this.logger.warn(`Cell at column ${colNumber}, row ${rowNumber} in sheet ${sheetName} is undefined, skipping`);
                return; // Skip this cell
              }
              
              let cellValue: any;
              
              // Extract the value based on cell type
              try {
                if (cell.value === null || cell.value === undefined) {
                  cellValue = '';
                } else if (typeof cell.value === 'object') {
                  // Handle different cell value types
                  if (cell.value && 'text' in cell.value) {
                    cellValue = cell.value.text;
                  } else if (cell.value && 'formula' in cell.value && 'result' in cell.value) {
                    cellValue = cell.value.result || '';
                  } else if (cell.value instanceof Date) {
                    cellValue = cell.value.toISOString();
                  } else {
                    cellValue = String(cell.value);
                  }
                } else {
                  cellValue = String(cell.value);
                }
              } catch (cellError) {
                this.logger.error(`Error extracting cell value at column ${colNumber}, row ${rowNumber} in sheet ${sheetName}:`, cellError);
                cellValue = '';
              }
              
              // Add to row text for plain text conversion
              if (headers[colNumber - 1]) {
                rowText += `${headers[colNumber - 1]}: ${cellValue}; `;
                rowData[headers[colNumber - 1]] = cellValue;
              } else {
                rowText += `Column${colNumber}: ${cellValue}; `;
                rowData[`Column${colNumber}`] = cellValue;
              }
            });
            
            // Add to plain text and structured content
            if (rowText.trim()) {
              plainTextContent += `[${sheetName}:Row${rowNumber}] ${rowText}\n`;
              structuredContent[sheetName].push(rowData);
            }
          });
          
          // Create a chunk for this sheet
          const sheetText = `Sheet: ${sheetName}\n${structuredContent[sheetName]
            .map((row: Record<string, any>, index: number) => 
              `Row ${index + 2}: ${Object.entries(row)
                .map(([key, value]) => `${key}: ${value}`)
                .join('; ')}`
            )
            .join('\n')}`;
          
          chunks.push(sheetText);
        } catch (sheetError) {
          this.logger.error(`Error processing worksheet ${sheetIndex}:`, sheetError);
          // Continue with next sheet if one fails
        }
      });
      
      // Ensure we have at least one empty chunk if no content was extracted
      if (chunks.length === 0) {
        chunks.push(`Empty Excel file: ${path.basename(filePath)}`);
      }
      
      return {
        plainText: plainTextContent,
        chunks: chunks,
        metadata: {
          fileName: path.basename(filePath),
          fileSize: fileStats.size,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          processingMethod: 'enhanced-excel',
          sheets: workbook.worksheets.length,
          totalCells: chunks.length
        }
      };
    } catch (error) {
      this.logger.error(`Error processing Excel file ${filePath}:`, error);
      
      // Return a minimal result with error information
      return {
        plainText: `Error processing Excel file: ${path.basename(filePath)}`,
        chunks: [`Error processing Excel file: ${path.basename(filePath)}`],
        metadata: {
          fileName: path.basename(filePath),
          fileSize: 0,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          processingMethod: 'enhanced-excel',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
} 