import { Response as ExpressResponse } from 'express-serve-static-core';
import { Request as ExpressRequest } from '../types/express-types';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { FileService } from '../services/file.service';
import { db } from '../infrastructure/database/knex';
import { createServiceLogger } from '../utils/logger-factory';
import { FileUploadService } from '../services/file-upload.service';
import { File } from '../types/file';
import path from 'path';

// Create a proper interface for our custom Request
interface Request {
  user?: {
    id: string;
    organizationId: number | string;
  };
  file?: {
    originalname: string;
    mimetype: string;
    size: number;
    filename: string;
    path?: string;
  };
  headers: {
    authorization?: string;
    [key: string]: any;
  };
  body: {
    processingMethod?: string;
    [key: string]: any;
  };
  params: {
    id?: string;
    [key: string]: any;
  };
  cookies?: {
    [key: string]: any;
  };
}

// Use the extended Response type
type Response = ExpressResponse;

class FileController {
  private logger = createServiceLogger('FileController');
  private fileUploadService: FileUploadService;
  
  constructor(private fileService: FileService = new FileService(db)) {
    this.fileUploadService = new FileUploadService();
    this.logger.info('FileController initialized');
  }

  private ensureAuthenticated(req: Request): { userId: string; organizationId: number } {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userId = req.user.id;
    const organizationId = typeof req.user.organizationId === 'string' ? parseInt(req.user.organizationId, 10) : req.user.organizationId;

    if (!userId) {
      throw new UnauthorizedError('Invalid user ID');
    }

    if (!organizationId) {
      throw new BadRequestError('Organization ID is required to upload files. Please create or join an organization first.');
    }

    return { userId, organizationId };
  }

