import * as winston from 'winston';
import { FileType } from '../types/file-types';
import { db } from '../infrastructure/database';
import fs from 'fs';
import path from 'path';
import { QdrantService } from './qdrant.service';
import { DocumentProcessorFactory } from './document-processors/document-processor-factory';
import { ProcessingResult } from './document-processors/base-document-processor';
import { OpenAIService } from './openai.service';
import { ChunkingService } from './chunking.service';

/**
 * Service for processing documents through the pipeline
 */
export class DocumentPipelineService {
  private logger: winston.Logger;
  private processorFactory: DocumentProcessorFactory;
  private qdrantService: QdrantService;
  private openAIService: OpenAIService;
  private chunkingService: ChunkingService;
  private static instance: DocumentPipelineService | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
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
    this.processorFactory = DocumentProcessorFactory.getInstance();
    this.qdrantService = QdrantService.getInstance();
    this.openAIService = OpenAIService.getInstance();
    this.chunkingService = ChunkingService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DocumentPipelineService {
    if (!DocumentPipelineService.instance) {
      DocumentPipelineService.instance = new DocumentPipelineService();
    }
    return DocumentPipelineService.instance;
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
      this.logger.error(`Error updating data source status: ${error instanceof Error ? error.message : String(error)}`, { 
        error: error instanceof Error ? error : String(error) 
      });
    }
  }

  /**
   * Process a document stream
   * @param filePath Path to the stored file
   * @param fileType Type of the file
   * @param collectionId Collection ID to store the vectors in
   * @param metadata Additional metadata
   * @returns Processing result object
   */
  async processDocumentStream(
    filePath: string,
    fileType: FileType,
    collectionId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    try {
      this.logger.info(`Processing document with pipeline service: ${fileType} file`, {
        filePath,
        fileType,
        collectionId,
        metadata: JSON.stringify(metadata)
      });

      // Get the appropriate document processor for this file type
      const processor = this.processorFactory.getProcessorByFileType(fileType);
      
      if (!processor) {
        throw new Error(`No processor available for file type: ${fileType}`);
      }
      
      this.logger.info(`Using processor: ${processor.processorName} for file type: ${fileType}`);
      
      // Process the file
      return await processor.processFile(filePath, collectionId, metadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in document processing pipeline';
      this.logger.error('Error in document processing pipeline:', error);
      
      return {
        status: 'error',
        chunks: 0,
        message: errorMessage,
        metadata: {
          error: errorMessage,
          failedAt: new Date().toISOString()
        }
      };
    }
  }
} 