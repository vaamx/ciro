import { Knex } from 'knex';
import { BadRequestError } from '../utils/errors';
import { File } from '../types/file';
import { db } from '../infrastructure/database';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { Request } from '../types/express-types';
import { config } from '../config';
import { createServiceLogger } from '../utils/logger-factory';
import { DocumentProcessorFactory } from './document-processors/document-processor-factory';
import { FileType } from '../constants/file-types';

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB (increased from 50MB)
const ALLOWED_MIME_TYPES = {
  'text/csv': 'csv',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.oasis.opendocument.spreadsheet': 'excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/msword': 'word',
  'application/vnd.oasis.opendocument.text': 'word',
  'application/octet-stream': 'binary',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image'
} as const;

type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES;

interface DBFile {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  file_type: string;
  content: Buffer | null;
  metadata: Record<string, any>;
  organization_id: number;
  uploaded_by: number;
  created_at: Date;
  updated_at: Date;
}

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

export class FileService {
  // Base upload directory
  private readonly uploadsDir: string;
  private readonly logger = createServiceLogger('FileService');
  private documentProcessorFactory: DocumentProcessorFactory;
  
  constructor(private readonly dbInstance: Knex = db) {
    this.uploadsDir = path.resolve(config.uploadsDir || 'uploads');
    this.documentProcessorFactory = new DocumentProcessorFactory();
    this.ensureUploadDirectory();
  }
  
  // Create uploads directory if it doesn't exist
  private async ensureUploadDirectory(): Promise<void> {
    try {
      const exists = await existsAsync(this.uploadsDir);
      
      if (!exists) {
        await mkdirAsync(this.uploadsDir, { recursive: true });
        console.log(`Created uploads directory: ${this.uploadsDir}`);
      }
    } catch (error) {
      console.error('Error ensuring upload directory exists:', error);
      throw new Error('Failed to create uploads directory');
    }
  }

