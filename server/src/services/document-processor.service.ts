import { createLogger } from '../utils/logger';
import * as winston from 'winston';
import { DocumentPipelineService } from './document-pipeline.service';
import { FileType } from '../types/file-types';
import fs from 'fs';
import path from 'path';
import { QdrantService } from './qdrant.service';
import crypto from 'crypto';

/**
 * Service for processing documents in various formats
 * This is a simplified implementation that delegates to DocumentPipelineService
 */
export class DocumentProcessorService {
  private logger: winston.Logger;
  private documentPipeline: DocumentPipelineService;
  private qdrantService: QdrantService;
  private static instance: DocumentProcessorService | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.logger = createLogger('DocumentProcessorService');
    this.logger.info('Initializing Document Processor Service');
    this.documentPipeline = DocumentPipelineService.getInstance();
    this.qdrantService = QdrantService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DocumentProcessorService {
    if (!DocumentProcessorService.instance) {
      DocumentProcessorService.instance = new DocumentProcessorService();
    }
    return DocumentProcessorService.instance;
  }

  /**
   * Process a document file
   */
  async processDocument(filePath: string, fileType: FileType, dataSourceId: string, metadata: any = {}): Promise<void> {
    this.logger.info(`Processing document: ${path.basename(filePath)}`);
    
    try {
      // Ensure file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      // Process document using the pipeline
      const result = await this.documentPipeline.processDocumentStream(filePath, fileType, dataSourceId, metadata);
      
      this.logger.info(`Document processing completed with status: ${result.status}`);
      if (result.status === 'error') {
        this.logger.error(`Error details: ${JSON.stringify(result.metadata)}`);
      }
    } catch (error) {
      // Type-guard for the error to access its properties safely
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred during document processing';
        
      this.logger.error(`Error processing document: ${errorMessage}`, { 
        error: error instanceof Error ? error : String(error) 
      });
      throw error;
    }
  }

  /**
   * Delete all vectors associated with a data source
   */
  async deleteDataSourceVectors(dataSourceId: string): Promise<boolean> {
    this.logger.info(`Deleting vectors for data source ${dataSourceId}`);
    
    try {
      console.log(`Processing document for data source: ${dataSourceId}`);
      
      // Create a collection name based on the data source ID - ensure numeric format
      const numericId = parseInt(dataSourceId, 10);
      // Use only numeric ID for collection name
      const collectionName = isNaN(numericId) ? `datasource_${dataSourceId}` : `datasource_${numericId}`;
      console.log(`Using collection name: ${collectionName}`);
      
      // Check if collection exists before attempting to delete
      const collectionExists = await this.qdrantService.collectionExists(collectionName);
      
      if (!collectionExists) {
        this.logger.warn(`Collection ${collectionName} does not exist. Nothing to delete.`);
        return true; // Return true since there's nothing to delete
      }
      
      // Delete the entire collection
      const deleted = await this.qdrantService.deleteCollection(collectionName);
      
      if (deleted) {
        this.logger.info(`Successfully deleted vectors for data source ${dataSourceId}`);
        return true;
      } else {
        this.logger.error(`Failed to delete vectors for data source ${dataSourceId}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error deleting vectors for data source ${dataSourceId}: ${error instanceof Error ? error.message : String(error)}`, {
        error: error instanceof Error ? error.stack : String(error)
      });
      return false;
    }
  }

  /**
   * Check if the document processor is ready for use
   */
  async isReady(): Promise<boolean> {
    return true; // Always return true for the mock implementation
  }

  /**
   * Get collection name for a data source
   */
  getCollectionName(dataSourceId: string): string {
    // Parse to number if possible
    const numericId = parseInt(dataSourceId, 10);
    
    // If it's a valid number, use it for the collection name
    if (!isNaN(numericId)) {
      this.logger.info(`Using numeric collection name: datasource_${numericId}`);
      return `datasource_${numericId}`;
    }
    
    // For UUIDs or other string IDs, create a deterministic number from the string
    // This is a fallback and should rarely be used since we prefer numeric IDs
    this.logger.warn(`Converting non-numeric ID to collection name: ${dataSourceId}`);
    
    // Use a hash function to generate a numeric ID from the string
    // This ensures we get a consistent numeric value for the same string
    const hash = crypto.createHash('md5').update(dataSourceId).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    
    this.logger.info(`Converted string ID to numeric collection: datasource_${numericHash}`);
    return `datasource_${numericHash}`;
  }
} 