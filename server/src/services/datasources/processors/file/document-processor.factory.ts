import { BaseDocumentProcessor, ProcessingResult } from './base-document.processor';
import { CustomPdfProcessorService } from './pdf/custom-pdf-processor.service';
import { CustomDocxProcessorService } from './docx/custom-docx.processor';
import { EnhancedExcelProcessorService } from './excel/enhanced-excel.processor';
import { EnhancedCsvProcessorService } from './csv/enhanced-csv-processor.service';
import * as winston from 'winston';
import { OpenAIService } from '../../../ai/openai.service';
import { DocumentChunkingService } from '../../../rag/chunking/document-chunking.service';
import { ConfigService } from '../../../core/config.service';
import * as path from 'path';
import { WebSocketService } from '../../../util/websocket.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentProcessorFactory {
  private processors = new Map<string, BaseDocumentProcessor>();
  private readonly logger: winston.Logger;
  
  // Declare injected properties explicitly
  private readonly configService: ConfigService;
  private readonly customPdfProcessor: CustomPdfProcessorService;
  private readonly enhancedCsvProcessor: EnhancedCsvProcessorService;
  private readonly customDocxProcessor: CustomDocxProcessorService;
  private readonly enhancedExcelProcessor: EnhancedExcelProcessorService;
  private readonly openAIService: OpenAIService;
  private readonly documentChunkingService: DocumentChunkingService;
  private readonly websocketService: WebSocketService;
  
  private static constructorCallCount = 0;
  
  /**
   * Get the singleton instance of DocumentProcessorFactory
   */
  
  
  /**
   * Get the number of times the constructor has been called
   */
  public static getConstructorCallCount(): number {
    return DocumentProcessorFactory.constructorCallCount;
  }
  
  constructor(
    configService: ConfigService,
    customPdfProcessor: CustomPdfProcessorService,
    enhancedCsvProcessor: EnhancedCsvProcessorService,
    customDocxProcessor: CustomDocxProcessorService,
    enhancedExcelProcessor: EnhancedExcelProcessorService,
    openAIService: OpenAIService,
    documentChunkingService: DocumentChunkingService,
    websocketService: WebSocketService
  ) {
    // Assign injected services to class properties
    this.configService = configService;
    this.customPdfProcessor = customPdfProcessor;
    this.enhancedCsvProcessor = enhancedCsvProcessor;
    this.customDocxProcessor = customDocxProcessor;
    this.enhancedExcelProcessor = enhancedExcelProcessor;
    this.openAIService = openAIService;
    this.documentChunkingService = documentChunkingService;
    this.websocketService = websocketService;
    
    // Initialize logger
    this.logger = winston.createLogger({
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
    
    // Initialize processors map
    this.initialize();
    this.logger.info(`DocumentProcessorFactory initialized. Constructor called ${++DocumentProcessorFactory.constructorCallCount} times.`);
    if (DocumentProcessorFactory.constructorCallCount > 1) {
        this.logger.warn('DocumentProcessorFactory constructor called multiple times. Ensure it is provided correctly (e.g., as a singleton).');
    }
  }
  
  /**
   * Initialize the factory and register default processors
   */
  private initialize() {
    this.logger.info('Initializing DocumentProcessorFactory - Registering injected processors...');
    try {
        // Register injected processors
        if (this.customPdfProcessor) {
            this.registerProcessor(['.pdf', 'pdf'], this.customPdfProcessor);
        } else { this.logger.warn('CustomPdfProcessorService not injected.'); }
        
        if (this.enhancedCsvProcessor) {
            this.registerProcessor(['.csv', 'csv'], this.enhancedCsvProcessor);
        } else { this.logger.warn('EnhancedCsvProcessorService not injected.'); }
        
        if (this.customDocxProcessor) {
            this.registerProcessor(['.docx', '.doc'], this.customDocxProcessor);
        } else { this.logger.warn('CustomDocxProcessorService not injected.'); }
        
        if (this.enhancedExcelProcessor) {
            this.registerProcessor(['.xlsx', '.xls', '.ods', 'excel'], this.enhancedExcelProcessor);
        } else { this.logger.warn('EnhancedExcelProcessorService not injected.'); }

        this.logger.info(`Initialization complete. Registered processors: ${Array.from(this.processors.keys()).join(', ')}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed during DocumentProcessorFactory initialization: ${errorMessage}`, err instanceof Error ? err.stack : undefined);
    }
  }
  
  /**
   * Register a processor for a specific file type
   * @param fileTypes Array of file types (extensions)
   * @param processor Processor instance
   */
  registerProcessor(fileTypes: string[], processor: BaseDocumentProcessor & { processorName?: string }): void {
      if (!processor.processorName) {
          // Assign name based on constructor if available, otherwise use fallback
          processor.processorName = processor.constructor?.name || 'AnonymousProcessor';
      }
      fileTypes.forEach(fileType => {
          this.processors.set(fileType.toLowerCase(), processor);
          this.logger.debug(`Registered processor for ${fileType}: ${processor.processorName}`);
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
      this.logger.info(`Found processor for ${fileExtension}: ${processor.constructor.name}`);
      return processor;
    }
    
    this.logger.warn(`No processor found for file type: ${fileExtension}`);
    return null;
  }
  
  /**
   * Get processor based on file type
   * @param fileType Type of the file
   * @returns Document processor
   * @throws Error if no processor registered for the file type
   */
  getProcessorByFileType(fileType: string): BaseDocumentProcessor | null {
    this.logger.debug(`Getting processor by file type: ${fileType}`);
    
    if (!fileType) {
      this.logger.warn('No file type provided to getProcessorByFileType');
      return null;
    }
    
    // Normalize file type to lowercase
    const normalizedType = fileType.toLowerCase();
    
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
      this.logger.warn(`No processor registered for file type: ${fileType}`);
      return null;
    }
    
    return processor;
  }
}