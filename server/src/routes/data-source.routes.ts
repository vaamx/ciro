import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { DataSourceController } from '../controllers/data-source.controller';
import { RequestHandler, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import multer from 'multer';
import { ChunkController } from '../controllers/chunk.controller';
import { json } from 'express';
import { db } from '../infrastructure/database';
import { NextFunction } from 'express';
import { Request } from 'express';
import { createLogger } from '../utils/logger';
import { FileService } from '../services/file.service';
import { DocumentProcessorFactory } from '../services/document-processors/document-processor-factory';

const logger = createLogger('DataSourceRoutes');
const router = Router();
const dataSourceController = new DataSourceController();
const chunkController = new ChunkController();

// Configure multer for regular file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB
  },
});

// Configure multer for chunked uploads with higher limit
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // Increased to 100MB for chunks
  },
});

// Create a separate router for chunk uploads that bypass JSON body parsing
const chunkRouter = Router();

// Apply authentication middleware to all routes
router.use(authenticate);
chunkRouter.use(authenticate);

// Add a specialized authentication middleware for chunk uploads that can fall back
// when regular auth fails but dataSourceId is provided in headers
const authenticateChunkUpload = async (req: AuthRequest | Request, res: Response, next: NextFunction) => {
  try {
    // First try regular authentication
    await authenticate(req, res, next);
  } catch (error) {
    // If authentication fails, check if we have a data source ID in the headers
    const dataSourceId = req.headers['x-data-source-id'] as string;
    console.log(`Authentication failed for chunk upload. Checking for data source ID: ${dataSourceId}`);
    
    if (dataSourceId) {
      try {
        // Check if it's a valid data source
        const dataSource = await db('data_sources')
          .where({ id: dataSourceId })
          .first();
        
        if (dataSource) {
          // Set a minimal user context
          (req as any).user = {
            id: dataSource.created_by?.toString() || 'system',
            email: 'system@example.com',
            role: 'user',
            organizationId: dataSource.organization_id?.toString() || '1'
          };
          console.log(`Using data source ${dataSourceId} for authentication fallback`);
          return next();
        }
      } catch (dbError) {
        console.error('Error checking data source ID:', dbError);
      }
    }
    
    // If we get here, both auth methods failed
    next(error);
  }
};

// Use the specialized authentication middleware for the chunk router
chunkRouter.use(authenticateChunkUpload as RequestHandler);

// Configure chunk upload routes (these will bypass the JSON body parser)
chunkRouter.post('/chunk', chunkUpload.single('chunk'), asyncHandler<AuthRequest>((req, res) => {
  console.log('Chunk upload request received:', {
    headers: {
      'x-file-id': req.headers['x-file-id'],
      'x-chunk-index': req.headers['x-chunk-index'],
      'x-total-chunks': req.headers['x-total-chunks'],
      'content-type': req.headers['content-type']
    },
    hasFile: !!req.file,
    fileDetails: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferExists: !!req.file.buffer
    } : null
  });
  return chunkController.uploadChunk(req, res);
}));

// Route to complete a chunked upload
chunkRouter.post('/complete', asyncHandler<AuthRequest>((req, res) => 
  chunkController.completeChunkedUpload(req, res)));

