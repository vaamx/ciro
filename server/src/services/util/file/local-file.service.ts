import * as fs from 'fs';
import * as path from 'path';
import { createServiceLogger } from '../../../common/utils/logger-factory';
import { injectable } from 'inversify';
import { ensureDirectoryExists } from '../../../common/utils/file-utils';
import { parse } from 'csv-parse/sync';
import { FileUploadService } from './file-upload.service';

/**
 * Interface representing a processed file
 */
export interface ProcessedFile {
  originalName: string;
  fileName: string;
  fileType: string;
  contentType: string;
  size: number;
  content?: any;
  filePath?: string;
}

/**
 * Service for handling local file operations
 */
@injectable()
export class LocalFileService {
  private readonly logger = createServiceLogger('LocalFileService');
  private uploadsDir = path.join(process.cwd(), 'uploads');
  
  constructor(private readonly uploadService: FileUploadService) {
    this.logger.info('LocalFileService initialized');
    
    // Ensure uploads directory exists
    ensureDirectoryExists(this.uploadsDir);
  }
  
  /**
   * Determine the file type based on extension and mimetype
   */
  determineFileType(fileName: string, mimeType: string): string {
    // Extract file extension
    const extension = path.extname(fileName).toLowerCase();
    this.logger.debug(`File extension: ${extension}, MIME type: ${mimeType}`);
    
    // CSV files - prioritize extension for CSV files
    if (extension === '.csv') {
      this.logger.info(`Detected CSV file based on extension: ${fileName}`);
      return 'csv';
    }
    
    // Excel files
    if (extension === '.xlsx' || extension === '.xls' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return 'excel';
    }
    
    // PDF files
    if (extension === '.pdf' || mimeType.includes('pdf')) {
      return 'pdf';
    }
    
    // Word documents
    if (extension === '.docx' || extension === '.doc' || mimeType.includes('word') || mimeType.includes('document')) {
      return 'docx';
    }
    
    // Plain text
    if (extension === '.txt' || mimeType.includes('text/plain')) {
      return 'text';
    }
    
    // JSON files
    if (extension === '.json' || mimeType.includes('application/json')) {
      return 'json';
    }
    
    // Default to the extension without the dot
    return extension.replace('.', '') || 'unknown';
  }
  
  /**
   * Process a file based on its type
   */
  async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    const fileType = this.determineFileType(file.originalname, file.mimetype);
    this.logger.info(`Processing file of type: ${fileType}`);
    
    // Generate a unique filename to avoid collisions
    const uniqueFileName = `${path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${path.extname(file.originalname)}`;
    const filePath = path.join(this.uploadsDir, uniqueFileName);
    
    // Ensure the file is saved to disk
    await fs.promises.writeFile(filePath, file.buffer);
    this.logger.info(`File saved to: ${filePath}`);
    
    let content: any = undefined;
    
    // Process different file types
    switch (fileType) {
      case 'csv':
        content = await this.processCsvFile(file.buffer, filePath);
        break;
      case 'excel':
        content = this.processExcelFile(file.buffer);
        break;
      case 'pdf':
        content = this.processPdfFile(file.buffer);
        break;
      case 'docx':
        content = this.processDocxFile(file.buffer);
        break;
      default:
        // For other file types, just return basic metadata
        this.logger.info(`No specific processing for file type: ${fileType}`);
    }
    
    return {
      originalName: file.originalname,
      fileName: uniqueFileName,
      fileType: fileType,
      contentType: file.mimetype,
      size: file.size,
      content: content,
      filePath: filePath
    };
  }
  
  /**
   * Process a CSV file
   */
  private async processCsvFile(buffer: Buffer, filePath: string): Promise<any> {
    this.logger.info('Processing CSV file');
    
    try {
      // Convert buffer to string and parse CSV
      const content = buffer.toString('utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      this.logger.info(`Parsed CSV records: ${records.length}`);
      this.logger.debug(`First two records:`, records.slice(0, 2));
      
      // Return a preview of the CSV content (first 5 rows)
      return {
        content: records.slice(0, 5),
        totalRows: records.length,
        filePath: filePath // Include the file path for document processing
      };
    } catch (error) {
      this.logger.error(`Error parsing CSV: ${error instanceof Error ? error.message : String(error)}`);
      return {
        error: `Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`,
        filePath: filePath // Still include the file path even if parsing failed
      };
    }
  }
  
  /**
   * Process an Excel file
   */
  private processExcelFile(buffer: Buffer): any {
    this.logger.info('Processing Excel file (basic)');
    
    // Basic Excel processing - in a real implementation, you would use a library like exceljs
    return {
      type: 'excel',
      message: 'Excel file received'
    };
  }
  
  /**
   * Process a PDF file
   */
  private processPdfFile(buffer: Buffer): any {
    this.logger.info('Processing PDF file (basic)');
    
    // Basic PDF processing - in a real implementation, you would use a library like pdf.js
    return {
      type: 'pdf',
      message: 'PDF file received'
    };
  }
  
  /**
   * Process a DOCX file
   */
  private processDocxFile(buffer: Buffer): any {
    this.logger.info('Processing DOCX file (basic)');
    
    // Basic DOCX processing - in a real implementation, you would use a library like mammoth
    return {
      type: 'docx',
      message: 'DOCX file received'
    };
  }
  
  /**
   * Upload a file
   */
  async uploadFile(file: Express.Multer.File, userId: string, organizationId: string): Promise<any> {
    this.logger.info(`Uploading file: ${file.originalname} (${file.size} bytes)`);
    
    // Process the file based on its type
    const processedFile = await this.processFile(file);
    this.logger.info(`File type detected: ${processedFile.fileType}`);
    
    // Determine the correct processing method based on file type
    let processingMethod: string;
    
    // Special case for CSV files - always use csv-processor
    if (processedFile.fileType === 'csv') {
      processingMethod = 'csv-processor';
      this.logger.info(`Setting CSV processor for file: ${file.originalname}`);
    } else if (processedFile.fileType === 'excel' || processedFile.fileType === 'xlsx' || processedFile.fileType === 'xls') {
      processingMethod = 'enhanced-excel-pipeline';
      this.logger.info(`Setting Enhanced Excel processor for file: ${file.originalname}`);
    } else {
      // Default processing method for other file types
      processingMethod = processedFile.fileType + '-processor';
      this.logger.info(`Setting default processor for ${processedFile.fileType} file: ${file.originalname}`);
    }
    
    // Create a data source for the file
    const dataSource = {
      name: processedFile.originalName,
      type: 'file',
      config: {
        fileType: processedFile.fileType,
        fileName: processedFile.fileName
      },
      metadata: {
        originalName: processedFile.originalName,
        fileType: processedFile.fileType,
        contentType: processedFile.contentType,
        size: processedFile.size,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        processingMethod: processingMethod,
        filePath: processedFile.filePath, // Include the file path in metadata
        preview: processedFile.content
      },
      organization_id: parseInt(organizationId, 10),
      created_by: userId, // Use created_by instead of user_id 
      status: 'queued' // Set to queued so it will be picked up for processing
    };
    
    this.logger.info(`Creating data source for ${processedFile.fileType} file: ${processedFile.originalName}`);
    
    // Store the data source in the database using the upload service
    const result = await this.uploadService.createDataSource(dataSource);
    
    this.logger.info(`Data source created with ID: ${result.id}`);
    
    return {
      ...processedFile,
      dataSourceId: result.id,
      status: 'uploaded'
    };
  }
} 