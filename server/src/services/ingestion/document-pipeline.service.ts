import { Injectable, InternalServerErrorException, Optional, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as winston from 'winston';
import { FileType } from '../../types';
import { QdrantSearchService } from '../vector/search.service';
import { QdrantCollectionService } from '../vector/collection-manager.service';
import { DocumentProcessorFactory } from '../datasources/processors/file/document-processor.factory';
import { LLMService } from '../llm';

// Define Job Data interface
interface DocumentJobData {
  filePath: string;
  fileType: FileType;
  dataSourceId: string; // Renamed from collectionId for clarity
  metadata?: Record<string, any>;
  // Include options if needed by the processor
  options?: Record<string, any>; 
}

/**
 * Service for processing documents through the pipeline
 */
@Injectable()
export class DocumentPipelineService {
  private logger: winston.Logger;
  private readonly isQueueDisabled: boolean;
  
  constructor(
    @Optional() @InjectQueue('document-processing') private documentQueue: Queue<DocumentJobData> | null,
    // Make dependencies optional
    @Optional() private readonly documentProcessorFactory: DocumentProcessorFactory | null,
    @Optional() private readonly qdrantSearchService: QdrantSearchService | null,
    @Optional() private readonly qdrantCollectionService: QdrantCollectionService | null,
    @Optional() private readonly llmService: LLMService | null,
    ) {
    // Check if queue is disabled
    this.isQueueDisabled = !this.documentQueue;
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentPipelineService]: ${message}`;
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
              const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentPipelineService]: ${message}`;
              return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
            })
          )
        })
      ]
    });
    
    // Log initialization status
    if (this.isQueueDisabled) {
      this.logger.warn('DocumentPipelineService initialized with Queue DISABLED. Document processing will be simulated.');
      console.log('>>> DOCUMENT-PIPELINE: Queue is DISABLED - running in simulation mode');
    } else {
      this.logger.info('DocumentPipelineService initialized with Queue injection and LLM abstraction layer.');
      console.log('>>> DOCUMENT-PIPELINE: Queue is ENABLED - using Bull for document processing');
    }
    
    // Log dependency status
    if (!this.documentProcessorFactory) {
      console.log('>>> DOCUMENT-PIPELINE: DocumentProcessorFactory is not available - document processing will be limited');
    }
    if (!this.qdrantSearchService) {
      console.log('>>> DOCUMENT-PIPELINE: QdrantSearchService is not available - vector search will be unavailable');
    }
    if (!this.qdrantCollectionService) {
      console.log('>>> DOCUMENT-PIPELINE: QdrantCollectionService is not available - vector collections will be unavailable');
    }
    if (!this.llmService) {
      console.log('>>> DOCUMENT-PIPELINE: LLMService is not available - AI features will be limited');
    }
  }

  /**
   * Adds a document processing job to the queue.
   * @param filePath Path to the stored file
   * @param fileType Type of the file
   * @param dataSourceId Data Source ID (used as collectionId previously)
   * @param metadata Additional metadata
   * @returns Information about the queued job.
   */
  async processDocumentStream(
    filePath: string,
    fileType: FileType,
    dataSourceId: string, // Renamed param for clarity
    metadata: Record<string, any> = {}
  ): Promise<{ jobId: string | number; status: string }> { // Updated return type
    try {
      this.logger.info(`Processing document for DataSource ID: ${dataSourceId}`, {
        filePath,
        fileType,
        metadata: JSON.stringify(metadata)
      });

      // Prepare job data
      const jobData: DocumentJobData = {
        filePath,
        fileType,
        dataSourceId, // Pass dataSourceId
        metadata, // Pass original metadata
        options: metadata.options || {} // Pass options if they exist within metadata
      };

      // Check if queue is disabled
      if (this.isQueueDisabled) {
        // Simulate processing when Bull/Redis is disabled
        this.logger.info(`[SIMULATION MODE] Job for DataSource ID: ${dataSourceId} would be queued`);
        
        // Generate a fake job ID using timestamp
        const simulatedJobId = `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        return {
          jobId: simulatedJobId,
          status: 'simulated'
        };
      }

      // Add job to the queue if enabled
      const job = await this.documentQueue!.add('process-job', jobData, {
        // Optional: Add job options like attempts, backoff strategy
        // attempts: 3, 
        // backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true, // Remove job from Redis once completed
        removeOnFail: 50 // Keep last 50 failed jobs
      });

      this.logger.info(`Job queued successfully for DataSource ID: ${dataSourceId} with Job ID: ${job.id}`);

      return {
        jobId: job.id,
        status: 'queued'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error queuing document processing job';
      this.logger.error(`Error processing document for DataSource ID ${dataSourceId}: ${errorMessage}`, error);
      // Re-throw or handle differently? Re-throwing for now.
      throw new InternalServerErrorException(`Failed to process document: ${errorMessage}`);
    }
  }

  /**
   * Process document directly without queuing (for use within job consumers to avoid infinite loops).
   * @param filePath Path to the stored file
   * @param fileType Type of the file
   * @param dataSourceId Data Source ID 
   * @param metadata Additional metadata
   * @returns Processing result
   */
  async processDocumentDirect(
    filePath: string,
    fileType: FileType,
    dataSourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<{ status: string; result?: any; error?: any }> {
    try {
      this.logger.info(`Direct processing document for DataSource ID: ${dataSourceId}`, {
        filePath,
        fileType,
        metadata: JSON.stringify(metadata)
      });

      // Check if we have the required dependencies for processing
      if (!this.documentProcessorFactory) {
        this.logger.warn('DocumentProcessorFactory not available - cannot process document directly');
        return { status: 'error', error: 'DocumentProcessorFactory not available' };
      }

      if (!this.qdrantCollectionService) {
        this.logger.warn('QdrantCollectionService not available - cannot store vectors');
        return { status: 'error', error: 'QdrantCollectionService not available' };
      }

      // Get the appropriate processor for this file type
      const processor = await this.documentProcessorFactory.getProcessor(fileType);
      
      // Process the document using the correct method signature
      const dataSourceIdNumber = parseInt(dataSourceId, 10);
      const organizationId = metadata.organizationId || 1; // Default org ID if not provided
      const userId = metadata.userId || 'system'; // Default user ID if not provided
      
      const processingResult = await processor.processFile(
        filePath,
        dataSourceIdNumber,
        organizationId,
        userId,
        metadata
      );

      this.logger.info(`Document processed successfully: ${processingResult.chunks || 0} chunks extracted`);

      // If processing was successful, the processor should have already stored the vectors
      // The processors handle their own vector storage, so we don't need to do it here
      
      return {
        status: processingResult.status === 'success' ? 'completed' : processingResult.status,
        result: {
          chunksProcessed: processingResult.chunks || 0,
          message: processingResult.message
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in direct document processing';
      this.logger.error(`Error in direct document processing for DataSource ID ${dataSourceId}: ${errorMessage}`, error);
      
      return {
        status: 'error',
        error: errorMessage
      };
    }
  }
} 