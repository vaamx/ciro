import { createServiceLogger } from '../utils/logger-factory';
import { db } from '../infrastructure/database';
import { RagService } from './rag.service';
import { QdrantService } from './qdrant.service';
import { OpenAIService } from './openai.service';
import { ChunkingService } from './chunking.service';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for handling manufacturing-specific data processing
 * Specializes in large multi-sheet Excel files and enhancing RAG for manufacturing data
 */
export class ManufacturingDataService {
  private readonly logger = createServiceLogger('ManufacturingDataService');
  private ragService: RagService;
  private qdrantService: QdrantService;
  private openaiService: OpenAIService;
  private chunkingService: ChunkingService;

  // Constants for Excel processing
  private readonly MAX_CELLS_PER_SHEET = 100000;
  private readonly MAX_SHEET_SIZE_DEFAULT = 50;
  private readonly CHUNK_SIZE = 1200;
  private readonly CHUNK_OVERLAP = 200;

  constructor() {
    this.logger.info('Initializing ManufacturingDataService');
    this.ragService = new RagService();
    this.qdrantService = QdrantService.getInstance();
    this.openaiService = OpenAIService.getInstance();
    this.chunkingService = ChunkingService.getInstance();
  }

  /**
   * Process a multi-sheet Excel file for manufacturing data
   * @param filePath Path to the Excel file
   * @param dataSourceId ID of the data source
   * @param options Processing options
   * @returns Processing result with statistics
   */
  async processManufacturingExcel(
    filePath: string,
    dataSourceId: string,
    options: {
      processAllSheets?: boolean;
      preserveNumericPrecision?: boolean;
      extractMeasurementUnits?: boolean;
      identifyPartNumbers?: boolean;
      generateSummaries?: boolean;
      sheetPriority?: string[];
      maxSheetsToProcess?: number;
      chunkSize?: number;
      chunkOverlap?: number;
      includeStatistics?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    sheets: {
      name: string;
      rows: number;
      columns: number;
      cells: number;
      chunks: number;
    }[];
    statistics?: Record<string, any>;
    totalChunks: number;
    error?: any;
  }> {
    try {
      this.logger.info(`Processing manufacturing Excel file: ${path.basename(filePath)}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Set default options
      const {
        processAllSheets = true,
        preserveNumericPrecision = true,
        extractMeasurementUnits = true,
        identifyPartNumbers = true,
        generateSummaries = true,
        maxSheetsToProcess = options.sheetPriority?.length || this.MAX_SHEET_SIZE_DEFAULT,
        chunkSize = this.CHUNK_SIZE,
        chunkOverlap = this.CHUNK_OVERLAP,
        includeStatistics = true
      } = options;
      
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
      
      // Update data source status to processing
      await this.updateDataSourceStatus(dataSourceId, 'processing', {
        stage: 'started',
        message: `Processing ${workbook.SheetNames.length} sheets in Excel file`,
        timestamp: new Date().toISOString()
      });
      
      // Determine which sheets to process
      let sheetsToProcess = [...workbook.SheetNames];
      
      // Apply sheet priority if provided
      if (options.sheetPriority && options.sheetPriority.length > 0) {
        const priorityMap = new Map<string, number>();
        options.sheetPriority.forEach((name, index) => {
          priorityMap.set(name, index);
        });
        
        sheetsToProcess.sort((a, b) => {
          const aIndex = priorityMap.has(a) ? priorityMap.get(a)! : Number.MAX_SAFE_INTEGER;
          const bIndex = priorityMap.has(b) ? priorityMap.get(b)! : Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });
      }
      
      // Limit sheets if not processing all
      if (!processAllSheets) {
        sheetsToProcess = sheetsToProcess.slice(0, maxSheetsToProcess);
      }
      
      this.logger.info(`Will process ${sheetsToProcess.length} sheets: ${sheetsToProcess.join(', ')}`);
      
      // Process each sheet
      const sheetResults = [];
      let totalChunks = 0;
      const collectionName = `datasource_${dataSourceId}`;
      
      // Create collection if it doesn't exist
      const collectionExists = await this.qdrantService.collectionExists(collectionName);
      if (!collectionExists) {
        this.logger.info(`Creating Qdrant collection: ${collectionName}`);
        await this.qdrantService.createCollection(collectionName, {
          vectors: {
            size: 1536, // OpenAI embeddings are 1536-dimensional
            distance: 'Cosine'
          }
        });
        this.logger.info(`Qdrant collection created: ${collectionName}`);
      }
      
      // Store workbook-level metadata
      const workbookMetadata = {
        filename: path.basename(filePath),
        filetype: 'xlsx',
        sheet_count: workbook.SheetNames.length,
        processed_sheets: sheetsToProcess.length,
        processing_options: {
          preserveNumericPrecision,
          extractMeasurementUnits,
          identifyPartNumbers,
          generateSummaries
        }
      };
      
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
          raw: !preserveNumericPrecision,
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
        
        // Extract manufacturing-specific data
        const sheetData = {
          element_id: uuidv4(),
          sheet_name: sheetName,
          headers: headers,
          row_count: dataRows.length,
          column_count: headers.length,
          total_cells: totalCells,
          units: [] as Array<{ column: string; unit: string }>
        };
        
        // Extract units from headers if enabled
        if (extractMeasurementUnits) {
          sheetData.units = this.extractUnitsFromHeaders(headers);
        }
        
        // Process the data
        let sheetText = `Sheet: ${sheetName}\n\n`;
        
        // Add headers
        sheetText += headers.join('\t') + '\n';
        
        // Add separator
        sheetText += headers.map(() => '---------').join('\t') + '\n';
        
        // Extract parts information if requested
        const partNumbersFound: string[] = [];
        
        // Add data rows
        for (const row of dataRows) {
          // Format row for text representation
          const formattedRow = row.map((cell: any) => {
            if (cell === null || cell === undefined) return '';
            
            if (typeof cell === 'number') {
              return preserveNumericPrecision ? cell.toString() : cell.toFixed(2);
            }
            
            return cell.toString();
          });
          
          sheetText += formattedRow.join('\t') + '\n';
          
          // Identify part numbers if requested
          if (identifyPartNumbers) {
            const rowObj: Record<string, any> = {};
            headers.forEach((header, index) => {
              if (header && index < row.length) {
                rowObj[header.toString()] = row[index];
              }
            });
            
            const parts = this.extractPartNumbers(rowObj);
            if (parts.length > 0) {
              partNumbersFound.push(...parts);
            }
          }
        }
        
        // Add part numbers information if found
        if (partNumbersFound.length > 0) {
          const uniqueParts = [...new Set(partNumbersFound)];
          sheetText += `\nPart Numbers: ${uniqueParts.join(', ')}\n`;
        }
        
        // Generate statistics if requested
        if (includeStatistics) {
          const statistics = this.generateStatistics(headers, dataRows);
          if (statistics) {
            sheetText += `\n${statistics}\n`;
          }
        }
        
        // Create chunks from the sheet text
        const chunks = this.chunkingService.createChunks(sheetText, {
          chunkSize,
          overlap: chunkOverlap,
          smartChunking: true
        });
        
        this.logger.info(`Created ${chunks.length} chunks from sheet ${sheetName}`);
        
        // Embed and store chunks
        let successfulChunks = 0;
        const batchSize = 5; // Process 5 chunks at a time
        
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          
          try {
            // Generate embeddings
            const embeddings = await this.openaiService.createEmbeddings(batch);
            
            // Prepare vectors for Qdrant
            const vectors = batch.map((chunk, idx) => ({
              id: `${dataSourceId}_${sheetName}_${uuidv4()}`,
              vector: embeddings[idx],
              payload: {
                content: chunk,
                metadata: {
                  ...workbookMetadata,
                  sheet_name: sheetName,
                  sheet_data: sheetData,
                  chunk_index: i + idx,
                  source_type: 'manufacturing_excel',
                  data_source_id: dataSourceId,
                  total_chunks: chunks.length,
                  embedding_model: 'text-embedding-ada-002',
                  created_at: new Date().toISOString()
                }
              }
            }));
            
            // Store in Qdrant
            await this.qdrantService.upsertVectors(collectionName, vectors);
            successfulChunks += batch.length;
            
            this.logger.debug(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}, ${successfulChunks}/${chunks.length} chunks embedded`);
          } catch (error) {
            this.logger.error(`Error processing batch for sheet ${sheetName}:`, error);
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
      await this.updateDataSourceStatus(dataSourceId, 'processed', {
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
        success: true,
        message: `Successfully processed ${sheetResults.length} sheets with ${totalChunks} total chunks`,
        sheets: sheetResults,
        totalChunks
      };
      
    } catch (error) {
      this.logger.error('Error processing manufacturing Excel file:', error);
      
      // Update data source status
      await this.updateDataSourceStatus(dataSourceId, 'error', {
        stage: 'failed',
        message: `Error processing Excel file: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: `Error processing Excel file: ${error instanceof Error ? error.message : String(error)}`,
        sheets: [],
        totalChunks: 0,
        error
      };
    }
  }
  
  /**
   * Enhanced querying for manufacturing data
   * Specializes in handling queries about manufacturing data across multiple sheets
   * @param query User query
   * @param dataSourceIds Data source IDs to search
   * @param options Query options
   * @returns Enhanced query result with manufacturing context
   */
  async enhancedManufacturingQuery(
    query: string,
    dataSourceIds: string[] | number[],
    options: {
      sessionId?: string;
      maxResults?: number;
      includeStatistics?: boolean;
      allowCalculations?: boolean;
      partNumberSearch?: boolean;
      unitConversion?: boolean;
    } = {}
  ): Promise<{
    content: string;
    sources: any[];
    calculationResults?: Record<string, any>;
    statistics?: Record<string, any>;
    model?: string;
  }> {
    try {
      const {
        sessionId,
        maxResults = 20,
        includeStatistics = true,
        allowCalculations = true,
        partNumberSearch = true,
        unitConversion = true
      } = options;
      
      this.logger.info(`Processing manufacturing query: "${query.substring(0, 50)}..."`);
      
      // Check if this is a calculation query
      const isCalculationQuery = this.isCalculationQuery(query);
      
      // Check if this is a part number query
      const isPartNumberQuery = partNumberSearch && this.isPartNumberQuery(query);
      
      // Check if this involves unit conversion
      const isUnitConversionQuery = unitConversion && this.isUnitConversionQuery(query);
      
      // Enhanced context for the model
      let enhancedSystemPrompt = `You are a manufacturing data expert assistant. You have access to Excel data from manufacturing systems.`;
      
      if (isCalculationQuery && allowCalculations) {
        enhancedSystemPrompt += ` When performing calculations, show your work step by step. Format any calculation results in tables for clarity. Use proper units and significant figures in your calculations.`;
      }
      
      if (isPartNumberQuery) {
        enhancedSystemPrompt += ` For queries about part numbers, show comprehensive information including specifications, inventory, and related documentation if available.`;
      }
      
      if (isUnitConversionQuery) {
        enhancedSystemPrompt += ` When converting units, show the conversion factors and calculations. Ensure proper significant figures are maintained.`;
      }
      
      // Use the RAG service with our enhanced system prompt
      const ragResult = await this.ragService.processQuery(
        query, 
        dataSourceIds,
        sessionId,
        "8" // More context for manufacturing queries - converted to string to match type
      );
      
      // Extract statistics if requested
      let statistics: Record<string, any> = {};
      let calculationResults: Record<string, any> = {};
      
      if (includeStatistics && isCalculationQuery) {
        statistics = this.extractStatisticsFromSources(ragResult.sources);
        
        if (allowCalculations) {
          calculationResults = await this.performCalculationsFromQuery(query, ragResult.sources);
        }
      }
      
      return {
        content: ragResult.content,
        sources: ragResult.sources,
        model: ragResult.model,
        calculationResults: Object.keys(calculationResults).length > 0 ? calculationResults : undefined,
        statistics: Object.keys(statistics).length > 0 ? statistics : undefined
      };
      
    } catch (error) {
      this.logger.error('Error in enhanced manufacturing query:', error);
      
      return {
        content: `An error occurred while processing your manufacturing query: ${error instanceof Error ? error.message : String(error)}`,
        sources: []
      };
    }
  }
  
  /**
   * Check if a query requires calculations
   */
  private isCalculationQuery(query: string): boolean {
    const calculationPatterns = [
      /calculate/i,
      /compute/i,
      /sum/i,
      /average/i,
      /mean/i,
      /median/i,
      /total/i,
      /difference between/i,
      /how much/i,
      /how many/i,
      /percentage/i,
      /ratio/i,
      /compare/i,
      /trend/i,
      /distribution/i,
      /statistics/i
    ];
    
    return calculationPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Check if a query is looking for part number information
   */
  private isPartNumberQuery(query: string): boolean {
    const partNumberPatterns = [
      /part\s+number/i,
      /part\s+#/i,
      /part\s+no/i,
      /part\s+id/i,
      /component\s+number/i,
      /component\s+id/i,
      /item\s+number/i,
      /product\s+code/i,
      /product\s+number/i,
      /sku/i,
      /material\s+number/i,
      /p\/n/i
    ];
    
    return partNumberPatterns.some(pattern => pattern.test(query)) ||
      // Also check for patterns that look like part numbers
      /[A-Z]{1,3}-\d{3,7}/.test(query) || // ABC-1234
      /\d{3,6}-[A-Z0-9]{2,5}/.test(query) || // 123456-AB
      /[A-Z]{2,4}\d{4,8}[A-Z]?/.test(query); // ABC12345 or XY123456Z
  }
  
  /**
   * Check if a query involves unit conversion
   */
  private isUnitConversionQuery(query: string): boolean {
    const unitConversionPatterns = [
      /convert/i,
      /in\s+(mm|cm|m|km|in|ft|yd|mi|g|kg|lb|oz|ml|l|gal|°c|°f|k)/i,
      /(mm|cm|m|km|in|ft|yd|mi|g|kg|lb|oz|ml|l|gal|°c|°f|k)\s+to\s+(mm|cm|m|km|in|ft|yd|mi|g|kg|lb|oz|ml|l|gal|°c|°f|k)/i,
      /equivalent/i
    ];
    
    return unitConversionPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Extract statistics from sources
   */
  private extractStatisticsFromSources(sources: any[]): Record<string, any> {
    const statistics: Record<string, any> = {};
    
    for (const source of sources) {
      const content = source.content || '';
      const metadata = source.metadata || {};
      
      // Look for numeric data in the source
      const numericMatches = content.match(/\b\d+(\.\d+)?\b/g);
      if (numericMatches && numericMatches.length > 5) {
        const values = numericMatches.map(Number).filter(n => !isNaN(n));
        
        if (values.length > 5) {
          // Calculate basic statistics
          values.sort((a, b) => a - b);
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = values[0];
          const max = values[values.length - 1];
          const median = values.length % 2 === 0 
            ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
            : values[Math.floor(values.length / 2)];
          
          // Get sheet/source name from metadata if available
          const sourceName = metadata.sheet_name || metadata.sourceName || 'Source';
          
          statistics[sourceName] = {
            count: values.length,
            min,
            max,
            avg,
            median,
            sum
          };
        }
      }
    }
    
    return statistics;
  }
  
  /**
   * Perform calculations based on the query and sources
   */
  private async performCalculationsFromQuery(query: string, sources: any[]): Promise<Record<string, any>> {
    // This is a placeholder for actual calculation logic
    // In a real implementation, you would parse the query to determine what calculation to perform
    // and then extract the relevant data from the sources to perform that calculation
    
    // For now, return an empty object
    return {};
  }
  
  /**
   * Extract units from headers
   */
  private extractUnitsFromHeaders(headers: any[]): Array<{ column: string; unit: string }> {
    const result: Array<{ column: string; unit: string }> = [];
    
    // Common unit patterns in manufacturing
    const unitPatterns = [
      { pattern: /\(([a-zA-Z]+)\)$/, group: 1 },
      { pattern: /\[([a-zA-Z]+)\]$/, group: 1 },
      { pattern: / in ([a-zA-Z]+)$/, group: 1 },
      { pattern: / \((\w+)\)$/, group: 1 }
    ];
    
    // Common manufacturing units to look for in headers
    const commonUnits = [
      'mm', 'cm', 'm', 'in', 'ft', 'kg', 'g', 'lb', 'oz',
      'L', 'ml', 'gal', 'Hz', 'rpm', 'MPa', 'psi', 'bar',
      '°C', '°F', 'K', 'V', 'A', 'W', 'kW', 'hp', 'N', 'lbf',
      'min', 'sec', 'hr', '%', 'deg', '°', 'rad'
    ];
    
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '');
      if (!header) continue;
      
      // Skip very short headers
      if (header.length < 2) continue;
      
      // Try pattern matching first
      let unit = null;
      
      for (const { pattern, group } of unitPatterns) {
        const match = header.match(pattern);
        if (match && match[group]) {
          unit = match[group];
          break;
        }
      }
      
      // If no match from patterns, look for known units
      if (!unit) {
        for (const commonUnit of commonUnits) {
          // Look for the unit at the end of the string or in parentheses
          const unitPatterns = [
            ` ${commonUnit}$`,
            `(${commonUnit})$`,
            `[${commonUnit}]$`,
            ` ${commonUnit} `
          ];
          
          for (const pattern of unitPatterns) {
            if (header.match(new RegExp(pattern))) {
              unit = commonUnit;
              break;
            }
          }
          
          if (unit) break;
        }
      }
      
      // If we found a unit, add it to the result
      if (unit) {
        result.push({
          column: header,
          unit: unit
        });
      }
    }
    
    return result;
  }
  
  /**
   * Extract potential part numbers from row data
   */
  private extractPartNumbers(rowData: Record<string, any>): string[] {
    const partNumbers: string[] = [];
    
    // Common patterns for part numbers in manufacturing
    const partNumberPatterns = [
      /^[A-Z]{1,3}-\d{3,7}(?:-[A-Z0-9]{1,5})?$/,  // Format like ABC-1234 or A-12345-X1
      /^\d{3,6}-[A-Z0-9]{2,5}(?:-[A-Z0-9]{1,3})?$/,  // Format like 123456-AB or 123-ABC-1
      /^[A-Z]{2,4}\d{4,8}[A-Z]?$/,  // Format like ABC12345 or XY123456Z
      /^[A-Z]\d{2}[A-Z]\d{3,5}$/    // Format like A12B3456
    ];
    
    // Common field names that might contain part numbers
    const partNumberFields = [
      'part', 'part number', 'part#', 'part no', 'part_no', 'partno',
      'item', 'item number', 'item#', 'item no', 'item_no', 'itemno',
      'sku', 'product', 'product number', 'product#', 'product_no',
      'component', 'component number', 'component#',
      'material', 'material number', 'material#',
      'code', 'p/n', 'pn', 'ref'
    ];
    
    // First check fields whose names suggest they contain part numbers
    for (const [key, value] of Object.entries(rowData)) {
      const keyLower = key.toLowerCase();
      
      // If the field name suggests it contains a part number
      if (partNumberFields.some(field => keyLower.includes(field))) {
        const strValue = String(value || '');
        if (strValue && strValue.length >= 4 && strValue.length <= 20) {
          // Check against patterns
          if (partNumberPatterns.some(pattern => pattern.test(strValue))) {
            partNumbers.push(strValue);
            continue;
          }
          
          // Even if it doesn't match patterns, add it if the field name is very likely a part number field
          if (['part number', 'part#', 'part no', 'partno', 'p/n', 'pn'].includes(keyLower)) {
            partNumbers.push(strValue);
          }
        }
      }
    }
    
    // If we didn't find any part numbers in specific fields, scan all values
    if (partNumbers.length === 0) {
      for (const value of Object.values(rowData)) {
        const strValue = String(value || '');
        if (strValue && strValue.length >= 5 && strValue.length <= 20) {
          if (partNumberPatterns.some(pattern => pattern.test(strValue))) {
            partNumbers.push(strValue);
          }
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(partNumbers)];
  }
  
  /**
   * Generate statistics from table data
   */
  private generateStatistics(headers: any[], dataRows: any[][]): string | null {
    if (!headers.length || !dataRows.length) return null;
    
    let stats = 'Statistical Summary:\n';
    let hasStats = false;
    
    // Process each column
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const header = headers[colIdx];
      if (!header) continue;
      
      // Get numeric values for this column
      const values = dataRows
        .map(row => colIdx < row.length ? row[colIdx] : null)
        .filter(val => val !== null && val !== '' && typeof val === 'number');
      
      // Need at least 5 values for statistics
      if (values.length >= 5) {
        hasStats = true;
        
        // Calculate statistics
        values.sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = values[0];
        const max = values[values.length - 1];
        const median = values.length % 2 === 0 
          ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
          : values[Math.floor(values.length / 2)];
        
        stats += `- ${header}: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${avg.toFixed(2)}, median=${median.toFixed(2)}, count=${values.length}\n`;
      }
    }
    
    return hasStats ? stats : null;
  }
  
  /**
   * Update the status of a data source
   */
  private async updateDataSourceStatus(
    dataSourceId: string,
    status: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          status,
          updated_at: new Date(),
          metadata: db.raw(`jsonb_set(
            COALESCE(metadata::jsonb, '{}'::jsonb),
            '{processingStatus}',
            ?::jsonb
          )`, [JSON.stringify({
            ...metadata,
            updatedAt: new Date().toISOString()
          })])
        });
    } catch (error) {
      this.logger.error(`Error updating data source status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 