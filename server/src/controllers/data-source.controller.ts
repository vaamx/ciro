import { Request, Response } from 'express-serve-static-core';
import { db } from '../infrastructure/database/knex';
import { BadRequestError } from '../utils/errors';
import { DocumentProcessorService } from '../services/document-processor.service';
import { AuthRequest } from '../middleware/auth';
import { FileType } from '../types/file-types';
import { detectFileType } from '../utils/file-utils';
import { FileService } from '../services/file.service';
import { DocumentPipelineService } from '../services/document-pipeline.service';
import { DataSourceService } from '../services/data-source.service';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';
import { QdrantService } from '../services/qdrant.service';
import { DocumentProcessorFactory } from '../services/document-processors/document-processor-factory';
import * as winston from 'winston';
import { SnowflakeService } from '../services/snowflake.service';
import { RagService } from '../services/rag.service';
import { Response as CustomResponse } from '../types/express-types';

// Add this type augmentation to include 'excel' as a valid FileType
declare module '../types/file-types' {
  interface FileTypeExtensions {
    excel: 'excel';
  }
}

/**
 * Checks if a file is a PDF by examining its header
 * @param buffer The file buffer to check
 * @returns True if the file is a PDF, false otherwise
 */
function isPdfFile(buffer: Buffer) {
  // Check for PDF signature (%PDF-)
  if (!buffer || buffer.length < 5) return false;
  
  // Check for PDF signature
  return buffer[0] === 0x25 && // %
         buffer[1] === 0x50 && // P
         buffer[2] === 0x44 && // D
         buffer[3] === 0x46 && // F
         buffer[4] === 0x2D;   // -
}

