import { BaseDocumentProcessor, ProcessingResult } from './base-document-processor';
import { CustomPdfProcessorService } from './custom-pdf-processor.service';
import { CustomDocxProcessorService } from './custom-docx-processor.service';
import { EnhancedExcelProcessorService } from './enhanced-excel-processor.service';
import { CsvProcessorService } from './csv-processor.service';
import { EnhancedCsvProcessorService } from './enhanced-csv-processor.service';
import * as winston from 'winston';
import { OpenAIService } from '../openai.service';
import { ChunkingService } from '../chunking.service';
import { configService } from '../config.service';
import { QdrantService } from '../qdrant.service';
import * as path from 'path';
import { WebSocketService } from '../websocket.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config.service';
import { SocketService } from '../socket.service';
import { getServiceRegistry } from '../../services/service-registry';
import { shouldLogInitialization } from '../../utils/logger-config';

/**
 * Document Processor Factory
 * This factory manages the registration and retrieval of document processors
 */
@Injectable()
export class DocumentProcessorFactory {
  private processors = new Map<string, BaseDocumentProcessor>();
  private readonly logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentProcessorFactory]: ${message}`;
        return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
      })
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...rest } = info;
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentProcessorFactory]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private readonly openAIService: OpenAIService;
  private readonly chunkingService: ChunkingService;
  private readonly websocketService: WebSocketService;
  
  // Add singleton implementation
  private static instance: DocumentProcessorFactory | null = null;
  private static constructorCallCount = 0;
  
  /**
   * Get the singleton instance of DocumentProcessorFactory
   */
  public static getInstance(): DocumentProcessorFactory {
    if (!DocumentProcessorFactory.instance) {
      DocumentProcessorFactory.instance = new DocumentProcessorFactory();
    }
    return DocumentProcessorFactory.instance;
  }
  
  /**
   * Get the number of times the constructor has been called
   */
  public static getConstructorCallCount(): number {
    return DocumentProcessorFactory.constructorCallCount;
  }
  
  constructor(
    private configService: ConfigService = ConfigService.getInstance()
  ) {
    DocumentProcessorFactory.constructorCallCount++;
    
    // Warn if constructor is called directly more than once
    if (DocumentProcessorFactory.constructorCallCount > 1 && shouldLogInitialization('DocumentProcessorFactory')) {
      this.logger.warn(`DocumentProcessorFactory constructor called ${DocumentProcessorFactory.constructorCallCount} times. Use DocumentProcessorFactory.getInstance() instead of new DocumentProcessorFactory().`);
    }
    
    this.openAIService = OpenAIService.getInstance();
    this.chunkingService = ChunkingService.getInstance();
    this.websocketService = new WebSocketService();
    this.initialize();
    
    if (shouldLogInitialization('DocumentProcessorFactory')) {
      this.logger.info('Document processor factory initialized');
      this.logger.info(`Registered processors: ${Array.from(this.processors.keys()).join(', ')}`);
    }
  }
  
  /**
   * Initialize the factory and register default processors
   */
  private initialize() {
    this.logger.info('Initializing DocumentProcessorFactory');
    
    try {
      // Initialize processor services
      this.logger.debug('Creating instances of processor services');
      const configService = ConfigService.getInstance();
      const chunkingService = ChunkingService.getInstance();
      const qdrantService = QdrantService.getInstance();
      
      // Initialize Excel processor (enhanced version)
      try {
        this.logger.debug('Initializing Enhanced Excel Processor');
        const excelProcessor = new EnhancedExcelProcessorService(
          configService,
          chunkingService,
          qdrantService,
          this.websocketService
        );
        // Register with multiple keys to ensure it's found regardless of how it's referenced
        this.registerProcessor(['.xlsx', '.xls', '.ods', 'excel', 'xlsx', 'xls', 'ods', 'excel-processor'], excelProcessor);
        this.logger.info('Enhanced Excel Processor registered successfully');
      } catch (err) {
        this.logger.error(`Failed to initialize Enhanced Excel Processor: ${err}`);
      }
      
      // Initialize custom PDF processor
      try {
        this.logger.debug('Initializing Custom PDF Processor');
        const pdfProcessor = new CustomPdfProcessorService(
          configService,
          chunkingService,
          qdrantService,
          this.websocketService
        );
        this.registerProcessor(['.pdf'], pdfProcessor);
        this.logger.info('Custom PDF Processor registered successfully');
      } catch (err) {
        this.logger.error(`Failed to initialize Custom PDF Processor: ${err}`);
      }
      
      // Initialize custom DOCX processor
      try {
        this.logger.debug('Initializing Custom DOCX Processor');
        const docxProcessor = new CustomDocxProcessorService(
          configService,
          chunkingService,
          qdrantService
        );
        this.registerProcessor(['.docx', '.doc'], docxProcessor);
        this.logger.info('Custom DOCX Processor registered successfully');
      } catch (err) {
        this.logger.error(`Failed to initialize Custom DOCX Processor: ${err}`);
      }
      
      // Initialize CSV processor and register under multiple keys
      try {
        this.logger.debug('Initializing Enhanced CSV Processor');
        const csvProcessor = new EnhancedCsvProcessorService(
          configService,
          chunkingService,
          qdrantService,
          this.websocketService
        );
        this.registerProcessor(['.csv', 'csv', 'csv-processor'], csvProcessor);
        this.logger.info('Enhanced CSV Processor registered successfully');
      } catch (err) {
        this.logger.error(`Failed to initialize Enhanced CSV Processor: ${err}`);
      }
      
      // Register 'auto' processor strategy that will detect file type and use appropriate processor
      this.registerProcessor(['auto'], {
        processFile: async (filePath: string, dataSourceId: string, metadata: Record<string, any> = {}) => {
          this.logger.info(`Auto processor handling file: ${filePath}`);
          
          // Get file extension
          const fileExtension = path.extname(filePath).toLowerCase();
          this.logger.info(`File extension detected: ${fileExtension}`);
          
          // Get appropriate processor based on file extension
          const processor = this.getProcessorByPath(filePath);
          
          if (!processor) {
            this.logger.error(`No suitable processor found for ${filePath} with extension ${fileExtension}`);
            return {
              status: 'error',
              message: `Unsupported file type: ${fileExtension}`,
              chunks: 0,
              metadata: { error: 'unsupported_file_type' }
            };
          }
          
          this.logger.info(`Using processor for extension ${fileExtension} to process file: ${path.basename(filePath)}`);
          return processor.processFile(filePath, dataSourceId, metadata);
        }
      } as BaseDocumentProcessor);
      
      this.logger.info('Auto processor strategy registered successfully');
    } catch (err) {
      this.logger.error(`Failed to initialize DocumentProcessorFactory: ${err}`);
    }
  }
  
  /**
   * Register a processor for a specific file type
   * @param fileTypes Array of file types (extensions)
   * @param processor Processor instance
   */
  registerProcessor(fileTypes: string[], processor: BaseDocumentProcessor): void {
    fileTypes.forEach(fileType => {
      this.processors.set(fileType.toLowerCase(), processor);
      this.logger.debug(`Registered processor for ${fileType}: ${processor.constructor.name}`);
    });
  }
  
  /**
   * Get processor for a specific file type
   * @param fileType File type or extension
   * @returns Document processor or null if none found
   */
  getProcessor(fileTypeOrPath: string): BaseDocumentProcessor | null {
    this.logger.debug(`Getting processor for: ${fileTypeOrPath}`);
    
    // Handle null or undefined file type
    if (!fileTypeOrPath) {
      this.logger.warn('No file type provided to getProcessor');
      return null;
    }
    
    // Handle special case for 'auto' processing method
    if (fileTypeOrPath.toLowerCase() === 'auto') {
      this.logger.info(`Auto processing method detected, will determine processor based on file extension`);
      // This will be handled by getProcessorByPath when the actual file path is provided
      // For now, just log the information and return null
      return null;
    }
    
    // Convert to lowercase and remove any leading dot
    const normalizedType = fileTypeOrPath.toLowerCase().replace(/^\./, '');
    
    if (this.processors.has(normalizedType)) {
      this.logger.debug(`Found processor for ${normalizedType}: ${this.processors.get(normalizedType)?.constructor.name}`);
      return this.processors.get(normalizedType) || null;
    }
    
    this.logger.warn(`No processor found for file type: ${fileTypeOrPath}`);
    return null;
  }
  
  /**
   * Get processor based on file extension
   * @param filePath Path to the file
   * @returns Document processor or null if none found
   */
  getProcessorByPath(filePath: string): BaseDocumentProcessor | null {
    this.logger.debug(`Getting processor by path: ${filePath}`);
    
    if (!filePath) {
      this.logger.warn('No file path provided to getProcessorByPath');
      return null;
    }
    
    // Get the file extension
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (!fileExtension) {
      this.logger.warn(`No file extension found for path: ${filePath}`);
      return null;
    }
    
    // Try to get processor directly by extension
    const processor = this.processors.get(fileExtension);
    
    if (processor) {
      this.logger.info(`Found processor for file extension ${fileExtension}: ${processor.constructor.name}`);
      return processor;
    }
    
    // Check for file type without the dot
    const fileType = fileExtension.substring(1); // Remove the leading dot
    const processorByType = this.processors.get(fileType);
    
    if (processorByType) {
      this.logger.info(`Found processor for file type ${fileType}: ${processorByType.constructor.name}`);
      return processorByType;
    }
    
    // Special case for Excel files
    if (['.xlsx', '.xls', '.ods'].includes(fileExtension)) {
      const excelProcessor = this.processors.get('excel');
      if (excelProcessor) {
        this.logger.info(`Using Excel processor for ${filePath}`);
        return excelProcessor;
      }
    }
    
    // Special case for CSV files
    if (fileExtension === '.csv') {
      const csvProcessor = this.processors.get('csv');
      if (csvProcessor) {
        this.logger.info(`Using CSV processor for ${filePath}`);
        return csvProcessor;
      }
    }
    
    this.logger.warn(`No processor found for file type: ${fileType}`);
    this.logger.warn(`No processor found for file extension: ${fileExtension}`);
    return null;
  }
  
  /**
   * Check if a processor exists for the given file type
   * @param fileType File type or extension
   * @returns True if a processor exists, false otherwise
   */
  hasProcessor(fileType: string): boolean {
    if (!fileType) return false;
    
    const normalizedType = fileType.toLowerCase().replace(/^\./, '');
    return this.processors.has(normalizedType);
  }
  
  /**
   * Get all registered file types
   * @returns Array of registered file types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Check if a processor is available for the given file type
   */
  public hasProcessorForType(fileType: string): boolean {
    if (!fileType) return false;
    
    // Special handling for CSV to ensure it's always recognized
    if (fileType.toLowerCase() === 'csv' || fileType.toLowerCase() === 'csv-processor') {
      return this.processors.has('csv');
    }
    
    return this.processors.has(fileType.toLowerCase());
  }

  /**
   * Helper method to normalize collection names
   * @param dataSourceId The data source ID to normalize
   * @returns The normalized collection name
   */
  normalizeCollectionName(dataSourceId: string): string {
    // If it's already prefixed, return as is
    if (dataSourceId.startsWith('datasource_')) {
      return dataSourceId;
    }
    
    // If it has data_source_ prefix, convert it
    if (dataSourceId.startsWith('data_source_')) {
      return `datasource_${dataSourceId.substring(12)}`;
    }
    
    // Otherwise add the prefix
    return `datasource_${dataSourceId}`;
  }

  /**
   * Get processor based on file type
   * @param fileType Type of the file
   * @returns Document processor
   * @throws Error if no processor registered for the file type
   */
  getProcessorByFileType(fileType: string): BaseDocumentProcessor {
    this.logger.debug(`Getting processor by file type: ${fileType}`);
    
    if (!fileType) {
      this.logger.warn('No file type provided to getProcessorByFileType');
      throw new Error('File type is required');
    }
    
    // Normalize file type to lowercase
    const normalizedType = fileType.toLowerCase();
    
    // Handle direct mappings with period prefix
    if (normalizedType === 'pdf') {
      return this.processors.get('.pdf') || this.throwNoProcessorError(normalizedType);
    }
    
    if (normalizedType === 'docx') {
      return this.processors.get('.docx') || this.throwNoProcessorError(normalizedType);
    }
    
    // Special case for Excel files - always use the Excel processor
    if (normalizedType === 'excel' || normalizedType === 'xlsx' || normalizedType === 'xls' || normalizedType === 'ods') {
      this.logger.info(`Excel file type detected in getProcessorByFileType: ${fileType}`);
      const excelProcessor = this.processors.get('excel');
      if (excelProcessor) {
        return excelProcessor;
      }
    }
    
    if (normalizedType === 'xlsx') {
      return this.processors.get('.xlsx') || this.throwNoProcessorError(normalizedType);
    }
    
    // Special case for CSV files - always use the CSV processor
    if (normalizedType === 'csv') {
      this.logger.info(`CSV file type detected in getProcessorByFileType: ${fileType}`);
      const csvProcessor = this.processors.get('csv');
      if (csvProcessor) {
        return csvProcessor;
      }
    }
    
    // Handle special case for processing methods
    if (normalizedType === 'csv-processor' || normalizedType === 'excel-processor' || normalizedType === 'auto') {
      this.logger.info(`Special processor method detected in getProcessorByFileType: ${fileType}`);
      const processor = this.processors.get(normalizedType);
      if (processor) {
        return processor;
      }
    }
    
    // Try with dot prefix if not found directly
    if (!normalizedType.startsWith('.')) {
      const withDot = `.${normalizedType}`;
      const processorWithDot = this.processors.get(withDot);
      if (processorWithDot) {
        this.logger.info(`Found processor for file type with dot prefix: ${withDot}`);
        return processorWithDot;
      }
    }
    
    // Standard lookup
    const processor = this.processors.get(normalizedType);
    
    if (!processor) {
      return this.throwNoProcessorError(normalizedType);
    }
    
    return processor;
  }
  
  /**
   * Helper to throw a consistent error for missing processors
   */
  private throwNoProcessorError(fileType: string): never {
    this.logger.warn(`No processor registered for file type: ${fileType}`);
    throw new Error(`Unsupported file type: ${fileType}`);
  }
} 