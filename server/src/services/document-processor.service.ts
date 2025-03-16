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
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentProcessorService]: ${message}`;
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
              const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DocumentProcessorService]: ${message}`;
              return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
            })
          )
        })
      ]
    });
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
      console.log(`Processing vector deletion for data source: ${dataSourceId}`);
      
      // Create a collection name based on the data source ID
      const numericId = parseInt(dataSourceId, 10);
      
      // Define all possible collection name formats
      const possibleCollectionNames = [
        // Standard format
        isNaN(numericId) ? `datasource_${dataSourceId}` : `datasource_${numericId}`,
        
        // Snowflake formats
        `snowflake_${dataSourceId}`,
        `snowflake_${dataSourceId}_diana_sales_es_sales`,
        
        // Additional prefixed format
        `datasource_snowflake_${dataSourceId}`,
        `datasource_snowflake_${dataSourceId}_diana_sales_es_sales`
      ];

      // Define data source type patterns to match
      const dataSourceTypePatterns = [
        'snowflake',
        'mysql',
        '***REMOVED***',
        'mongodb',
        'bigquery',
        'redshift',
        'dynamodb',
        'oracle',
        'sqlserver',
        'elasticsearch',
        'mariadb'
      ];
      
      console.log(`Checking for collections: ${possibleCollectionNames.join(', ')}`);
      
      // Get list of all collections
      const allCollections = await this.qdrantService.listCollections();
      
      // Filter to collections that match any of our patterns or contain the data source ID
      const matchingCollections = allCollections.filter(name => {
        // Check against our predefined patterns
        if (possibleCollectionNames.includes(name)) {
          return true;
        }
        
        // Check if collection name contains the data source ID
        if (name.includes(dataSourceId)) {
          console.log(`Found potential match with pattern: ${name}`);
          return true;
        }

        // Check for type-specific patterns with the data source ID
        for (const typePattern of dataSourceTypePatterns) {
          const combinedPattern = `${typePattern}_${dataSourceId}`;
          if (name.includes(combinedPattern)) {
            console.log(`Found ${typePattern} specific match: ${name}`);
            return true;
          }
        }
        
        return false;
      });
      
      if (matchingCollections.length === 0) {
        this.logger.info(`No collections found for data source ${dataSourceId}. Nothing to delete.`);
        return true; // Return true since there's nothing to delete
      }
      
      console.log(`Found ${matchingCollections.length} collections to delete: ${matchingCollections.join(', ')}`);
      
      // Track deletion success
      let allSuccessful = true;
      
      // Delete each matching collection
      for (const collectionName of matchingCollections) {
        try {
          console.log(`Attempting to delete collection: ${collectionName}`);
          const deleted = await this.qdrantService.deleteCollection(collectionName);
          
          if (deleted) {
            this.logger.info(`Successfully deleted collection: ${collectionName}`);
          } else {
            this.logger.error(`Failed to delete collection: ${collectionName}`);
            allSuccessful = false;
          }
        } catch (collectionError) {
          this.logger.error(`Error deleting collection ${collectionName}: ${collectionError instanceof Error ? collectionError.message : String(collectionError)}`);
          allSuccessful = false;
        }
      }
      
      if (allSuccessful) {
        this.logger.info(`Successfully deleted all collections for data source ${dataSourceId}`);
        return true;
      } else {
        this.logger.warn(`Some collections for data source ${dataSourceId} could not be deleted`);
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