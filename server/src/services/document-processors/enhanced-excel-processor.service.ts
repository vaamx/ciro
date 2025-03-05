import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { BaseDocumentProcessor, ProcessingResult } from './base-document-processor';
import { ConfigService } from '../config.service';
import { ChunkingService } from '../chunking.service';
import { QdrantService } from '../qdrant.service';
import { OpenAIService } from '../openai.service';
import { createLogger } from '../../utils/logger';

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
      
      // Validate file exists and is accessible
      this.validateFile(filePath);
      
      // Update data source status to processing
      await this.updateDataSourceStatus(dataSourceId, 'processing', {
        stage: 'started',
        message: 'Started processing Excel file',
        timestamp: new Date().toISOString()
      });
      
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
      const workbook = XLSX.readFile(filePath, {
        cellFormula: false, // Skip formulas for performance
        cellHTML: false,
        cellText: true,
        cellDates: true,
        cellStyles: false,
        cellNF: true,
        dateNF: 'yyyy-mm-dd'
      });
      
      if (!workbook.SheetNames.length) {
        throw new Error('Excel file contains no sheets');
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
      
      // Process each sheet
      const sheetResults: Array<{
        name: string;
        rows: number;
        columns: number;
        cells: number;
        chunks: number;
      }> = [];
      
      let totalChunks = 0;
      const collectionName = `datasource_${dataSourceId}`;
      
      // Create or ensure collection exists
      await this.ensureCollectionExists(collectionName);
      
      // Process each sheet
      for (const sheetName of sheetsToProcess) {
        this.logger.info(`Processing sheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        
        // Get the range of cells in the worksheet
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        
        // Calculate total cells in this sheet
        const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
        
        this.logger.info(`Sheet ${sheetName} has ${totalCells} cells (${range.e.r - range.s.r + 1} rows × ${range.e.c - range.s.c + 1} columns)`);
        
        // Skip if sheet is too large
        if (totalCells > this.MAX_CELLS_PER_SHEET) {
          this.logger.warn(`Sheet ${sheetName} exceeds maximum cell limit (${totalCells} > ${this.MAX_CELLS_PER_SHEET}), skipping`);
          continue;
        }
        
        // Convert sheet to JSON with headers
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
          header: 1,
          raw: !options.preserveNumericPrecision,
          defval: ''
        });
        
        // Skip empty sheets
        if (rows.length === 0) {
          this.logger.warn(`Sheet ${sheetName} is empty, skipping`);
          continue;
        }
        
        // Extract headers (assume first row is header)
        const headers = rows.length > 0 ? rows[0] : [];
        const dataRows = rows.slice(1);
        
        // Process the data
        let sheetText = `Sheet: ${sheetName}\n\n`;
        
        // Add headers
        sheetText += headers.join('\t') + '\n';
        
        // Add separator
        sheetText += headers.map(() => '---------').join('\t') + '\n';
        
        // Add data rows
        for (const row of dataRows) {
          // Format row for text representation
          const formattedRow = row.map((cell: any) => {
            if (cell === null || cell === undefined) return '';
            
            if (typeof cell === 'number') {
              return options.preserveNumericPrecision ? cell.toString() : cell.toFixed(2);
            }
            
            return cell.toString();
          });
          
          sheetText += formattedRow.join('\t') + '\n';
        }
        
        // Generate statistics if requested
        if (options.includeStatistics) {
          const stats = this.generateBasicStatistics(headers, dataRows);
          if (stats) {
            sheetText += `\n${stats}\n`;
          }
        }
        
        // Create chunks from sheet text using the chunking service
        const chunks = this.chunkingService.createChunks(sheetText, {
          chunkSize: options.chunkSize,
          overlap: options.chunkOverlap
        });
        
        this.logger.info(`Generated ${chunks.length} chunks from sheet ${sheetName}`);
        
        // Process each chunk and add to Qdrant
        let successfulChunks = 0;
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkId = uuidv4();
          
          try {
            // Generate embeddings for the chunk
            const [embedding] = await this.openaiService.createEmbeddings(chunk);
            
            // Create point with vector to store in Qdrant
            const point = {
              id: chunkId,
              vector: embedding,
              payload: {
                text: chunk,
                metadata: {
                  source: 'excel',
                  dataSourceId,
                  sheet: sheetName,
                  sheetIndex: workbook.SheetNames.indexOf(sheetName),
                  chunkIndex: i,
                  totalChunks: chunks.length,
                  filename: path.basename(filePath),
                  processingDate: new Date().toISOString()
                }
              }
            };
            
            // Store the chunk in Qdrant
            await this.qdrantService.upsertVectors(collectionName, [point]);
            
            successfulChunks++;
          } catch (chunkError) {
            this.logger.error(`Error processing chunk ${i} from sheet ${sheetName}: ${chunkError}`);
          }
        }
        
        // Add sheet result
        sheetResults.push({
          name: sheetName,
          rows: dataRows.length,
          columns: headers.length,
          cells: totalCells,
          chunks: successfulChunks
        });
        
        totalChunks += successfulChunks;
      }
      
      // Update data source status
      await this.updateDataSourceStatus(dataSourceId, 'completed', {
        stage: 'completed',
        message: `Successfully processed ${totalChunks} chunks from ${sheetResults.length} sheets`,
        timestamp: new Date().toISOString(),
        stats: {
          total_chunks: totalChunks,
          sheets_processed: sheetResults.length,
          sheets_total: workbook.SheetNames.length
        }
      });
      
      return {
        status: 'success',
        message: `Successfully processed ${sheetResults.length} sheets with ${totalChunks} total chunks`,
        chunks: totalChunks,
        metadata: {
          sheets: sheetResults,
          totalSheets: workbook.SheetNames.length,
          processedSheets: sheetResults.length,
          filename: path.basename(filePath)
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Excel file: ${errorMessage}`, error);
      
      // Update data source status
      await this.updateDataSourceStatus(dataSourceId, 'error', {
        stage: 'failed',
        message: `Error processing Excel file: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        error: errorMessage
      });
      
      return {
        status: 'error',
        message: `Error processing Excel file: ${errorMessage}`,
        chunks: 0,
        metadata: { error: errorMessage }
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
} 