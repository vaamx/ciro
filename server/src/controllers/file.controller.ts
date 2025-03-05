import { Request, Response } from 'express';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { FileService } from '../services/file.service';
import { db } from '../infrastructure/database/knex';
import { createLogger } from '../utils/logger';

class FileController {
  private logger = createLogger('FileController');
  constructor(private fileService: FileService = new FileService(db)) {}

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
      this.logger.info('File upload request received');
      this.logger.debug('Request headers:', req.headers);
      
      // Check if there's an authorization header
      const hasAuthHeader = !!req.headers.authorization;
      const hasCookies = !!req.cookies && Object.keys(req.cookies).length > 0;
      
      this.logger.info(`Auth status: hasAuthHeader=${hasAuthHeader}, hasCookies=${hasCookies}, hasUser=${!!req.user}`);
      
      // Check authentication
      let userId, organizationId;
      try {
        const auth = this.ensureAuthenticated(req);
        userId = auth.userId;
        organizationId = auth.organizationId;
        this.logger.info(`Authenticated user: ${userId}, organization: ${organizationId}`);
      } catch (authError) {
        this.logger.error('Authentication error:', authError);
        
        // Send a more detailed auth error response
        const statusCode = authError instanceof UnauthorizedError ? 401 : 400;
        const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed';
        
        this.logger.warn(`Sending auth error response: ${statusCode} - ${errorMessage}`);
        
        res.status(statusCode).json({ 
          error: errorMessage,
          details: 'Make sure you are logged in and have a valid authentication token',
          code: authError instanceof UnauthorizedError ? 'UNAUTHORIZED' : 'BAD_REQUEST'
        });
        return;
      }

      // Check file
      if (!req.file) {
        this.logger.warn('No file in request');
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      this.logger.info(`Processing file: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);
      
      // Use processing method from parameter or body
      const fileProcessingMethod = processingMethod || req.body.processingMethod;
      if (fileProcessingMethod) {
        this.logger.info(`Processing method requested: ${fileProcessingMethod}`);
      }

      // Try to upload the file with detailed error handling
      try {
        const file = await this.fileService.uploadFile(
          req.file, 
          Number(organizationId), 
          userId,
          fileProcessingMethod
        );
        this.logger.info(`File uploaded successfully: ${file.id}`);
        res.status(201).json(file);
      } catch (uploadError) {
        this.logger.error('File service upload error:', uploadError);
        
        // Send detailed error response
        if (uploadError instanceof BadRequestError) {
          res.status(400).json({ error: uploadError.message });
        } else {
          res.status(500).json({ 
            error: 'Failed to upload file',
            message: uploadError instanceof Error ? uploadError.message : String(uploadError),
            stack: uploadError instanceof Error ? uploadError.stack : undefined
          });
        }
      }
    } catch (error) {
      this.logger.error('Unhandled error in uploadFile:', error);
      
      // Don't send response if already sent
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Unhandled server error during file upload',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  };

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