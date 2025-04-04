import * as winston from 'winston';
import { QdrantService } from '../qdrant.service';
import { db } from '../../infrastructure/database';
import fs from 'fs';
import path from 'path';
import { EventManager } from '../../services/event-manager';

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
    // Initialize the logger first before using it
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const { timestamp, level, message, ...rest } = info;
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
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
              const formattedMessage = `${timestamp} [${level.toUpperCase()}] [${serviceName}]: ${message}`;
              return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
            })
          )
        })
      ]
    });
    
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
      // Normalize the collection name to use numeric ID
      const normalizedName = await this.normalizeCollectionNameWithNumericId(collectionName);
      this.logger.info(`Normalized collection name: ${collectionName} -> ${normalizedName}`);
      
      const exists = await this.qdrantService.collectionExists(normalizedName);
      
      if (!exists) {
        this.logger.info(`Creating collection: ${normalizedName}`);
        await this.qdrantService.createCollection(normalizedName, {
          vectors: {
            size: 1536, // OpenAI embeddings are 1536-dimensional
            distance: 'Cosine'
          }
        });
        this.logger.info(`Collection created: ${normalizedName}`);
      } else {
        this.logger.debug(`Qdrant collection already exists: ${normalizedName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure Qdrant collection exists: ${errorMessage}`, { collectionName });
      throw new Error(`Failed to ensure Qdrant collection exists: ${errorMessage}`);
    }
  }

  /**
   * Update the data source status in the database
   * @param dataSourceId ID of the data source
   * @param status New status
   * @param details Additional details to update
   */
  protected async updateDataSourceStatus(
    dataSourceId: string,
    status: DataSourceStatus,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      this.logger.info(`Updating data source ${dataSourceId} status to ${status}`);
      
      const updateObj: any = {
        status,
        updated_at: new Date()
      };
      
      // Include details in the metadata JSON
      const metadata = JSON.stringify({
        ...details,
        lastUpdated: new Date().toISOString(),
        status
      });
      
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          ...updateObj,
          metadata: db.raw(`jsonb_set(metadata, '{processing_details}', ?)`, [metadata])
        });
      
      // Emit event via event manager if available
      try {
        // Dynamically import EventManager to avoid circular dependencies
        const EventManager = require('../event-manager').EventManager;
        if (EventManager && typeof EventManager.getInstance === 'function') {
          const eventManager = EventManager.getInstance();
          if (eventManager) {
            this.logger.info(`Emitting dataSourceUpdate event for ${dataSourceId}`);
            // Create event data object with all needed properties
            const eventData = {
              id: dataSourceId,
              status,
              timestamp: new Date().toISOString(),
              // Include progress information for UI updates
              progress: details.progress,
              message: details.message,
              stage: details.stage,
              processedChunks: details.processedChunks,
              totalChunks: details.totalChunks
            };
            
            eventManager.emit('dataSourceUpdate', eventData);
          }
        }
      } catch (emitError) {
        this.logger.error(`Error emitting data source update event: ${emitError instanceof Error ? emitError.message : String(emitError)}`);
      }
      
      this.logger.info(`Successfully updated data source ${dataSourceId} status`);
    } catch (error) {
      this.logger.error(
        `Error updating data source ${dataSourceId} status: ${error instanceof Error ? error.message : String(error)}`
      );
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

  /**
   * Normalize collection name to always use numeric ID
   * This is critical for ensuring collections are consistently named across the system
   * @param dataSourceId The data source ID (can be UUID or numeric ID)
   * @returns Normalized collection name using numeric ID
   */
  protected async normalizeCollectionNameWithNumericId(dataSourceId: string): Promise<string> {
    try {
      // If it's already a number, just use it
      if (!isNaN(Number(dataSourceId)) && !dataSourceId.includes('-')) {
        this.logger.debug(`Using numeric ID format for collection: datasource_${dataSourceId}`);
        return `datasource_${dataSourceId}`;
      }
      
      // If it's a UUID, we need to find the numeric ID
      if (dataSourceId.includes('-')) {
        // Strip prefix if present
        const uuid = dataSourceId.startsWith('datasource_') 
          ? dataSourceId.substring('datasource_'.length) 
          : dataSourceId;
        
        try {
          // Look up by UUID in metadata
          const dataSource = await db('data_sources')
            .whereRaw("metadata->>'id' = ?", [uuid])
            .orWhereRaw("metadata->>'filename' LIKE ?", [`%${uuid}%`])
            .orWhereRaw("metadata->>'originalFilename' LIKE ?", [`%${uuid}%`])
            .first('id');
          
          if (dataSource && dataSource.id) {
            this.logger.info(`Found numeric ID ${dataSource.id} for UUID ${uuid}`);
            return `datasource_${dataSource.id}`;
          }
          
          // If that fails, try looking up in the metadata JSON
          const metadataSource = await db('data_sources')
            .whereRaw("metadata->>'id' = ?", [uuid])
            .first('id');
          
          if (metadataSource && metadataSource.id) {
            this.logger.info(`Found numeric ID ${metadataSource.id} for UUID ${uuid} in metadata`);
            return `datasource_${metadataSource.id}`;
          }
        } catch (dbError) {
          this.logger.error(`Database error looking up UUID ${uuid}: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }
        
        // If we couldn't find a numeric ID, use the UUID as fallback
        this.logger.warn(`Could not find numeric ID for UUID ${uuid}, using UUID as fallback`);
        return `datasource_${uuid}`;
      }
      
      // If it already has prefix, assume it's correct
      if (dataSourceId.startsWith('datasource_')) {
        return dataSourceId;
      }
      
      // Default fallback
      return `datasource_${dataSourceId}`;
    } catch (error) {
      this.logger.error(`Error normalizing collection name: ${error instanceof Error ? error.message : String(error)}`);
      return `datasource_${dataSourceId}`;
    }
  }
}