  // Store a file from multer to disk
  async storeFile(file: Express.Multer.File, prefix: string = ''): Promise<string> {
    try {
      this.logger.info(`Storing file: ${file.originalname}, size: ${file.size} bytes`);
      await this.ensureUploadDirectory();
      
      // Generate a unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${prefix ? prefix + '_' : ''}${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadsDir, fileName);
      
      this.logger.debug(`Generated file path: ${filePath}`);
      
      // Debug file buffer
      if (!file.buffer || !(file.buffer instanceof Buffer)) {
        this.logger.error(`Invalid file buffer: ${file.buffer ? typeof file.buffer : 'undefined'}`);
        throw new Error('Invalid file buffer');
      }
      
      // Write the file to disk
      await writeFileAsync(filePath, file.buffer);
      this.logger.info(`File stored successfully at: ${filePath}`);
      
      return filePath;
    } catch (error) {
      this.logger.error(`Error storing file: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to store file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Store a buffer to disk
  async storeBuffer(buffer: Buffer, prefix: string = ''): Promise<string> {
    try {
      await this.ensureUploadDirectory();
      
      // Generate a unique filename
      const fileName = `${prefix ? prefix + '_' : ''}${uuidv4()}.dat`;
      const filePath = path.join(this.uploadsDir, fileName);
      
      // Write buffer to disk
      await writeFileAsync(filePath, buffer);
      
      console.log(`Buffer stored successfully at: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error storing buffer:', error);
      throw new Error('Failed to store buffer');
    }
  }
  
  // Read a file from disk
  async readFile(filePath: string): Promise<Buffer> {
    try {
      return await readFileAsync(filePath);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw new Error(`Failed to read file: ${filePath}`);
    }
  }
  
  // Delete a file from disk
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (await existsAsync(filePath)) {
        await unlinkAsync(filePath);
        console.log(`File deleted successfully: ${filePath}`);
      } else {
        console.warn(`File not found for deletion: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw new Error(`Failed to delete file: ${filePath}`);
    }
  }

  isFileTypeAllowed(mimeType: string): mimeType is AllowedMimeType {
    return mimeType in ALLOWED_MIME_TYPES;
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestError('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Special handling for Excel files that might have incorrect MIME types
    const extension = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.ods'].includes(extension)) {
      // This is an Excel file based on extension, so we'll accept it
      // The actual validation will happen in the Excel processor
      this.logger.info(`Accepting file with extension ${extension} as Excel file`);
      return;
    }

    // Special handling for Word documents that might have incorrect MIME types
    if (['.docx', '.doc', '.odt'].includes(extension)) {
      // This is a Word document based on extension, so we'll accept it
      this.logger.info(`Accepting file with extension ${extension} as Word document`);
      return;
    }

    if (!this.isFileTypeAllowed(file.mimetype)) {
      throw new BadRequestError(`Unsupported file type: ${file.mimetype}`);
    }
  }

  private async processImage(file: Express.Multer.File): Promise<{ content: Buffer; metadata: any }> {
    const image = sharp(file.buffer);
    const metadata = await image.metadata();
    
    // Resize if image is too large
    if (metadata.width && metadata.width > 2048) {
      const content = await image.resize(2048, undefined, {
        withoutEnlargement: true,
        fit: 'inside'
      }).toBuffer();
      return { content, metadata };
    }

    return { content: file.buffer, metadata };
  }

  /**
   * Determine file type based on file extension
   * @param fileExtension The file extension (e.g., '.csv', '.pdf')
   * @returns The file type
   */
  private determineFileType(fileExtension: string): string {
    const extension = fileExtension.toLowerCase();
    
    switch (extension) {
      case '.csv':
        return 'csv';
      case '.pdf':
        return 'pdf';
      case '.xlsx':
      case '.xls':
      case '.ods':
        return 'excel';
      case '.docx':
      case '.doc':
      case '.odt':
        return 'word';
      case '.json':
        return 'json';
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
        return 'image';
      default:
        // Try to detect by removing the dot
        const extensionWithoutDot = extension.replace('.', '');
        if (['csv', 'pdf', 'xlsx', 'xls', 'docx', 'doc', 'odt', 'json', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extensionWithoutDot)) {
          return this.determineFileType(`.${extensionWithoutDot}`);
        }
        return 'unknown';
    }
  }

  /**
   * Validate and detect Excel file
   * @param file The file to validate
   * @returns True if the file is a valid Excel file
   */
  isExcelFile(file: Express.Multer.File): boolean {
    // Check MIME type first
    const excelMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];
    
    if (excelMimeTypes.includes(file.mimetype)) {
      return true;
    }
    
    // Check file extension as fallback
    const extension = path.extname(file.originalname).toLowerCase();
    return ['.xlsx', '.xls', '.ods'].includes(extension);
  }

  async uploadFile(
    file: Express.Multer.File,
    organizationId: number,
    userId: string,
    processingMethod?: string
  ): Promise<File> {
    try {
      const fileId = uuidv4(); // Generate UUID for the file
      this.logger.info(`Generated file ID: ${fileId}`);
      
      // Get file extension
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      // Determine file type based on extension
      let fileType = this.determineFileType(fileExtension);
      this.logger.info(`File type determined to be: ${fileType}`);
      
      // Special handling for Excel files
      if (fileType === 'excel' || this.isExcelFile(file)) {
        fileType = 'excel';
        this.logger.info('File identified as Excel spreadsheet');
        
        // If no processing method is specified, use the enhanced Excel processor
        if (!processingMethod) {
          processingMethod = 'excel';
          this.logger.info('Setting processing method to enhanced Excel processor');
        }
      }
      
      // Ensure upload directory exists
      const uploadPath = path.join(this.uploadsDir);
      await fs.promises.mkdir(uploadPath, { recursive: true });
      
      // Create a more unique filename that includes the UUID and organization ID
      const filename = `${fileId}_${userId.replace(/-/g, '')}.${fileExtension.replace('.', '')}`;
      const filePath = path.join(uploadPath, filename);
      
      // Store file on disk
      this.logger.info(`Storing file: ${file.originalname}, size: ${file.size} bytes`);
      await fs.promises.writeFile(filePath, file.buffer);
      this.logger.info(`File stored successfully at: ${filePath}`);
      
      // Ensure the data source name uses the original filename
      const dataSourceName = file.originalname;
      
      // Add file-specific metadata
      const metadata: any = {
        id: fileId,
        originalName: file.originalname,
        originalFilename: file.originalname, // Make sure this is always included
        filename,
        uploadedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        size: file.size,
        status: 'ready',
        filePath,
        fileType,
        userId: userId,
        uploadedBy: userId
      };
      
      // Add processing method to metadata if provided
      if (processingMethod) {
        this.logger.info(`Using specified processing method: ${processingMethod}`);
        metadata.processingMethod = processingMethod;
      } else if (fileType === 'csv') {
        // Force CSV files to use CSV processor if no specific method is provided
        this.logger.info('CSV file detected, setting processing method to csv-processor');
        metadata.processingMethod = 'csv-processor';
      } else if (fileType === 'excel') {
        // Force Excel files to use Excel processor if no specific method is provided
        this.logger.info('Excel file detected, setting processing method to excel');
        metadata.processingMethod = 'excel';
      }
      
      // Insert file info into database
      this.logger.info(`Inserting file record into database: ${fileId}`);
      
      const [insertedFile] = await this.dbInstance('files')
        .insert({
          id: fileId,
          original_filename: file.originalname,
          filename: filename,
          file_type: fileType,
          mime_type: file.mimetype,
          size: file.size,
          uploaded_by: userId,
          organization_id: organizationId,
          created_at: new Date(),
          updated_at: new Date(),
          metadata: metadata  // filePath is already included in metadata
        })
        .returning('*');
      
      this.logger.info(`File inserted successfully: ${insertedFile.id}`);

      // Check for an existing data source that references this file ID
      let existingDataSource;
      try {
        // Enhanced check: Try to find an existing data source with this file ID in metadata
        existingDataSource = await this.dbInstance('data_sources')
          .whereRaw("metadata->>'id' = ?", [fileId])
          .first();
          
        if (existingDataSource) {
          this.logger.info(`Found existing data source ${existingDataSource.id} for file ID ${fileId}, skipping data source creation`);
        } else {
          // Additional check: Try to find by file-to-data-source mapping
          const mapping = await this.dbInstance('file_to_data_source')
            .where({ file_id: fileId })
            .first();
          
          if (mapping) {
            existingDataSource = await this.dbInstance('data_sources')
              .where({ id: mapping.data_source_id })
              .first();
            
            if (existingDataSource) {
              this.logger.info(`Found existing data source ${existingDataSource.id} from mapping for file ID ${fileId}`);
            }
          }
        }
      } catch (err) {
        this.logger.error(`Error checking for existing data source: ${err}`);
      }
      
      // Create a data source for ALL file types, not just PDFs
      if (!existingDataSource) {
        this.logger.info(`Creating data source for file ID: ${fileId}, type: ${fileType}`);
        
        // Normalize data source name by removing special characters
        const dataSourceName = `${file.originalname}_${new Date().toISOString().replace(/:/g, '-')}`;
        
        try {
          // Get user ID as numeric if possible
          let userIdNumeric = parseInt(userId, 10);
          if (isNaN(userIdNumeric)) {
            try {
              // Try to find user record to get numeric ID
              const userRecord = await this.dbInstance('users')
                .where({ id: userId })
                .first();
                
              if (userRecord && userRecord.id) {
                userIdNumeric = userRecord.id;
              } else {
                userIdNumeric = 1; // Default to first user if not found
              }
            } catch (userErr) {
              this.logger.error(`Error looking up user ID: ${userErr}`);
              userIdNumeric = 1; // Default to first user
            }
          }
        
          const dataSource = await this.dbInstance('data_sources')
            .insert({
              organization_id: organizationId,
              name: dataSourceName,
              type: `local-files-${fileType}`,
              status: 'queued', // Start as queued for processing
              description: `File upload: ${file.originalname}`,
              last_sync: new Date(),
              metadata: {
                id: fileId,
                url: '',
                size: file.size.toString(),
                status: 'ready',
                preview: null,
                fileType: fileType,
                filename: file.originalname,
                syncRate: 100,
                uploadedAt: new Date().toISOString(),
                avgSyncTime: '0s',
                lastModified: new Date().toISOString(),
                processingMethod: processingMethod || `${fileType}-processor`,
                filePath: filePath // Always include file path for all documents
              },
              metrics: {
                chunks: 0,
                vectorsStored: 0,
                processingTime: '0ms'
              },
              created_by: userId, // Keep as UUID string
              created_at: new Date(),
              updated_at: new Date()
            })
            .returning('*');
            
          this.logger.info(`Created new data source with ID: ${dataSource[0].id} for file ${fileId}`);
          
          // Store the datasource ID in the metadata
          metadata.dataSourceId = dataSource[0].id;
          
          // Make sure file is properly linked to this data source ID
          try {
            // Store file to data source mapping
            await this.dbInstance('file_to_data_source')
              .insert({
                file_id: fileId,
                data_source_id: dataSource[0].id.toString(),
                created_at: new Date()
              })
              .onConflict(['file_id', 'data_source_id'])
              .ignore();
              
            this.logger.info(`Stored file to data source mapping: ${fileId} -> ${dataSource[0].id}`);
            
            // Update file metadata with data source ID
            await this.dbInstance('files')
              .where({ id: fileId })
              .update({
                metadata: {
                  ...metadata,
                  dataSourceId: dataSource[0].id,
                  processingDataSourceId: dataSource[0].id // Clear indication this is the real processing data source
                }
              });
                
            this.logger.info(`Updated file metadata with processing data source ID: ${dataSource[0].id}`);
          } catch (updateError) {
            this.logger.error(`Error updating file metadata: ${updateError}`);
          }
        } catch (dsError) {
          this.logger.error(`Error creating data source: ${dsError}`);
          // Continue even if data source creation fails
        }
      } else if (existingDataSource) {
        // If we have an existing data source, store its ID in the metadata
        metadata.dataSourceId = existingDataSource.id;
        
        // Store file to data source mapping
        try {
          await this.dbInstance('file_to_data_source')
            .insert({
              file_id: fileId,
              data_source_id: existingDataSource.id.toString(),
              created_at: new Date()
            })
            .onConflict(['file_id', 'data_source_id'])
            .ignore();
            
          this.logger.info(`Stored file to data source mapping: ${fileId} -> ${existingDataSource.id}`);
        } catch (mapError) {
          this.logger.error(`Error storing file to data source mapping: ${mapError}`);
        }
      }

      // Queue for processing if a processing method is specified
      if (metadata.processingMethod && fileType !== 'csv') {
        this.logger.info(`Queuing file for processing with method: ${metadata.processingMethod}`);
        
        try {
          // Skip data source creation as it's already been handled above
          
          // Special case for 'auto' processing method
          if (metadata.processingMethod.toLowerCase() === 'auto') {
            this.logger.info(`Auto processing method detected, determining processor based on file extension for ${filePath}`);
            // Get processor factory
            const processor = this.documentProcessorFactory.getProcessorByPath(filePath);
            
            if (processor) {
              this.logger.info(`Selected processor ${processor.processorName} for auto processing of file ID: ${fileId}`);
              
              // Get numeric data source ID if we have one
              const dataSourceId = metadata.dataSourceId || fileId;
              
              // Process async to not block response
              const processorMetadata = {
                ...metadata,
                numericUserId: this.extractNumericUserId(userId)
              };
              
              processor.processFile(filePath, String(dataSourceId), processorMetadata).catch(err => {
                this.logger.error(`Error processing ${fileId} with auto-selected processor:`, err);
              });
            } else {
              this.logger.warn(`No processor found for auto processing of file: ${filePath}`);
            }
          } else {
            // Use the specified processing method
            const processor = this.documentProcessorFactory.getProcessor(metadata.processingMethod);
            if (processor) {
              this.logger.info(`Starting document processing with ${metadata.processingMethod} for file ID: ${fileId}`);
              
              // Get numeric data source ID if we have one
              const dataSourceId = metadata.dataSourceId || fileId;
              
              // Process async to not block response
              const processorMetadata = {
                ...metadata,
                numericUserId: this.extractNumericUserId(userId)
              };
              
              processor.processFile(filePath, String(dataSourceId), processorMetadata).catch(err => {
                this.logger.error(`Error processing file ${fileId}:`, err);
              });
            } else {
              this.logger.warn(`No processor found for method: ${metadata.processingMethod}`);
            }
          }
        } catch (procError) {
          this.logger.error(`Error queuing document for processing: ${procError}`);
          // Continue even if processing failed to queue
        }
      }
      // Special handling for CSV files - they need to be processed by their own processor
      else if (fileType === 'csv') {
        this.logger.info(`CSV file detected, preparing to process with csv-processor: ${fileId}`);
        try {
          // Get the data source ID if we have one, otherwise use the file ID
          const dataSourceId = metadata.dataSourceId || fileId;
          
          // Initialize the CSV processor directly to avoid dependency issues
          const CsvProcessorService = require('./document-processors/csv-processor.service').CsvProcessorService;
          const configService = new (require('./config.service').ConfigService)();
          const chunkingService = new (require('./chunking.service').ChunkingService)();
          const qdrantService = require('./qdrant.service').QdrantService.getInstance();
          const websocketService = new (require('./websocket.service').WebSocketService)();
          
          // Create a new CSV processor instance
          const csvProcessor = new CsvProcessorService(
            configService,
            chunkingService,
            qdrantService,
            websocketService
          );
          
          this.logger.info(`CSV processor initialized, processing file: ${filePath} with data source ID: ${dataSourceId}`);
          
          // Add extra metadata to help with processing
          const processorMetadata = {
            ...metadata,
            numericUserId: this.extractNumericUserId(userId),
            fileType: 'csv',
            skipDatabaseCheck: false,
            directProcessing: true,
            verbose: true
          };
          
          // Process the file and handle any errors
          csvProcessor.processFile(filePath, String(dataSourceId), processorMetadata)
            .then(result => {
              this.logger.info(`CSV processor completed for file ${fileId} with status: ${result.status}`);
            })
            .catch(error => {
              this.logger.error(`Error processing CSV file ${fileId}: ${error instanceof Error ? error.message : String(error)}`);
            });
        } catch (csvError) {
          this.logger.error(`Error initializing CSV processor for file ${fileId}: ${csvError instanceof Error ? csvError.message : String(csvError)}`);
        }
      }

      // Return the inserted file record with updated metadata
      return {
        ...insertedFile,
        metadata
      };
    } catch (error) {
      this.logger.error(`Error in file upload: ${error}`);
      throw new Error(`File upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process a CSV file using the CsvProcessorService
   * @param filePath Path to the CSV file
   * @param dataSourceId ID of the data source
   */
  async processCSVFile(filePath: string, dataSourceId: string): Promise<void> {
    this.logger.info(`Starting CSV file processing for data source ${dataSourceId}`, { filePath });

    try {
      // Initialize the document processor factory if needed
      if (!this.documentProcessorFactory) {
        const { DocumentProcessorFactory } = require('./document-processors/document-processor-factory');
        this.documentProcessorFactory = new DocumentProcessorFactory();
        this.logger.info('Document processor factory initialized for CSV processing');
      }

      // Get a CSV processor specifically
      const csvProcessor = this.documentProcessorFactory.getProcessor('csv');
      if (!csvProcessor) {
        throw new Error('CSV processor not available');
      }

      this.logger.info('Reading CSV file content', { filePath });
      const fileContent = await this.readFile(filePath);
      
      // Process the CSV file
      this.logger.info('Processing CSV file with dedicated CSV processor', { 
        dataSourceId, 
        fileSize: fileContent.length 
      });
      
      // Use processFile method which is part of the BaseDocumentProcessor interface
      const result = await csvProcessor.processFile(filePath, dataSourceId, {
        skipDatabaseCheck: true, // We've already created the DB record
        directProcessing: true,
        verbose: true
      });

      this.logger.info('CSV processing completed successfully', { 
        dataSourceId,
        recordCount: result.metadata?.recordCount || 'unknown',
        status: result.status
      });

      // Update the data source status to completed
      await this.dbInstance('data_sources')
        .where({ id: dataSourceId })
        .update({ 
          status: result.status === 'success' ? 'completed' : 'error',
          updated_at: new Date(),
          metadata: this.dbInstance.raw(`jsonb_set(metadata, '{processingComplete}', 'true')`)
        });

      this.logger.info('Data source status updated to completed', { dataSourceId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing CSV file: ${errorMessage}`, { dataSourceId, filePath, error });
      
      // Update the data source status to error
      try {
        await this.dbInstance('data_sources')
          .where({ id: dataSourceId })
          .update({ 
            status: 'error',
            updated_at: new Date(),
            metadata: this.dbInstance.raw(`jsonb_set(metadata, '{processingError}', '"${errorMessage.replace(/"/g, '\\"')}"')`)
          });
        this.logger.info('Data source status updated to error', { dataSourceId });
      } catch (updateError) {
        this.logger.error('Failed to update data source status after CSV processing error', { 
          dataSourceId, 
          error: updateError 
        });
      }
      
      throw error;
    }
  }

  /**
   * Add file path to data source metadata
   * This ensures the CSV processor can find the file
   */
  async addFilePathToDataSource(dataSourceId: string, filePath: string): Promise<void> {
    this.logger.info(`Adding file path to data source ${dataSourceId}: ${filePath}`);
    
    try {
      // Get current metadata
      const dataSource = await this.dbInstance('data_sources')
        .where('id', dataSourceId)
        .first();
      
      if (!dataSource) {
        this.logger.error(`Data source not found: ${dataSourceId}`);
        return;
      }
      
      // Update metadata with file path
      const updatedMetadata = {
        ...dataSource.metadata,
        filePath
      };
      
      // Update data source
      await this.dbInstance('data_sources')
        .where('id', dataSourceId)
        .update({
          metadata: updatedMetadata,
          updated_at: new Date()
        });
      
      this.logger.info(`Successfully added file path to data source ${dataSourceId}`);
    } catch (error) {
      this.logger.error(`Error adding file path to data source: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAllFiles(organizationId: number): Promise<File[]> {
    const files = await this.dbInstance('files')
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');

    return files.map(this.mapFileResponse);
  }

  async getFileById(fileId: number, organizationId: number): Promise<File> {
    const file = await this.dbInstance('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .first();

    if (!file) {
      throw new BadRequestError('File not found');
    }

    return this.mapFileResponse(file);
  }

  async searchFiles(query: string, organizationId: number): Promise<File[]> {
    const files = await this.dbInstance('files')
      .where({ organization_id: organizationId })
      .where(builder => {
        builder
          .whereILike('filename', `%${query}%`)
          .orWhereILike('original_filename', `%${query}%`)
          .orWhereILike('file_type', `%${query}%`);
      })
      .orderBy('created_at', 'desc');

    return files.map(this.mapFileResponse);
  }

  async getFileContent(fileId: number, organizationId: number): Promise<Buffer> {
    const file = await this.dbInstance('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .select('content')
      .first();

    if (!file || !file.content) {
      throw new BadRequestError('File content not found');
    }

    return file.content;
  }

  async deleteFileById(fileId: number, organizationId: number): Promise<void> {
    // Delete the file record from the database
    const deletedCount = await this.dbInstance('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .delete();

    if (deletedCount === 0) {
      throw new BadRequestError('File not found or you do not have permission to delete it');
    }
  }

  async updateFileMetadata(fileId: string, updateData: { metadata: Record<string, any> }): Promise<File> {
    // Convert string id to number
    const id = parseInt(fileId, 10);
    if (isNaN(id)) {
      throw new BadRequestError('Invalid file ID');
    }

    // Update the file in the database
    const [updatedFile] = await this.dbInstance('files')
      .where({ id })
      .update({
        metadata: updateData.metadata,
        updated_at: new Date()
      })
      .returning('*');

    if (!updatedFile) {
      throw new BadRequestError('File not found');
    }

    return this.mapFileResponse(updatedFile);
  }

  private mapFileResponse(file: DBFile): File {
    const { content, ...fileData } = file;
    return {
      ...fileData,
      hasContent: !!content
    };
  }

  /**
   * Get file information from a file path
   */
  async getFileInfo(filePath: string): Promise<{ name: string; size: number; mimeType: string }> {
    try {
      await this.ensureUploadDirectory();
      
      // Check if file exists
      const exists = await existsAsync(filePath);
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Get file stats
      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      
      // Determine mime type based on extension
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'application/octet-stream'; // Default mime type
      
      // Map common extensions to mime types
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
      };
      
      if (ext in mimeMap) {
        mimeType = mimeMap[ext];
      }
      
      console.log(`Retrieved file info for: ${filePath}`, {
        name: fileName,
        size: stats.size,
        mimeType
      });
      
      return {
        name: fileName,
        size: stats.size,
        mimeType
      };
    } catch (error) {
      console.error(`Error getting file info for ${filePath}:`, error);
      throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the extension from a filename
   * @param filename The filename to get the extension from
   * @returns The file extension (without the leading dot)
   */
  private getFileExtension(filename: string): string {
    const ext = path.extname(filename);
    return ext ? ext.slice(1) : '';
  }

  private async queueFileForProcessing(fileId: string, processingMethod: string): Promise<void> {
    try {
      // First check if the file exists
      const file = await this.dbInstance('files')
        .where({ id: fileId })
        .first();
        
      if (!file) {
        this.logger.error(`File ${fileId} not found for processing`);
        return;
      }
      
      // Get filePath from metadata
      let filePath = '';
      if (file.metadata && file.metadata.filePath) {
        filePath = file.metadata.filePath;
      } else {
        // Without a file path, we can't process
        this.logger.error(`File ${fileId} has no filePath in metadata, cannot process`);
        return;
      }
      
      // Check for an existing data source ID for this file
      let dataSourceId;
      
      // First check the file metadata
      if (file.metadata && file.metadata.dataSourceId) {
        dataSourceId = file.metadata.dataSourceId;
        this.logger.info(`Found data source ID ${dataSourceId} in file metadata for ${fileId}`);
      } else {
        // Check the file_to_data_source mapping table
        const mapping = await this.dbInstance('file_to_data_source')
          .where({ file_id: fileId })
          .first();
          
        if (mapping && mapping.data_source_id) {
          dataSourceId = mapping.data_source_id;
          this.logger.info(`Found data source ID ${dataSourceId} in mapping table for ${fileId}`);
        } else {
          // No existing data source found, create one
          try {
            this.logger.info(`No mapping found in file_to_data_source table for UUID ${fileId}`);
            this.logger.info(`Creating new data source for UUID ${fileId}`);
            
            // CRITICAL FIX: Convert user ID to numeric format and ensure it's a number
            let numericUserId = 1; // Default to 1 if conversion fails
            
            try {
              // If uploaded_by is already a number, use it directly
              if (typeof file.uploaded_by === 'number') {
                numericUserId = file.uploaded_by;
                this.logger.info(`Using numeric user ID directly: ${numericUserId}`);
              } 
              // If it's a string that can be parsed as a number, use that
              else if (typeof file.uploaded_by === 'string' && !isNaN(parseInt(file.uploaded_by, 10)) && !file.uploaded_by.includes('-')) {
                numericUserId = parseInt(file.uploaded_by, 10);
                this.logger.info(`Parsed numeric user ID from string: ${numericUserId}`);
              }
              // If it's a UUID, convert it
              else if (typeof file.uploaded_by === 'string' && file.uploaded_by.includes('-')) {
                const uuidDigits = file.uploaded_by.replace(/-/g, '');
                numericUserId = parseInt(uuidDigits.substring(0, 8), 16) % 1000000;
                numericUserId = Math.abs(numericUserId) || 1;
                this.logger.info(`Converted UUID ${file.uploaded_by} to numeric ID: ${numericUserId}`);
              }
              // Fallback
              else {
                this.logger.warn(`Could not determine user ID type, using default value 1`);
              }
            } catch (idError) {
              this.logger.error(`Error converting user ID: ${idError.message}, using default value 1`);
            }
            
            this.logger.info(`Using numeric user ID ${numericUserId} for created_by field`);
            
            // Create a data source with the numeric user ID
            const dataSourceName = `${file.original_filename}_${new Date().toISOString().replace(/:/g, '-')}`;
            
            // CRITICAL FIX: Explicitly create the data source with a numeric created_by
            const dataSourceData = {
              organization_id: file.organization_id,
              name: dataSourceName,
              type: `local-files-${file.file_type}`,
              status: 'processing',
              description: `File upload: ${file.original_filename}`,
              last_sync: new Date(),
              metadata: {
                id: fileId,
                url: '',
                size: file.size.toString(),
                status: 'processing',
                preview: null,
                fileType: file.file_type,
                filename: file.original_filename,
                syncRate: 100,
                uploadedAt: new Date().toISOString(),
                avgSyncTime: '0s',
                lastModified: new Date().toISOString(),
                processingMethod: processingMethod,
                filePath: filePath
              },
              metrics: {
                chunks: 0,
                vectorsStored: 0,
                processingTime: '0ms'
              },
              created_by: numericUserId, // Use appropriate ID that exists in scope
              created_at: new Date(),
              updated_at: new Date()
            };
            
            // Log the data being inserted
            this.logger.info(`Inserting data source with created_by: ${numericUserId} (type: ${typeof numericUserId})`);
            
            const [newDataSource] = await this.dbInstance('data_sources')
              .insert(dataSourceData)
              .returning('*');
              
            if (newDataSource && newDataSource.id) {
              dataSourceId = newDataSource.id;
              this.logger.info(`Created new data source with ID: ${dataSourceId}`);
              
              // Store the mapping
              await this.dbInstance('file_to_data_source')
                .insert({
                  file_id: fileId,
                  data_source_id: dataSourceId.toString(),
                  created_at: new Date()
                })
                .onConflict(['file_id', 'data_source_id'])
                .ignore();
                
              this.logger.info(`Stored file to data source mapping: ${fileId} -> ${dataSourceId}`);
              
              // Update file metadata
              await this.dbInstance('files')
                .where({ id: fileId })
                .update({
                  metadata: {
                    ...file.metadata,
                    dataSourceId: dataSourceId,
                    processingDataSourceId: dataSourceId
                  }
                });
                
              this.logger.info(`Updated file metadata with data source ID: ${dataSourceId}`);
            } else {
              this.logger.error(`Failed to create new data source for file ${fileId}`);
              return;
            }
          } catch (createError) {
            this.logger.error(`Error creating new data source: ${createError.message}`);
            return;
          }
        }
      }
      
      if (!dataSourceId) {
        this.logger.error(`No data source ID found for file ${fileId}, cannot process`);
        return;
      }
      
      // Get file metadata for processing
      const metadata = {
        filename: file.original_filename,
        organizationId: file.organization_id,
        userId: file.uploaded_by,
        processingMethod: processingMethod,
        dataSourceId: dataSourceId,
        numericUserId: this.extractNumericUserId(file.uploaded_by || '1')
      };
      
      this.logger.info(`Using specified processing method: ${processingMethod}`);
      
      // Auto detection of processor
      if (processingMethod === 'auto') {
        this.logger.info(`Auto processing method detected, determining processor based on file extension for ${filePath}`);
        // Find a processor based on file extension
        const processor = this.documentProcessorFactory.getProcessorByPath(filePath);
        
        if (processor) {
          this.logger.info(`Found processor for file extension ${path.extname(filePath).toLowerCase()}: ${processor.processorName}`);
          this.logger.info(`Selected processor ${processor.processorName} for auto processing of file ID: ${fileId}`);
          
          // Process async to not block response
          processor.processFile(filePath, String(dataSourceId), metadata).catch(err => {
            this.logger.error(`Error processing ${fileId} with auto-selected processor:`, err);
          });
        } else {
          this.logger.warn(`No processor found for auto processing of file: ${filePath}`);
        }
      } else {
        // Get the appropriate processor
        const processor = this.documentProcessorFactory.getProcessor(processingMethod);
        
        if (processor) {
          this.logger.info(`Processing file ${fileId} with processor ${processingMethod}`);
          
          // Process async to not block response
          processor.processFile(filePath, String(dataSourceId), metadata).catch(err => {
            this.logger.error(`Error processing ${fileId} with processor ${processingMethod}:`, err);
          });
        } else {
          this.logger.error(`Processor not found for method: ${processingMethod}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error queueing file for processing: ${error}`);
    }
  }

  /**
   * Convert a UUID to a numeric user ID for database compatibility
   * @param userId UUID string
   * @returns numeric user ID
   */
  private extractNumericUserId(userId: string): number {
    try {
      // If already a number, return it
      if (!isNaN(Number(userId))) {
        const numericId = Number(userId);
        this.logger.debug(`User ID ${userId} is already numeric: ${numericId}`);
        return numericId;
      }
      
      // If a UUID, convert to numeric ID
      if (userId && typeof userId === 'string' && userId.includes('-')) {
        const uuidDigits = userId.replace(/-/g, '');
        const numericId = parseInt(uuidDigits.substring(0, 8), 16) % 1000000;
        const result = Math.abs(numericId) || 1;
        this.logger.debug(`Converted UUID ${userId} to numeric ID: ${result}`);
        return result;
      }
      
      // Default
      this.logger.warn(`Could not convert user ID ${userId} to numeric, using default value 1`);
      return 1;
    } catch (error) {
      this.logger.warn(`Failed to convert UUID to numeric ID: ${error}, using default value 1`);
      return 1;
    }
  }

  /**
   * Link a file to a data source
   * @param fileId File UUID
   * @param dataSourceId Data source ID
   */
  async linkFileToDataSource(fileId: string, dataSourceId: string | number): Promise<void> {
    try {
      this.logger.info(`Linking file ${fileId} to data source ${dataSourceId}`);
      
      // Check if the link already exists
      const existingLink = await this.dbInstance('file_to_data_source')
        .where({ file_id: fileId, data_source_id: String(dataSourceId) })
        .first();
      
      if (existingLink) {
        this.logger.info(`File ${fileId} is already linked to data source ${dataSourceId}`);
        return;
      }
      
      // Create the link
      await this.dbInstance('file_to_data_source').insert({
        file_id: fileId,
        data_source_id: String(dataSourceId),
        created_at: new Date()
      });
      
      this.logger.info(`Successfully linked file ${fileId} to data source ${dataSourceId}`);
    } catch (error) {
      this.logger.error(`Error linking file to data source: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw error - this is a non-critical operation
    }
  }
} 