import { createLogger } from '../../utils/logger';
import * as winston from 'winston';
import { QdrantService } from '../qdrant.service';
import { db } from '../../infrastructure/database';
import fs from 'fs';
import path from 'path';

// Define DataSourceStatus type since it's missing
export type DataSourceStatus = 'connected' | 'processing' | 'error' | 'disconnected' | 'failed' | 'ready' | 'completed';

/**
 * Result of document processing
 */
export interface ProcessingResult {
  status: 'success' | 'error' | 'partial_success' | 'processing';
  chunks: number;
  message?: string;
  metadata?: Record<string, any>;
  elements?: any[];
  rawElements?: any[];
}

/**
 * Base class for all document processors
 * Provides common functionality and defines the interface for document processors
 */
export abstract class BaseDocumentProcessor {
  protected logger: winston.Logger;
  protected qdrantService: QdrantService;
  public processorName: string;

  constructor(serviceName: string) {
    this.logger = createLogger(serviceName);
    this.qdrantService = QdrantService.getInstance();
    this.processorName = serviceName;
    this.logger.info(`Initializing ${serviceName}`);
  }

  /**
   * Process a file
   * This is the main method that all document processors must implement
   * 
   * @param filePath Path to the file to process
   * @param dataSourceId ID of the data source
   * @param metadata Additional metadata
   * @returns Processing result
   */
  abstract processFile(
    filePath: string,
    dataSourceId: string,
    metadata: Record<string, any>
  ): Promise<ProcessingResult>;

  /**
   * Ensure a Qdrant collection exists for the data source
   * @param collectionName Name of the collection
   */
  protected async ensureCollectionExists(collectionName: string): Promise<void> {
    try {
      const exists = await this.qdrantService.collectionExists(collectionName);
      
      if (!exists) {
        this.logger.info(`Creating collection: ${collectionName}`);
        await this.qdrantService.createCollection(collectionName, {
          vectors: {
            size: 1536, // OpenAI embeddings are 1536-dimensional
            distance: 'Cosine'
          }
        });
        this.logger.info(`Collection created: ${collectionName}`);
      } else {
        this.logger.debug(`Qdrant collection already exists: ${collectionName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure Qdrant collection exists: ${errorMessage}`, { collectionName });
      throw new Error(`Failed to ensure Qdrant collection exists: ${errorMessage}`);
    }
  }

  /**
   * Update the status of a data source
   * @param dataSourceId ID of the data source
   * @param status New status
   * @param metadata Additional metadata to update
   */
  protected async updateDataSourceStatus(
    dataSourceId: string,
    status: DataSourceStatus,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Check if dataSourceId is a UUID (contains a hyphen)
      let numericId = dataSourceId;
      let foundId = false;
      
      if (dataSourceId.includes('-')) {
        this.logger.debug(`Base processor was called with UUID: ${dataSourceId}. Attempting to find numeric ID.`);
        
        // Extract UUID if in format datasource_UUID
        let fileUuid = dataSourceId;
        if (dataSourceId.startsWith('datasource_')) {
          fileUuid = dataSourceId.substring('datasource_'.length);
        }
        
        // First, try to find the data source directly from the file_to_data_source mapping table
        try {
          const mapping = await db('file_to_data_source')
            .where('file_id', fileUuid)
            .first();
          
          if (mapping && mapping.data_source_id) {
            numericId = mapping.data_source_id;
            foundId = true;
            this.logger.info(`Found numeric ID ${numericId} for UUID ${fileUuid} in mapping table`);
          }
        } catch (mappingError) {
          this.logger.debug(`Error querying file_to_data_source table: ${mappingError.message}`);
        }
        
        // If not found in mapping table, check if there's a direct match in data_sources metadata
        if (!foundId) {
          try {
            const dataSources = await db('data_sources')
              .whereRaw("metadata->>'id' = ?", [fileUuid])
              .select('id');
            
            if (dataSources.length > 0) {
              numericId = dataSources[0].id.toString();
              foundId = true;
              this.logger.info(`Found numeric ID ${numericId} for UUID ${fileUuid} in metadata.id`);
            }
          } catch (metadataError) {
            this.logger.debug(`Error querying data_sources metadata: ${metadataError.message}`);
          }
        }
        
        // Only if we haven't found the ID yet, try the more aggressive searches
        if (!foundId) {
          // Try to find numeric ID by pattern matching
          try {
            const result = await db.raw(
              `SELECT id FROM data_sources WHERE 
               name LIKE ? OR 
               description LIKE ? OR
               metadata::text LIKE ?
               LIMIT 1`,
              [`%${fileUuid}%`, `%${fileUuid}%`, `%${fileUuid}%`]
            );
            
            if (result && result.rows && result.rows.length > 0) {
              numericId = result.rows[0].id;
              foundId = true;
              this.logger.info(`Base processor found data source with ID ${numericId} for UUID ${fileUuid}`);
            }
          } catch (error) {
            this.logger.debug(`Error finding data source by UUID in name/description: ${error.message}`);
          }
        }
        
        if (!foundId) {
          this.logger.warn(`No numeric ID found for UUID ${fileUuid} after multiple attempts - cannot update status`);
          return; // Don't proceed with update if we can't reliably identify the data source
        }
      }
      
      // If we found an ID or we already have a numeric ID, update it
      if (foundId || !dataSourceId.includes('-')) {
        const processingMetadata = { status, timestamp: new Date().toISOString() };
        
        try {
          // Main status update
          const updateResult = await db('data_sources')
            .where('id', numericId)
            .update({
              status: status,
              updated_at: new Date(),
              metadata: db.raw(`
                jsonb_set(
                COALESCE(metadata::jsonb, '{}'::jsonb),
                '{processingStatus}',
                ?::jsonb
                )
              `, [JSON.stringify(processingMetadata)])
            });
            
          // Log the result of the update
          if (updateResult) {
            this.logger.info(`Successfully updated data source ${numericId} status to ${status}`);
          } else {
            this.logger.warn(`No rows updated for data source ${numericId}`);
          }
          
          // Also update metrics
          if (Object.keys(metadata).length > 0) {
            await db('data_sources')
              .where('id', numericId)
              .update({
                metrics: db.raw(`
                  jsonb_set(
                  COALESCE(metrics::jsonb, '{}'::jsonb),
                  '{processing}',
                  ?::jsonb
                  )
                `, [JSON.stringify(metadata)])
              });
          }
        } catch (updateError: any) {
          this.logger.error(`Error updating data source ${numericId} status to ${status}: ${updateError.message}`);
          throw updateError;
        }
      } else {
        this.logger.warn(`Unable to determine numeric ID for data source ${dataSourceId}, status update skipped`);
      }
    } catch (error: any) {
      this.logger.error(`UpdateDataSourceStatus error: ${error.message}`, error);
    }
  }

  /**
   * Validate the file exists and is accessible
   * @param filePath Path to the file
   * @throws Error if the file doesn't exist
   */
  protected validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }
    
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }
  }
} 