  uploadFile = async (
    req: Request, 
    res: Response, 
    processingMethod?: string
  ): Promise<void> => {
    try {
      this.logger.info('FileController.uploadFile called - starting file upload process');
      
      // Extract user and organization information
      const { userId, organizationId } = this.ensureAuthenticated(req);
      
      // Extract file from request
      const file = req.file;
      if (!file) {
        throw new BadRequestError('No file provided');
      }
      
      // Get processing method from request or use default
      const requestedMethod = processingMethod || req.body.processingMethod || 'auto';
      this.logger.info(`Processing method requested: ${requestedMethod}`);
      
      try {
        // Upload file using FileService - pass the userId as a string to prevent conversions
        const uploadedFile = await this.fileService.uploadFile(
          file as any, // Use type assertion to bypass TypeScript checks
          organizationId,
          userId, // Pass userId as string
          requestedMethod
        );
        
        this.logger.info(`File uploaded successfully: ${uploadedFile.id}`);
        
        // Create data source for the file
        await this.attemptDataSourceCreation(
          uploadedFile.id.toString(), // Convert to string to match expected parameter type
          organizationId,
          userId, // Pass userId as string without conversion
          {
            originalFilename: file.originalname, // Save original filename explicitly
            fileType: this.determineFileType(path.extname(file.originalname)),
            extension: path.extname(file.originalname),
            userId: userId, // Store userId as string
            orgId: organizationId
          }
        );
        
        // Return successful response
        res.status(201).json({
          id: uploadedFile.id,
          originalFilename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error in uploadFile: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An error occurred while uploading the file' });
      }
    }
  };
  
  // Handle data source creation in a separate method
  private async attemptDataSourceCreation(
    fileId: string,
    organization_id: number,
    user_id: string, // Keep as string for UUID compatibility
    metadata?: Record<string, any>
  ): Promise<string | null> {
    try {
      this.logger.info(`Attempting to create data source for file ${fileId}`);
      if (!fileId) {
        this.logger.error('No file ID provided for data source creation');
        return null;
      }
      
      // First check if a data source already exists for this file (created by FileService)
      try {
        // Check for an existing mapping in file_to_data_source
        const mapping = await db('file_to_data_source')
          .where({ file_id: fileId })
          .first();

        if (mapping && mapping.data_source_id) {
          this.logger.info(`Found existing data source mapping for file ${fileId}: ${mapping.data_source_id}`);
          
          // Get the data source details
          const existingDataSource = await db('data_sources')
            .where({ id: mapping.data_source_id })
            .first();
            
          if (existingDataSource) {
            this.logger.info(`Using existing data source: ${existingDataSource.id} for file: ${fileId}`);
            
            // Instead of creating a duplicate, just update the existing data source with original filename if needed
            if (metadata?.originalFilename && metadata.originalFilename !== existingDataSource.name) {
              await db('data_sources')
                .where({ id: existingDataSource.id })
                .update({ 
                  name: metadata.originalFilename,
                  metadata: {
                    ...existingDataSource.metadata,
                    filename: metadata.originalFilename,
                    originalFilename: metadata.originalFilename
                  }
                });
              this.logger.info(`Updated existing data source ${existingDataSource.id} with original filename: ${metadata.originalFilename}`);
            }
            
            return existingDataSource.id.toString();
          }
        }

        // Also check if there's a data source with this file ID in its metadata
        const existingByMetadata = await db('data_sources')
          .whereRaw("metadata->>'fileId' = ?", [fileId])
          .first();
          
        if (existingByMetadata) {
          this.logger.info(`Found existing data source ${existingByMetadata.id} with file ID ${fileId} in metadata`);
          return existingByMetadata.id.toString();
        }
      } catch (error) {
        this.logger.warn(`Error checking for existing data source: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with creation if check fails
      }
      
      const originalFilename = metadata?.originalFilename || fileId;
      this.logger.info(`Creating data source for file: ${originalFilename} ${JSON.stringify(metadata || {})}`);
      
      // Ensure the fileType is set
      const fileType = metadata?.fileType || this.determineFileType(path.extname(originalFilename));
      
      // Create the data source
      const [dataSource] = await db('data_sources').insert({
        name: originalFilename,
        type: 'local-files',
        organization_id,
        created_by: user_id, // Use the string UUID directly
        status: 'pending',
        last_sync: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        metadata: {
          ...metadata,
          fileId,
          fileType, 
          originalFilename,
          size: metadata?.size || 0,
          filename: `${fileId}_${user_id.replace(/-/g, '')}.${fileType === 'excel' ? 'xlsx' : fileType}`,
          originalUserId: user_id
        }
      }).returning('*');
      
      if (!dataSource || !dataSource.id) {
        this.logger.error('Failed to create data source');
        return null;
      }
      
      this.logger.info(`Created data source with ID: ${dataSource.id} for file: ${fileId}`);
      
      // Broadcast data source creation via WebSocket
      try {
        const WebSocketService = require('../services/websocket.service').WebSocketService;
        const websocketService = new WebSocketService();
        websocketService.broadcastDataSourceUpdate(dataSource.id, 'processing');
        this.logger.info(`Broadcasted data source creation for ID: ${dataSource.id}`);
      } catch (error) {
        this.logger.warn(`Error broadcasting data source creation: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Broadcast knowledge base update
      try {
        const WebSocketService = require('../services/websocket.service').WebSocketService;
        const websocketService = new WebSocketService();
        websocketService.broadcastKnowledgeBaseUpdate({
          action: 'create',
          source: { id: dataSource.id, type: 'local-files' },
          timestamp: new Date().toISOString()
        });
        this.logger.info(`Broadcasted knowledge base update for new data source: ${dataSource.id}`);
      } catch (error) {
        this.logger.warn(`Error broadcasting knowledge base update: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      this.logger.info(`Data source creation attempt completed for file ${fileId}`);
      return String(dataSource.id);
    } catch (error) {
      this.logger.error(`Error creating data source: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Determine file type based on extension
   */
  private determineFileType(extension: string): string {
    if (!extension) return 'unknown';
    
    const ext = extension.toLowerCase();
    
    if (ext === '.csv') return 'csv';
    if (['.xlsx', '.xls'].includes(ext)) return 'excel';
    if (ext === '.pdf') return 'pdf';
    if (['.doc', '.docx'].includes(ext)) return 'docx';
    if (ext === '.json') return 'json';
    
    return 'unknown';
  }

  getAllFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = this.ensureAuthenticated(req);
      
      if (!organizationId) {
        // Return empty array if user has no organization
        res.json([]);
        return;
      }

      const files = await this.fileService.getAllFiles(organizationId);
      res.json(files);
    } catch (error) {
      this.logger.error('Error in getAllFiles:', error);
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        res.status(error instanceof BadRequestError ? 400 : 401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to retrieve files' });
      }
    }
  };

  getFileById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = this.ensureAuthenticated(req);
      const fileId = parseInt(req.params.id, 10);

      if (isNaN(fileId)) {
        throw new BadRequestError('Invalid file ID');
      }

      const file = await this.fileService.getFileById(fileId, organizationId);
      res.json(file);
    } catch (error) {
      this.logger.error('Error in getFileById:', error);
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        res.status(error instanceof BadRequestError ? 400 : 401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to retrieve file' });
      }
    }
  };

  deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = this.ensureAuthenticated(req);
      const fileId = parseInt(req.params.id, 10);

      if (isNaN(fileId)) {
        throw new BadRequestError('Invalid file ID');
      }

      await this.fileService.deleteFileById(fileId, organizationId);
      res.status(204).send();
    } catch (error) {
      this.logger.error('Error in deleteFile:', error);
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        res.status(error instanceof BadRequestError ? 400 : 401).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete file' });
      }
    }
  };
}

export default new FileController(); 