export class DataSourceController {
  private documentProcessor: DocumentProcessorService;
  private documentPipeline: DocumentPipelineService;
  private dataSourceService: DataSourceService;
  private qdrantService: QdrantService;
  private snowflakeService: SnowflakeService;
  private logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DataSourceController]: ${message}`;
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
            const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DataSourceController]: ${message}`;
            return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
          })
        )
      })
    ]
  });
  private db: any;

  constructor() {
    this.documentProcessor = DocumentProcessorService.getInstance();
    this.documentPipeline = DocumentPipelineService.getInstance();
    this.dataSourceService = DataSourceService.getInstance();
    this.qdrantService = QdrantService.getInstance();
    this.snowflakeService = SnowflakeService.getInstance();
    this.db = db;
  }

  /**
   * Helper method to normalize collection names
   * @param dataSourceId The data source ID to normalize
   * @returns The normalized collection name
   */
  private normalizeCollectionName(dataSourceId: string): string {
    try {
      // Parse to number if possible
      const numericId = parseInt(dataSourceId, 10);
      
      // Always use numeric IDs for collection names when possible
      if (!isNaN(numericId)) {
        return `datasource_${numericId}`;
      }
      
      // Fallback to the original ID if not numeric (legacy support)
      return `datasource_${dataSourceId}`;
    } catch (error) {
      this.logger.error(`Error normalizing collection name: ${error}`);
      // Default fallback
      return `datasource_${dataSourceId}`;
    }
  }

  /**
   * Helper method to ensure document processor is initialized
   * @returns DocumentProcessorService instance
   */
  private getDocumentProcessor(): DocumentProcessorService {
    if (!this.documentProcessor) {
      console.log('DocumentProcessor was not initialized, creating a new instance');
      this.documentProcessor = DocumentProcessorService.getInstance();
    }
    return this.documentProcessor;
  }

  async getDataSources(req: Request, res: Response) {
    const { organization_id } = req.query;

    if (!organization_id) {
      throw new BadRequestError('Organization ID is required');
    }

    try {
      const dataSources = await this.db('data_sources')
        .where({ organization_id })
        .select('*');

      res.json(dataSources);
    } catch (error) {
      console.error('Error fetching data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  }

  // Add a utility method to ensure created_by is a numeric value
  private ensureNumericCreatedBy(data: any): number {
    // Default value if nothing else works
    let numericUserId = 1;

    try {
      // If already a number, use it
      if (typeof data.created_by === 'number') {
        return data.created_by;
      }

      // If it's a string that can be directly converted to a number
      if (typeof data.created_by === 'string' && !isNaN(Number(data.created_by))) {
        return Number(data.created_by);
      }

      // If it's a UUID string, convert it
      if (typeof data.created_by === 'string' && data.created_by.includes('-')) {
        const userId = data.created_by;
        const uuidDigits = userId.replace(/-/g, '');
        numericUserId = parseInt(uuidDigits.substring(0, 8), 16) % 1000000;
        // Ensure it's positive and not too large
        numericUserId = Math.abs(numericUserId) || 1;
        console.log(`Converted UUID ${userId} to numeric ID: ${numericUserId}`);
        return numericUserId;
      }

      // Extract userId from the request if available
      if (data.userId) {
        const userId = data.userId;
        if (typeof userId === 'string' && userId.includes('-')) {
          const uuidDigits = userId.replace(/-/g, '');
          numericUserId = parseInt(uuidDigits.substring(0, 8), 16) % 1000000;
          // Ensure it's positive and not too large
          numericUserId = Math.abs(numericUserId) || 1;
          console.log(`Converted UUID ${userId} to numeric ID: ${numericUserId}`);
          return numericUserId;
        }
      }
    } catch (error) {
      console.warn('Failed to convert to numeric ID, using default:', error);
    }

    return numericUserId;
  }

  async createDataSource(req: AuthRequest, res: Response) {
    try {
        const { 
            organization_id, 
            name, 
            type, 
            status, 
            description,
            metadata, 
            metrics, 
            data, 
            file_id: fileId,
            created_by: providedCreatedBy  // Capture any provided created_by value
        } = req.body;
        
        const userId = req.user?.id || req.body.userId || 'system';

        if (!organization_id || !name || !type) {
            throw new BadRequestError('Organization ID, name, and type are required');
        }
        
        // CRITICAL: Ensure created_by is never a UUID string
        let created_by = 1; // Default fallback
        
        // First try using the pre-converted value if available
        if (providedCreatedBy && !isNaN(Number(providedCreatedBy))) {
            created_by = Number(providedCreatedBy);
        } 
        // Otherwise convert from userId
        else if (userId) {
            // Convert userId to numeric format for database compatibility
            created_by = this.ensureNumericCreatedBy({
                created_by: providedCreatedBy,
                userId
            });
        }
        
        this.logger.info(`Creating data source with data: ${JSON.stringify({
            organization_id,
            name,
            type,
            status
        })}`);
        
        // Check if a data source with the same name already exists
        const existingDataSource = await this.db('data_sources')
            .where({ 
                organization_id, 
                name 
            })
            .first();

        if (existingDataSource) {
            console.log(`Data source with name "${name}" already exists with ID ${existingDataSource.id}`);
            return res.status(409).json({ 
                error: 'Data source with this name already exists',
                existingId: existingDataSource.id.toString()
            });
        }

        // If metadata contains a file ID, check if a data source already exists for this file
        if (metadata && metadata.id) {
            const fileId = metadata.id;
            const fileType = metadata.fileType || metadata.type;
            this.logger.info(`Checking for existing data source for file ID: ${fileId} (type: ${fileType})`);
            
            // Check for data source with this file ID in metadata AND matching file type
            const existingByFileId = await this.db('data_sources')
                .whereRaw("metadata->>'id' = ?", [fileId])
                .andWhere(builder => {
                    // Only consider it a match if file types match
                    builder.whereRaw("metadata->>'fileType' = ?", [fileType])
                        .orWhereRaw("metadata->>'type' = ?", [fileType]);
                })
                .first();
                
            if (existingByFileId) {
                this.logger.info(`Found existing data source ${existingByFileId.id} for file ID ${fileId} with matching type ${fileType}, returning it instead`);
                return res.status(200).json({
                    ...existingByFileId,
                    id: existingByFileId.id.toString()
                });
            }
            
            // For file_to_data_source mapping, we need to check the file type as well
            // to avoid mixing different file types with the same ID
            const mapping = await this.db('file_to_data_source')
                .where({ file_id: fileId })
                .first();
                
            if (mapping) {
                const mappedDataSource = await this.db('data_sources')
                    .where({ id: mapping.data_source_id })
                    .first();
                    
                if (mappedDataSource) {
                    // Verify file type matches to avoid mixing different file types
                    const mappedFileType = mappedDataSource.metadata?.fileType || mappedDataSource.metadata?.type;
                    
                    if (mappedFileType === fileType) {
                        this.logger.info(`Found existing data source ${mappedDataSource.id} from mapping for file ID ${fileId} with matching type ${fileType}`);
                        return res.status(200).json({
                            ...mappedDataSource,
                            id: mappedDataSource.id.toString()
                        });
                    } else {
                        this.logger.info(`Found data source ${mappedDataSource.id} from mapping for file ID ${fileId} but type mismatch: ${mappedFileType} vs ${fileType}, creating new data source`);
                    }
                }
            }
        }
        
        // Use a transaction to ensure atomicity
        const createdDataSource = await this.db.transaction(async (trx) => {
            // Ensure created_by is always a numeric value
            const numericUserId = this.ensureNumericCreatedBy({
                created_by: providedCreatedBy,
                userId
            });
            
            const [created] = await trx('data_sources')
                .insert({
                    organization_id,
                    name,
                    type,
                    status: status || 'connected',
                    description,
                    metadata: metadata || {},
                    metrics: metrics || {},
                    data: data || {},
                    created_by: created_by, // Use our pre-sanitized value
                    last_sync: new Date().toISOString(),
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returning('*');

            console.log('Data source created in database:', created);

            // Verify the data source exists within the same transaction
            const verifyDataSource = await trx('data_sources')
                .where({ id: created.id })
                .first();
            
            if (!verifyDataSource) {
                throw new Error('Data source creation failed - verification failed');
            }
            
            console.log('Verified data source exists:', verifyDataSource);
            return created;
        });

        // Double check the data source exists after transaction
        const finalVerification = await this.db('data_sources')
            .where({ id: createdDataSource.id })
            .first();

        if (!finalVerification) {
            throw new Error('Data source not found after creation');
        }

        console.log('Final verification successful:', finalVerification);

        // Transform response to ensure consistent type handling
        const response = {
            ...createdDataSource,
            id: createdDataSource.id.toString(), // Always return ID as string to frontend
            metrics: {
                records: createdDataSource.metrics?.records || 0,
                syncRate: createdDataSource.metrics?.syncRate || 0,
                avgSyncTime: createdDataSource.metrics?.avgSyncTime || '0s',
                lastError: createdDataSource.metrics?.lastError
            }
        };

        console.log('Sending response with transformed ID:', response);
        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating data source (DETAILED):', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.detail) console.error('Error detail:', error.detail);
        if (error.stack) console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to create data source' });
    }
  }

  async updateDataSource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      this.logger.info(`Updating data source with ID: ${id}`, { updateFields: Object.keys(updateData) });
      
      // Get the original data source before the update to check for status changes
      const originalDataSource = await this.db('data_sources')
        .where({ id })
        .first();
        
      if (!originalDataSource) {
        return res.status(404).json({ message: `Data source with ID ${id} not found` });
      }
      
      // Update the data source
      await this.db('data_sources')
        .where({ id })
        .update({
          ...updateData,
          updated_at: new Date()
        });
      
      // Get the updated data source
      const dataSource = await this.db('data_sources')
        .where({ id })
        .first();
      
      if (!dataSource) {
        return res.status(404).json({ message: `Data source with ID ${id} not found after update` });
      }
      
      // Check if the status has changed
      const statusChanged = originalDataSource.status !== dataSource.status;
      this.logger.info(`Status change detected: ${statusChanged ? 'Yes' : 'No'}`, {
        originalStatus: originalDataSource.status,
        newStatus: dataSource.status
      });
      
      // If the status has changed, broadcast the update via WebSocket
      if (statusChanged) {
        try {
          // Get WebSocket service
          const WebSocketService = require('../services/websocket.service').WebSocketService;
          const webSocketService = new WebSocketService();
          
          // Format the data source for the WebSocket message
          const formattedDataSource = {
            id: String(dataSource.id), // Ensure ID is a string
            name: dataSource.name,
            type: dataSource.type,
            status: dataSource.status,
            lastSync: dataSource.last_sync || new Date().toISOString(),
            description: dataSource.description || '',
            metrics: dataSource.metrics || {
              records: 0,
              syncRate: 0,
              avgSyncTime: '0s'
            },
            metadata: dataSource.metadata || {}
          };
          
          // Broadcast the update
          webSocketService.broadcastDataSourceUpdate(
            dataSource.id,
            dataSource.status,
            formattedDataSource
          );
          
          this.logger.info(`WebSocket broadcast sent for data source status change to ${dataSource.status}`);
        } catch (wsError) {
          this.logger.error(`Error broadcasting WebSocket update: ${wsError instanceof Error ? wsError.message : String(wsError)}`);
          // Don't fail the API request if WebSocket broadcast fails
        }
      }
      
      // Transform response to ensure consistent type handling
      const response = {
        ...dataSource,
        id: String(dataSource.id), // Ensure ID is always returned as a string
        metrics: dataSource.metrics || {
          records: 0,
          syncRate: 0,
          avgSyncTime: '0s'
        }
      };
      
      return res.json(response);
    } catch (error) {
      this.logger.error(`Error updating data source: ${error instanceof Error ? error.message : String(error)}`);
      return res.status(500).json({
        message: 'Error updating data source',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async deleteDataSource(req: AuthRequest, res: Response | CustomResponse) {
    const { id } = req.params;

    try {
      // Convert string ID to number since our DB uses integer
      const numericId = parseInt(id, 10);
      
      if (isNaN(numericId)) {
        console.error('Invalid ID format:', id);
        return res.status(400).json({ 
          error: 'Invalid ID format',
          details: 'ID must be a valid number',
          requestedId: id
        });
      }

      console.log(`Processing delete request for data source ID: ${id} (numeric: ${numericId})`);

      // Start a transaction to ensure both operations succeed or fail together
      await this.db.transaction(async (trx) => {
        // First check if the data source exists
        const dataSource = await trx('data_sources')
          .where({ id: numericId })
          .first();

        if (!dataSource) {
          throw new BadRequestError('Data source not found');
        }

        console.log(`Found data source to delete: ${dataSource.name} (ID: ${dataSource.id}, Status: ${dataSource.status})`);

        // Special handling for data sources that are currently processing
        if (dataSource.status === 'processing' || dataSource.status === 'syncing') {
          console.log(`Data source ${id} is currently in '${dataSource.status}' state. Performing extra cleanup.`);
          
          // Check for related processing jobs and cancel them
          try {
            // We'll just log for now since we don't have direct access to job processing
            console.log(`Marked for cleanup: Any background jobs for data source ${id}`);
            
            // Update status to 'cancelling' before deletion
            await trx('data_sources')
              .where({ id: numericId })
              .update({
                status: 'cancelling',
                updated_at: new Date()
              });
              
            console.log(`Updated data source ${id} status to 'cancelling' before deletion`);
          } catch (cleanupError) {
            console.warn(`Error during cleanup for processing data source ${id}:`, cleanupError);
          }
        }

        // Delete vectors first
        try {
          // Get document processor using our helper method
          const documentProcessor = this.getDocumentProcessor();
          
          // Check if this is a special data source type that might use custom collection names
          const isSnowflake = dataSource.type === 'snowflake' || 
                             dataSource.config?.type === 'snowflake' || 
                             JSON.stringify(dataSource).toLowerCase().includes('snowflake');
          
          if (isSnowflake) {
            console.log(`Data source ${id} is a Snowflake data source. Will check for special collection formats.`);
          }
          
          console.log(`Attempting to delete vectors for data source ${id}`);
          const vectorDeletionResult = await documentProcessor.deleteDataSourceVectors(numericId.toString());
          console.log(`Vector deletion result for data source ${id}: ${vectorDeletionResult ? 'Success' : 'Failed'}`);
        } catch (error) {
          console.warn('Error deleting vectors, continuing with data source deletion:', error);
        }

        // Then delete the data source using numeric ID
        const deleted = await trx('data_sources')
          .where({ id: numericId })
          .delete();

        if (!deleted) {
          throw new BadRequestError('Failed to delete data source');
        }
        
        console.log(`Successfully deleted data source with ID: ${id}`);
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting data source:', error);
      if (error instanceof BadRequestError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ 
          error: 'Failed to delete data source',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  async testConnection(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const dataSource = await this.db('data_sources')
        .where({ id })
        .first();

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      // TODO: Implement actual connection testing logic based on data source type
      res.json({ success: true });
    } catch (error) {
      console.error('Error testing data source connection:', error);
      res.status(500).json({ error: 'Failed to test data source connection' });
    }
  }

  /**
   * Process content from a file for a data source
   * 
   * This API supports two modes:
   * 1. POST to /data-sources/:id/content - Traditional endpoint with ID in URL path
   * 2. POST to /data-sources/process - Enhanced endpoint with ID in request body
   * 
   * Request body parameters:
   * - id: Data source ID (required for enhanced endpoint)
   * - processingMethod: String specifying the processing method (optional)
   *   - 'auto': Auto-detect processor based on file extension (default)
   *   - 'pdf': Use PDF processor
   *   - 'docx': Use DOCX processor
   *   - 'xlsx': Use Excel processor
   *   - 'csv': Use CSV processor
   * 
   * Response:
   * - success: Boolean indicating if processing was successful
   * - message: Processing result message
   * - chunks: Number of chunks processed
   */
  async processContent(req: AuthRequest, res: Response) {
    try {
      // Support both URL parameter ID and body ID
      const dataSourceId = req.params.id || req.body.id;
      const processingMethod = req.body.processingMethod;
      
      this.logger.info('Processing content request received', {
        dataSourceId: dataSourceId,
        processingMethod: processingMethod || 'auto',
        requestType: req.params.id ? 'path-based' : 'body-based',
        userId: req.user?.id || 'unknown'
      });

      if (!dataSourceId) {
        this.logger.error('Missing data source ID in process content request');
        return res.status(400).json({ error: 'Missing data source ID' });
      }
      
      // If no processing method is specified, default to auto
      const method = processingMethod || 'auto';
      this.logger.info(`Using processing method: ${method}`);

      const dataSource = await this.dataSourceService.getById(dataSourceId);
      if (!dataSource) {
        this.logger.error(`Data source not found with ID: ${dataSourceId}`);
        return res.status(404).json({ error: 'Data source not found' });
      }
      
      // Get the file path from data source metadata
      const filePath = dataSource.metadata?.filePath;
      if (!filePath) {
        this.logger.error(`No file path found in data source metadata for ID: ${dataSourceId}`);
        return res.status(400).json({ error: 'No file path found in data source metadata' });
      }
      
      // Get the document processor factory
      const processorFactory = new DocumentProcessorFactory();
      this.logger.info(`Retrieving processor for method: ${method}`);
      
      try {
        // Get processor for the specified method
        let processor;
        
        if (method === 'auto') {
          // For auto method, we'll select processor based on file extension
          this.logger.info(`Auto processing detected, selecting processor based on file path: ${filePath}`);
          processor = processorFactory.getProcessorByPath(filePath);
          
          if (!processor) {
            this.logger.error(`No suitable processor found for file: ${filePath} using auto detection`);
            
            // Try to determine the file extension
            const fileExt = path.extname(filePath).toLowerCase();
            this.logger.info(`File extension detected: ${fileExt}`);
            
            return res.status(400).json({ 
              error: 'Unsupported file type', 
              details: `Could not find a processor for file type: ${fileExt || 'unknown'}` 
            });
          }
          
          this.logger.info(`Successfully selected processor using auto detection for file: ${filePath}`);
        } else {
          // For specific method, get the processor directly
          this.logger.info(`Using explicitly specified processing method: ${method}`);
          processor = processorFactory.getProcessorByFileType(method);
        }
        
        if (!processor) {
          this.logger.error(`No processor found for processing method: ${method}`);
          return res.status(400).json({ 
            error: 'Unsupported processing method', 
            details: `Could not find a processor for method: ${method}` 
          });
        }
        
        // Log collection name that will be used
        const normalizedCollectionName = this.normalizeCollectionName(dataSourceId.toString());
        this.logger.info(`Will use normalized collection name: ${normalizedCollectionName}`);
        
        // Process the file
        this.logger.info(`Starting file processing with processor for method ${method}...`);
        
        // Create metadata with source info
        const metadata = {
          dataSourceId: dataSourceId,
          dataSourceName: dataSource.name || 'Unnamed data source',
          fileType: path.extname(filePath).toLowerCase().substring(1) || 'unknown',
          userId: req.user?.id
        };
        
        this.logger.info(`Processing file: ${filePath} with metadata:`, metadata);
        
        // Process the file and get the result
        const result = await processor.processFile(filePath, dataSourceId.toString(), metadata);
        this.logger.info(`File processing result:`, {
          status: result.status,
          chunks: result.chunks,
          message: result.message
        });
        
        // Update the data source status
        await this.dataSourceService.updateStatus(dataSourceId, {
          status: result.status === 'success' ? 'ready' : 'error',
          lastProcessed: new Date().toISOString(),
          error: result.status === 'error' ? result.message : undefined,
          chunks: result.chunks
        });
        
        return res.json({
          success: result.status === 'success',
          message: result.message,
          chunks: result.chunks
        });
      } catch (error) {
        this.logger.error(`Error processing content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Update the data source status to show error
        await this.dataSourceService.updateStatus(dataSourceId, {
          status: 'error',
          lastProcessed: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown processing error'
        });
        
        return res.status(500).json({ 
          error: 'Content processing failed', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    } catch (error) {
      this.logger.error(`Error in processContent controller: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return res.status(500).json({ 
        error: 'Content processing request failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  async syncData(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { content, metadata } = req.body;
    const fileType = req.body.fileType as FileType || 'text';
    const file = req.file;

    try {
      this.logger.info(`Syncing data for data source: ${id}`);
      
      // First, clear existing vectors for this data source
      const documentProcessor = this.getDocumentProcessor();
      await documentProcessor.deleteDataSourceVectors(id);

      // Get the data source to check its metadata
      const dataSource = await this.db('data_sources').where({ id }).first();
      if (!dataSource) {
        throw new Error(`Data source with ID ${id} not found`);
      }

      // Use our new pipeline for processing
      let result;
      
      if (file) {
        // Store file to disk
        const fileService = new FileService();
        const storedFilePath = await fileService.storeFile(file, `sync_${id}_${Date.now()}`);
        
        // Detect file type with enhanced detection
        let detectedFileType = detectFileType(file.mimetype, file.originalname);
        
        // Special handling for Excel files
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls', '.ods'].includes(fileExtension)) {
          detectedFileType = 'excel' as FileType;
          this.logger.info(`Detected Excel file based on extension: ${fileExtension}`);
        }
        
        this.logger.info(`Detected file type: ${detectedFileType} for file: ${file.originalname}`);
        
        // Process the file with streaming pipeline
        result = await this.documentPipeline.processDocumentStream(
          storedFilePath,
          detectedFileType,
          id,
          {
            ...metadata,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedBy: req.user!.id,
            uploadedAt: new Date().toISOString(),
            filePath: storedFilePath // Include file path in metadata
          }
        );
      } 
      // Process content if no files
      else if (content) {
        // Store content to disk
        const fileService = new FileService();
        const contentBuffer = typeof content === 'string' ? 
          Buffer.from(content) : 
          Buffer.from(JSON.stringify(content));
        
        const storedFilePath = await fileService.storeBuffer(contentBuffer, `sync_${id}_${Date.now()}`);
        
        // Process the content with streaming pipeline
        result = await this.documentPipeline.processDocumentStream(
          storedFilePath,
          fileType,
          id,
          {
            ...metadata,
            uploadedBy: req.user!.id,
            uploadedAt: new Date().toISOString(),
            filePath: storedFilePath // Include file path in metadata
          }
        );
      } 
      // If no file or content is provided, try to use the file path from the data source metadata
      else if (dataSource.metadata && dataSource.metadata.filePath) {
        const filePath = dataSource.metadata.filePath;
        this.logger.info(`Using file path from data source metadata: ${filePath}`);
        
        // Verify the file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found at path: ${filePath}`);
        }
        
        // Detect file type from the file path
        const fileExtension = path.extname(filePath).toLowerCase();
        let detectedFileType: FileType = 'text';
        
        if (fileExtension === '.csv') {
          detectedFileType = 'csv';
        } else if (['.xlsx', '.xls', '.ods'].includes(fileExtension)) {
          detectedFileType = 'excel' as FileType;
        } else if (fileExtension === '.pdf') {
          detectedFileType = 'pdf';
        } else if (fileExtension === '.json') {
          detectedFileType = 'json';
        }
        
        this.logger.info(`Detected file type from path: ${detectedFileType}`);
        
        // Process the file with streaming pipeline
        result = await this.documentPipeline.processDocumentStream(
          filePath,
          detectedFileType,
          id,
          {
            ...metadata,
            ...dataSource.metadata, // Include existing metadata
            reprocessedAt: new Date().toISOString()
          }
        );
      } else {
        throw new Error('Either file, content, or a valid file path in data source metadata is required');
      }

      // Update data source sync timestamp and status
      await this.db('data_sources')
        .where({ id })
        .update({
          last_sync: new Date(),
          updated_at: new Date(),
          status: result.status === 'success' ? 'connected' : 'error'
        });

      res.json({
        message: 'Data source synced successfully',
        totalChunks: result.chunks,
        status: result.status,
        details: result.message
      });
    } catch (error: unknown) {
      this.logger.error('Error syncing data source:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Update data source with error status
      try {
        await this.db('data_sources')
          .where({ id })
          .update({
            status: 'error',
            updated_at: new Date(),
            metrics: this.db.raw(`jsonb_set(
              COALESCE(metrics::jsonb, '{}'::jsonb),
              '{lastError}',
              ?::jsonb
            )`, [JSON.stringify({
              message: errorMessage,
              timestamp: new Date().toISOString()
            })])
          });
      } catch (updateError) {
        this.logger.error('Error updating data source status:', updateError);
      }
      
      res.status(500).json({ 
        error: `Failed to sync data source: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }

  async getDataSource(req: Request, res: Response | CustomResponse) {
    const { id } = req.params;
    
    try {
      console.log('Fetching data source with ID:', id);
      
      // Convert string ID to number since our DB uses integer
      const numericId = parseInt(id, 10);
      
      if (isNaN(numericId)) {
        console.error('Invalid ID format:', id);
        return res.status(400).json({ 
          error: 'Invalid ID format',
          details: 'ID must be a valid number',
          requestedId: id
        });
      }

      const dataSource = await this.db('data_sources')
        .where({ id: numericId })
        .first();

      if (!dataSource) {
        console.log('Data source not found:', { numericId, originalId: id });
        return res.status(404).json({ 
          error: 'Data source not found',
          requestedId: id
        });
      }

      // Transform response to ensure consistent format
      const response = {
        ...dataSource,
        id: dataSource.id.toString(), // Convert ID to string for frontend
        organization_id: dataSource.organization_id,
        name: dataSource.name,
        type: dataSource.type,
        status: dataSource.status,
        description: dataSource.description,
        last_sync: dataSource.last_sync,
        metadata: dataSource.metadata || {},
        metrics: {
          records: dataSource.metrics?.records || 0,
          syncRate: dataSource.metrics?.syncRate || 0,
          avgSyncTime: dataSource.metrics?.avgSyncTime || '0s',
          lastError: dataSource.metrics?.lastError
        },
        data: dataSource.data || {},
        created_by: dataSource.created_by,
        created_at: dataSource.created_at,
        updated_at: dataSource.updated_at
      };

      console.log('Sending response:', response);
      res.json(response);
    } catch (error) {
      console.error('Error fetching data source:', error);
      res.status(500).json({ 
        error: 'Failed to fetch data source',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestedId: id
      });
    }
  }

  async getDataSourceChunks(req: Request, res: Response | CustomResponse) {
    const { id } = req.params;
    
    try {
      console.log('Fetching document chunks for data source ID:', id);
      
      // Convert string ID to number since our DB uses integer
      const numericId = parseInt(id, 10);
      
      if (isNaN(numericId)) {
        console.error('Invalid ID format:', id);
        return res.status(400).json({ 
          error: 'Invalid ID format',
          details: 'ID must be a valid number',
          requestedId: id
        });
      }

      // Check if data source exists
      const dataSource = await this.db('data_sources')
        .where({ id: numericId })
        .first();

      if (!dataSource) {
        console.log('Data source not found:', { numericId, originalId: id });
        return res.status(404).json({ 
          error: 'Data source not found',
          requestedId: id
        });
      }

      // Check if this data source has an original data source ID in its metadata
      // This happens when we have two data sources for the same file (one with chunks, one without)
      let dataSourceIdToUse = numericId;
      if (dataSource.metadata && dataSource.metadata.dataSourceId) {
        const originalId = parseInt(dataSource.metadata.dataSourceId, 10);
        if (!isNaN(originalId)) {
          console.log(`Found original data source ID: ${originalId}`);
          dataSourceIdToUse = originalId;
        }
      }

      // Fetch document chunks for the data source
      const chunks = await this.db('document_chunks')
        .where({ data_source_id: dataSourceIdToUse })
        .select('*');

      res.json(chunks);
    } catch (error) {
      console.error('Error fetching data source chunks:', error);
      res.status(500).json({ error: 'Failed to fetch data source chunks' });
    }
  }

  /**
   * Search document chunks by vector similarity
   */
  async searchDocumentChunks(req: AuthRequest, res: Response) {
    try {
      console.log('Searching document chunks with request:', {
        body: req.body,
        query: req.query
      });

      const { embedding, dataSources, limit, threshold, isAnalytical, isVCFundCountQuery } = req.body;

      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ 
          error: 'Invalid embedding',
          details: 'Embedding must be a valid array of numbers'
        });
      }

      if (!dataSources || !Array.isArray(dataSources) || dataSources.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid data sources',
          details: 'Data sources must be a non-empty array of IDs'
        });
      }

      // Initialize the data source service if not already done
      if (!this.dataSourceService) {
        this.dataSourceService = DataSourceService.getInstance();
      }

      // Determine effective limit based on query type
      let effectiveLimit = limit || 10;
      
      if (isVCFundCountQuery) {
        // Special case for VC fund counting - use a very high limit
        effectiveLimit = 500;
        console.log(`Using expanded limit of ${effectiveLimit} for VC fund counting query`);
      } else if (isAnalytical) {
        // Standard analytical query - use a higher limit
        effectiveLimit = limit || 100;
        console.log(`Using higher limit of ${effectiveLimit} for analytical query`);
      }
      
      console.log(`Using effective limit of ${effectiveLimit} for ${isVCFundCountQuery ? 'VC fund counting' : isAnalytical ? 'analytical' : 'standard'} query`);

      // Call the service method to search document chunks
      const chunks = await this.dataSourceService.searchDocumentChunks(
        embedding,
        dataSources,
        effectiveLimit,
        threshold || 0.5,
        isAnalytical,
        isVCFundCountQuery
      );

      res.json(chunks);
    } catch (error) {
      console.error('Error searching document chunks:', error);
      res.status(500).json({ 
        error: 'Failed to search document chunks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Text-based search for document chunks containing specific text
   * This is used as a fallback when vector search doesn't find relevant documents
   */
  async textSearchDocumentChunks(req: AuthRequest, res: Response) {
    try {
      console.log('Text searching document chunks with request:', {
        body: req.body,
        query: req.query
      });

      const { text, collection, documentId, limit } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid text query',
          details: 'Text query must be a non-empty string'
        });
      }

      // Support both 'collection' and legacy 'dataSources' parameters
      let dataSources = req.body.dataSources;
      if (collection && !dataSources) {
        dataSources = [collection];
      }

      if (!dataSources || !Array.isArray(dataSources) || dataSources.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid data sources',
          details: 'Data sources must be a non-empty array of IDs or a single collection name'
        });
      }

      // Initialize the data source service if not already done
      if (!this.dataSourceService) {
        this.dataSourceService = DataSourceService.getInstance();
      }

      // Initialize Qdrant service for direct collection checks
      if (!this.qdrantService) {
        this.qdrantService = QdrantService.getInstance();
      }

      // For each dataSource, check if the collection exists, and if not, try sequential IDs
      // This fixes the issue where PDF uploads create multiple data source IDs
      const validatedSources: string[] = [];
      
      for (const source of dataSources) {
        // Normalize collection name
        const sourceId = this.normalizeCollectionName(source);
        
        try {
          // Check if collection exists
          const exists = await this.qdrantService.collectionExists(sourceId);
          
          if (exists) {
            validatedSources.push(sourceId);
            continue;
          }
          
          // If the collection doesn't exist and it's a numeric ID with datasource_ prefix
          if (sourceId.startsWith('datasource_')) {
            const numericPart = sourceId.replace('datasource_', '');
            if (!isNaN(parseInt(numericPart))) {
              // Try the next sequential ID (for PDF processing bug)
              const nextId = `datasource_${parseInt(numericPart) + 1}`;
              const nextExists = await this.qdrantService.collectionExists(nextId);
              
              if (nextExists) {
                this.logger.info(`Collection ${sourceId} doesn't exist, but ${nextId} does. Using it instead.`);
                validatedSources.push(nextId);
                continue;
              }
              
              // Try the previous ID too (just in case)
              const prevId = `datasource_${parseInt(numericPart) - 1}`;
              const prevExists = await this.qdrantService.collectionExists(prevId);
              
              if (prevExists) {
                this.logger.info(`Collection ${sourceId} doesn't exist, but ${prevId} does. Using it instead.`);
                validatedSources.push(prevId);
                continue;
              }
            }
          }
          
          // If we got here, no valid collection was found
          this.logger.warn(`No valid collection found for ${sourceId}`);
        } catch (error) {
          this.logger.error(`Error checking collection ${sourceId}:`, error);
        }
      }
      
      if (validatedSources.length === 0) {
        return res.status(404).json({
          error: 'No valid collections found',
          details: `None of the provided data sources exist: ${dataSources.join(', ')}`
        });
      }
      
      // Replace original dataSources with validated ones
      dataSources = validatedSources;

      // Determine limit
      const effectiveLimit = parseInt(limit as string) || 50;

      // Call the service method to text search document chunks
      const chunks = await this.dataSourceService.textSearchDocumentChunks(
        text,
        dataSources,
        effectiveLimit,
        documentId as string
      );

      // Add a flag to indicate the results are from text search
      const results = chunks.map(chunk => ({
        ...chunk,
        fromTextSearch: true
      }));

      res.json(results);
    } catch (error) {
      console.error('Error text searching document chunks:', error);
      res.status(500).json({ 
        error: 'Failed to text search document chunks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get file content for a local file data source
   * @param req Express request object
   * @param res Express response object
   */
  async getLocalFileContent(req: AuthRequest, res: Response | CustomResponse) {
    try {
      const dataSourceId = req.params.id;
      const userId = typeof req.user.id === 'string' ? parseInt(req.user.id, 10) : req.user.id;
      const organizationId = typeof req.user.organizationId === 'string' ? 
                            parseInt(req.user.organizationId, 10) : 
                            req.user.organizationId;

      if (!dataSourceId) {
        throw new BadRequestError('Data source ID is required');
      }

      // Get the data source from the database
      const dataSource = await this.db('data_sources')
        .where({ 
          id: dataSourceId,
          organization_id: organizationId 
        })
        .first();

      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }

      // Ensure this is a file-based data source with local storage
      if (!dataSource.metadata || 
          !dataSource.metadata.fileId || 
          dataSource.type !== 'file') {
        return res.status(400).json({ 
          error: 'This data source does not have local file content' 
        });
      }

      // Get the file content
      const fileContent = await this.db('files')
        .where({
          id: dataSource.metadata.fileId,
          organization_id: organizationId
        })
        .select('content', 'mime_type', 'original_filename')
        .first();

      if (!fileContent || !fileContent.content) {
        return res.status(404).json({ error: 'File content not found' });
      }

      // Set appropriate headers and send the file
      res.setHeader('Content-Type', fileContent.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileContent.original_filename}"`);
      return res.send(fileContent.content);
    } catch (error) {
      console.error('Error retrieving local file content:', error);
      return res.status(500).json({
        error: 'Failed to retrieve file content',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if a query is analytical in nature
   * @param query The query text to analyze
   * @returns boolean True if the query appears to be analytical
   */
  private isAnalyticalQuery(query: string): boolean {
    const analyticalPatterns = [
      /how many/i,
      /count of/i,
      /number of/i,
      /total/i,
      /average/i,
      /compare/i,
      /difference between/i,
      /analyze/i,
      /statistics/i,
      /trend/i,
      /percentage/i,
      /ratio/i,
      /distribution/i,
      /largest/i,
      /smallest/i,
      /most common/i,
      /least common/i,
    ];
    
    return analyticalPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Extract keywords from a query for better matching
   * @param query The query text to extract keywords from
   * @returns string[] Array of extracted keywords
   */
  private extractKeywords(query: string): string[] {
    // Remove stop words and extract important terms
    const stopWords = [
      'a', 'an', 'the', 'of', 'for', 'in', 'on', 'at', 'by', 'to', 
      'how', 'many', 'much', 'is', 'are', 'there', 'do', 'does', 'what', 
      'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'total',
      'their', 'they', 'it', 'its', 'that'
    ];
    
    // Extract words, remove punctuation, and filter out stop words
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => !stopWords.includes(word));
    
    // Add specific terms we know are in our data
    if (query.toLowerCase().includes('vc fund') || 
        query.toLowerCase().includes('venture capital')) {
      words.push('vc');
      words.push('fund');
      words.push('investor');
    }
    
    if (query.toLowerCase().includes('investor')) {
      words.push('investor');
      words.push('investment');
    }
    
    // Deduplicate
    return [...new Set(words)];
  }

  /**
   * Store a document chunk with its content, metadata, and other details
   */
  async storeDocumentChunk(req: AuthRequest, res: Response) {
    try {
      const { dataSourceId, content, metadata = {}, pageNumber, chunkIndex } = req.body;

      // Validate required fields
      if (!dataSourceId || !content) {
        return res.status(400).json({
          message: 'dataSourceId and content are required'
        });
      }

      const userId = typeof req.user.id === 'string' ? parseInt(req.user.id, 10) : req.user.id;
      const organizationId = typeof req.user.organizationId === 'string' ? 
                            parseInt(req.user.organizationId, 10) : 
                            req.user.organizationId;

      // Initialize the data source service if not already done
      if (!this.dataSourceService) {
        this.dataSourceService = DataSourceService.getInstance();
      }

      // Call the service method to store the document chunk
      const chunkId = await this.dataSourceService.storeDocumentChunk(
        dataSourceId,
        content,
        '', // Empty embedding for now - will be generated by a separate process
        {
          ...metadata,
          pageNumber,
          chunkIndex,
          addedBy: userId,
          organizationId
        }
      );

      return res.status(201).json({
        id: chunkId,
        dataSourceId,
        message: 'Document chunk stored successfully'
      });
    } catch (error) {
      console.error('Error storing document chunk:', error);
      return res.status(500).json({
        error: 'Failed to store document chunk',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test a connection to Snowflake
   * @param req Request containing Snowflake connection parameters
   * @param res Response with connection result
   */
  async testSnowflakeConnection(req: AuthRequest, res: Response) {
    try {
      const { 
        account, 
        username, 
        password, 
        database, 
        schema, 
        warehouse, 
        role 
      } = req.body;

      // Validate required parameters
      if (!account || !username || !password) {
        throw new BadRequestError('Account, username, and password are required for Snowflake connection');
      }

      // Create a temporary connection for testing (not associated with a data source yet)
      const connectionResult = await this.snowflakeService.createConnection(
        0, // Temporary ID, won't be stored
        { account, username, password, database, schema, warehouse, role }
      );

      if (connectionResult.success) {
        // Close the connection since it was just for testing
        await this.snowflakeService.closeConnection(0);
      }

      return res.status(200).json(connectionResult);
    } catch (error: any) {
      this.logger.error(`Error testing Snowflake connection: ${error.message}`);
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Update data source collection references by scanning collections
   * This utility endpoint helps fix mismatches between data sources and collections
   */
  async updateDataSourceCollectionReferences(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('Updating data source collection references');
      
      // First ensure the collection_name column exists
      const hasColumn = await this.checkIfColumnExists('data_sources', 'collection_name');
      
      if (!hasColumn) {
        this.logger.info('Adding collection_name column to data_sources table');
        await db.schema.table('data_sources', table => {
          table.string('collection_name').nullable();
        });
        this.logger.info('Added collection_name column to data_sources table');
      }
      
      // Get the RAG service
      const ragService = new RagService();
      
      // Update references
      const result = await ragService.updateDataSourceCollectionReferences();
      
      this.logger.info(`Updated ${result.updated} data source collection references with ${result.errors} errors`);
      
      // Return success
      res.status(200).json({
        success: true,
        message: `Updated ${result.updated} data source collection references`,
        result
      });
    } catch (error) {
      this.logger.error('Error updating data source collection references:', error);
      res.status(500).json({
        success: false,
        message: `Error updating data source collection references: ${error}`
      });
    }
  }
  
  /**
   * Check if a column exists in a table
   */
  private async checkIfColumnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      // Use PostgreSQL information_schema to check if column exists
      const result = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ? AND column_name = ?
      `, [tableName, columnName]);
      
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
      return false;
    }
  }
}