// Routes
router.get('/', asyncHandler<AuthRequest>((req, res) => dataSourceController.getDataSources(req, res)));
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get user info from user property
    const user = req.user;
    if (!user || !user.id || !user.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const userId = user.id;
    const organizationId = Number(user.organizationId); // Convert to number if needed
    
    // Validate request body
    const dataSource = req.body;
    if (!dataSource) {
      return res.status(400).json({ error: 'No data provided' });
    }
    
    logger.info(`Creating data source with data: ${JSON.stringify(dataSource)}`);
    
    // Check if this data source already exists
    const existingDataSource = await db('data_sources')
      .where({
        organization_id: organizationId,
        name: dataSource.name
      })
      .first();
      
    if (existingDataSource) {
      logger.info(`Data source already exists: ${existingDataSource.id}`);
      return res.status(200).json({
        ...existingDataSource,
        id: existingDataSource.id.toString()
      });
    }
    
    // Check for file ID in metadata
    let fileId = dataSource.metadata?.id;
    
    if (fileId) {
      logger.info(`Checking for existing data source for file ID: ${fileId} (type: ${dataSource.metadata?.fileType})`);
      
      // Check if there's already a data source for this file
      const existingDSForFile = await db('data_sources')
        .whereRaw(`metadata->>'id' = ?`, [fileId])
        .whereRaw(`metadata->>'fileType' = ? or metadata->>'type' = ?`, [
          dataSource.metadata?.fileType,
          dataSource.metadata?.fileType
        ])
        .first();
        
      if (existingDSForFile) {
        logger.info(`Found existing data source ${existingDSForFile.id} for file ID ${fileId}`);
        return res.status(200).json({
          ...existingDSForFile,
          id: existingDSForFile.id.toString()
        });
      }
      
      // Check file-to-data-source mapping
      const mapping = await db('file_to_data_source')
        .where({ file_id: fileId })
        .first();
        
      if (mapping) {
        const mappedDataSource = await db('data_sources')
          .where({ id: mapping.data_source_id })
          .first();
          
        if (mappedDataSource) {
          logger.info(`Found existing data source ${mappedDataSource.id} from mapping for file ID ${fileId}`);
          return res.status(200).json({
            ...mappedDataSource,
            id: mappedDataSource.id.toString()
          });
        }
      }
    }
    
    // Set the organization ID for this data source
    dataSource.organization_id = organizationId;
    
    // Set default values
    if (!dataSource.status) {
      dataSource.status = 'connected';
    }
    
    if (!dataSource.last_sync) {
      dataSource.last_sync = new Date();
    }
    
    // Create a file service instance for needed operations
    const fileServiceInstance = new FileService();
    
    // Extract numeric user ID
    let numericUserId = 0;
    try {
      if (userId) {
        // First try to parse as a number
        const parsedId = parseInt(userId, 10);
        if (!isNaN(parsedId)) {
          numericUserId = parsedId;
        } else {
          // If it's not a number, try to find the user record
          const userRecord = await db('users')
            .where({ id: userId })
            .first();
            
          if (userRecord && userRecord.id) {
            numericUserId = parseInt(userRecord.id.toString(), 10);
          }
        }
      }
    } catch (err) {
      logger.warn(`Error parsing user ID: ${err}`);
      // Default to 1 if parse fails
      numericUserId = 1;
    }
    
    dataSource.created_by = numericUserId;
    dataSource.created_at = new Date();
    dataSource.updated_at = new Date();
    
    // Create the data source in a transaction
    let result;
    await db.transaction(async (trx) => {
      // Insert the data source
      const [createdDataSource] = await trx('data_sources')
        .insert(dataSource)
        .returning('*');
        
      logger.info(`Data source created in database: ${JSON.stringify(createdDataSource)}`);
      
      // Verify that the data source was created
      const verifiedDataSource = await trx('data_sources')
        .where({ id: createdDataSource.id })
        .first();
        
      logger.info(`Verified data source exists: ${JSON.stringify(verifiedDataSource)}`);
      
      result = verifiedDataSource;
    });
    
    // Verify outside the transaction
    const finalVerification = await db('data_sources')
      .where({ id: result.id })
      .first();
      
    logger.info(`Final verification successful: ${JSON.stringify(finalVerification)}`);
    
    // Format ID as string for consistency
    const responseDataSource = {
      ...finalVerification,
      id: finalVerification.id.toString()
    };
    
    // Add mapping from file to data source if applicable
    if (fileId) {
      try {
        await db('file_to_data_source')
          .insert({
            file_id: fileId,
            data_source_id: result.id.toString(),
            created_at: new Date()
          });
          
        logger.info(`Created file to data source mapping: ${fileId} -> ${result.id}`);
      } catch (err) {
        logger.warn(`Error creating file to data source mapping: ${err}`);
        // Continue even if mapping fails
      }
    }
    
    // Trigger processing for CSV files
    if (dataSource.metadata?.fileType === 'csv' && dataSource.metadata?.processingMethod === 'csv-processor' && dataSource.metadata?.id) {
      logger.info(`Triggering CSV processing for data source ${result.id}`);
      
      try {
        // Get the file path from the uploaded file
        const filePath = `/home/vaamx/ciro-1/server/uploads/${dataSource.metadata.id}_${userId.substring(0, 8)}.csv`;
        
        // Create a file service instance for needed operations
        const fileServiceInstance = new FileService();
        
        // First add the file path to metadata so the processor can find it
        await fileServiceInstance.addFilePathToDataSource(result.id.toString(), filePath);
        logger.info(`Added file path to data source metadata: ${filePath}`);
        
        // Then queue the CSV processing task
        fileServiceInstance.processCSVFile(filePath, result.id.toString())
          .then(() => {
            logger.info(`CSV processing completed for data source ${result.id}`);
          })
          .catch(error => {
            logger.error(`Error processing CSV file: ${error}`);
          });
          
        logger.info(`CSV processing job queued for data source ${result.id}`);
      } catch (err) {
        logger.error(`Error setting up CSV processing: ${err}`);
        // Continue even if processing setup fails - the file is still uploaded
      }
    }
    
    logger.info(`Sending response with transformed ID: ${JSON.stringify(responseDataSource)}`);
    return res.status(201).json(responseDataSource);
  } catch (error) {
    logger.error(`Error creating data source: ${error}`);
    return res.status(500).json({ error: 'Failed to create data source' });
  }
}));

// Add route for local file data sources - must come before generic :id routes
router.get('/local-files/:id', asyncHandler<AuthRequest>((req, res) => dataSourceController.getLocalFileContent(req, res)));

// Generic :id routes
router.delete('/:id', asyncHandler<AuthRequest>((req, res) => dataSourceController.deleteDataSource(req, res)));
router.put('/:id', asyncHandler<AuthRequest>((req, res) => dataSourceController.updateDataSource(req, res)));
router.get('/:id', asyncHandler<AuthRequest>((req, res) => dataSourceController.getDataSource(req, res)));
router.post('/:id/content', upload.single('file'), asyncHandler<AuthRequest>((req, res) => dataSourceController.processContent(req, res)));

// Add enhanced processing route with support for auto detection
router.post('/process', asyncHandler<AuthRequest>((req, res) => {
  logger.info('Enhanced processing route called', { userId: req.user?.id });
  return dataSourceController.processContent(req, res);
}));

// Sync/refresh data source content
router.post('/:id/sync', asyncHandler<AuthRequest>((req, res) => dataSourceController.syncData(req, res)));

// Document chunks routes
router.post('/chunks/search', asyncHandler<AuthRequest>((req, res) => dataSourceController.searchDocumentChunks(req, res)));
router.post('/chunks/text-search', asyncHandler<AuthRequest>((req, res) => dataSourceController.textSearchDocumentChunks(req, res)));
router.post('/chunks', asyncHandler<AuthRequest>((req, res) => dataSourceController.storeDocumentChunk(req, res)));

// Export the router with named exports for the chunk router
export { router, chunkRouter };

// Also export as default for backward compatibility
export default router; 