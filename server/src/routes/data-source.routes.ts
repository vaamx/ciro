import { Request, Response, NextFunction, RequestHandler } from 'express-serve-static-core';
import { authenticate } from '../middleware/auth';
import { DataSourceController } from '../controllers/data-source.controller';
import { asyncHandler } from '../utils/asyncHandler';
import multer from 'multer';
import { ChunkController } from '../controllers/chunk.controller';
import { db } from '../infrastructure/database';
import * as winston from 'winston';
import { FileService } from '../services/file.service';
import { AuthRequest } from '../middleware/auth';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DataSourceRoutes]: ${message}`;
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
          const formattedMessage = `${timestamp} [${level.toUpperCase()}] [DataSourceRoutes]: ${message}`;
          return Object.keys(rest).length ? `${formattedMessage} ${JSON.stringify(rest)}` : formattedMessage;
        })
      )
    })
  ]
});

// Use direct require to create router
const router = require('express').Router();
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
const chunkRouter = require('express').Router();

// Apply authentication middleware to all routes
router.use(authenticate);
chunkRouter.use(authenticate);

// Add a specialized authentication middleware for chunk uploads that can fall back
// when regular auth fails but dataSourceId is provided in headers
const authenticateChunkUpload = async (req: Request, res: Response, next: NextFunction) => {
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
chunkRouter.post('/chunk', chunkUpload.single('chunk'), (asyncHandler((req, res) => {
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
  return chunkController.uploadChunk(req as any, res as any);
}) as unknown as RequestHandler));

// Route to complete a chunked upload
chunkRouter.post('/complete', (asyncHandler((req, res) => 
  chunkController.completeChunkedUpload(req as any, res as any)) as unknown as RequestHandler));

// Routes
router.get('/', (asyncHandler((req, res) => dataSourceController.getDataSources(req as any, res as any)) as unknown as RequestHandler));
router.post('/', authenticate, (asyncHandler(async (req: any, res: any) => {
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
    
    // Trigger processing for Snowflake data sources
    if (dataSource.type === 'snowflake') {
      logger.info(`Triggering Snowflake schema indexing for data source ${result.id}`);
      
      try {
        // Import the Snowflake schema indexer service
        const { SnowflakeSchemaIndexerService } = require('../services/snowflake-schema-indexer.service');
        const snowflakeSchemaIndexerService = SnowflakeSchemaIndexerService.getInstance();
        
        // Extract connection details from metadata
        const connectionDetails = {
          account: dataSource.metadata?.snowflake_account,
          username: dataSource.metadata?.snowflake_username,
          password: dataSource.metadata?.snowflake_password,
          role: dataSource.metadata?.snowflake_role,
          database: dataSource.metadata?.snowflake_database,
          schema: dataSource.metadata?.snowflake_schema,
          warehouse: dataSource.metadata?.snowflake_warehouse
        };
        
        // Get row-level indexing preference
        const useRowLevelIndexing = dataSource.metadata?.use_row_level_indexing === true;
        
        // Queue the schema indexing task
        Promise.resolve().then(async () => {
          try {
            logger.info(`Starting Snowflake schema indexing for data source ${result.id} with database ${connectionDetails.database} and schema ${connectionDetails.schema}`);
            await snowflakeSchemaIndexerService.indexDatabaseSchema(
              parseInt(result.id),
              connectionDetails,
              connectionDetails.database,
              connectionDetails.schema,
              { 
                includeTableData: true, 
                rowLimit: Number.MAX_SAFE_INTEGER,  // Use maximum possible value
                maxTablesToIndex: Number.MAX_SAFE_INTEGER,  // Index all tables 
                detectRelationships: true,  // Ensure relationships are detected
                sampleRowCount: 10000000,   // Process up to 10 million rows per table
                useRowLevelIndexing: useRowLevelIndexing   // Use the client-provided value
              }
            );
            
            // If row-level indexing is enabled, directly test it on a single table for verification
            if (useRowLevelIndexing) {
              logger.info(`Testing row-level indexer directly for data source ${result.id}`);
              try {
                // Import the row-level indexer service
                const { RowLevelIndexerService } = require('../services/data-storage/row-level-indexer.service');
                const rowLevelIndexerService = RowLevelIndexerService.getInstance();
                
                // Test index with a limit of 100 rows from TRANSACTIONS table (if it exists)
                // This is just a validation test to make sure the indexer works correctly
                const testResult = await rowLevelIndexerService.indexTableRows(
                  parseInt(result.id),
                  connectionDetails.database,
                  connectionDetails.schema,
                  'TRANSACTIONS', // Try with the TRANSACTIONS table as a test
                  {
                    chunkSize: 25,    // Small chunk size for testing
                    maxRows: 100,     // Limit to 100 rows for testing
                    forceReindex: true, // Always create a fresh collection
                    createEmbeddings: true
                  }
                );
                
                logger.info(`Row-level indexing test completed: ${testResult.totalIndexed} rows indexed`);
              } catch (rowIndexError) {
                logger.error(`Row-level indexing test failed: ${rowIndexError.message}`);
              }
            }
            
            logger.info(`Snowflake schema indexing completed for data source ${result.id}`);
            
            // Update the data source status
            await db('data_sources')
              .where({ id: result.id })
              .update({
                status: 'indexed',
                updated_at: new Date()
              });
          } catch (error) {
            logger.error(`Error indexing Snowflake schema: ${error}`);
          }
        });
        
        logger.info(`Snowflake schema indexing job queued for data source ${result.id}`);
      } catch (err) {
        logger.error(`Error setting up Snowflake schema indexing: ${err}`);
        // Continue even if indexing setup fails
      }
    }
    
    logger.info(`Sending response with transformed ID: ${JSON.stringify(responseDataSource)}`);
    return res.status(201).json(responseDataSource);
  } catch (error) {
    logger.error(`Error creating data source: ${error}`);
    return res.status(500).json({ error: 'Failed to create data source' });
  }
}) as unknown as RequestHandler));

// Add route for local file data sources - must come before generic :id routes
router.get('/local-files/:id', (asyncHandler((req, res) => dataSourceController.getLocalFileContent(req as any, res as any)) as unknown as RequestHandler));

// Generic :id routes
router.delete('/:id', (asyncHandler((req, res) => dataSourceController.deleteDataSource(req as any, res as any)) as unknown as RequestHandler));
router.put('/:id', (asyncHandler((req, res) => dataSourceController.updateDataSource(req as any, res as any)) as unknown as RequestHandler));
router.get('/:id', (asyncHandler((req, res) => dataSourceController.getDataSource(req as any, res as any)) as unknown as RequestHandler));
router.post('/:id/content', upload.single('file'), (asyncHandler((req, res) => dataSourceController.processContent(req as any, res as any)) as unknown as RequestHandler));

// Add enhanced processing route with support for auto detection
router.post('/process', (asyncHandler((req, res) => {
  logger.info('Enhanced processing route called', { userId: req.user?.id });
  return dataSourceController.processContent(req as any, res as any);
}) as unknown as RequestHandler));

// Sync/refresh data source content
router.post('/:id/sync', (asyncHandler((req, res) => dataSourceController.syncData(req as any, res as any)) as unknown as RequestHandler));

// Document chunks routes
router.post('/chunks/search', (asyncHandler((req, res) => dataSourceController.searchDocumentChunks(req as any, res as any)) as unknown as RequestHandler));
router.post('/chunks/text-search', (asyncHandler((req, res) => dataSourceController.textSearchDocumentChunks(req as any, res as any)) as unknown as RequestHandler));
router.post('/chunks', (asyncHandler((req, res) => dataSourceController.storeDocumentChunk(req as any, res as any)) as unknown as RequestHandler));

// Add new endpoint for BI-focused complete data indexing
router.post('/:id/bi-reindex', authenticate, (asyncHandler(async (req: any, res: any) => {
  try {
    const dataSourceId = req.params.id;
    logger.info(`Triggering BI-focused complete data reindexing for data source ${dataSourceId}`);
    
    // Get the data source
    const dataSource = await db('data_sources')
      .where('id', dataSourceId)
      .first();
    
    if (!dataSource) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    
    if (dataSource.type !== 'snowflake') {
      return res.status(400).json({ error: 'This operation is only supported for Snowflake data sources' });
    }
    
    // Extract connection details from metadata
    const metadata = JSON.parse(dataSource.metadata || '{}');
    const connectionDetails = {
      account: metadata.snowflake_account,
      username: metadata.snowflake_username,
      password: metadata.snowflake_password,
      role: metadata.snowflake_role,
      database: metadata.snowflake_database,
      schema: metadata.snowflake_schema,
      warehouse: metadata.snowflake_warehouse
    };
    
    // Get row-level indexing preference
    const useRowLevelIndexing = metadata.use_row_level_indexing === true;
    
    // Import the Snowflake schema indexer service
    const { SnowflakeSchemaIndexerService } = require('../services/snowflake-schema-indexer.service');
    const snowflakeSchemaIndexerService = SnowflakeSchemaIndexerService.getInstance();
    
    // Queue the schema indexing task with complete data mode
    Promise.resolve().then(async () => {
      try {
        logger.info(`Starting BI-focused Snowflake schema indexing for data source ${dataSourceId}`);
        // Update the data source status
        await db('data_sources')
          .where({ id: dataSourceId })
          .update({
            status: 'processing',
            updated_at: new Date()
          });
          
        await snowflakeSchemaIndexerService.indexDatabaseSchema(
          parseInt(dataSourceId),
          connectionDetails,
          connectionDetails.database,
          connectionDetails.schema,
          { 
            completeDataMode: true,  // Enable complete data mode for BI
            includeTableData: true, 
            rowLimit: 50000000,  // Process up to 50 million rows per table
            maxTablesToIndex: Number.MAX_SAFE_INTEGER,  // Index all tables 
            detectRelationships: true,  // Ensure relationships are detected
            sampleRowCount: 5000,   // Process up to 5000 rows for sampling
            forceRefresh: true,  // Force refresh all data
            useRowLevelIndexing: useRowLevelIndexing  // Use the client-provided value
          }
        );
        
        logger.info(`BI-focused Snowflake schema indexing completed for data source ${dataSourceId}`);
        
        // Update the data source status
        await db('data_sources')
          .where({ id: dataSourceId })
          .update({
            status: 'indexed',
            updated_at: new Date()
          });
      } catch (error) {
        logger.error(`Error in BI-focused Snowflake schema indexing: ${error}`);
        // Update the data source status to error
        await db('data_sources')
          .where({ id: dataSourceId })
          .update({
            status: 'error',
            updated_at: new Date()
          });
      }
    });
    
    return res.status(202).json({ 
      message: 'BI-focused complete data reindexing job queued',
      dataSourceId
    });
    
  } catch (error) {
    logger.error(`Error triggering BI-focused reindexing: ${error}`);
    return res.status(500).json({ error: 'Failed to trigger BI-focused reindexing' });
  }
}) as unknown as RequestHandler));

// Create a data source from an existing file
router.post('/create-from-file/:fileId', asyncHandler(async (req, res) => {
  try {
    logger.info(`Creating data source from existing file: ${req.params.fileId}`);
    
    const { fileId } = req.params;
    const userId = (req as any).user.id;
    const organizationId = (req as any).user.organizationId;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Get file information from database
    const fileService = new FileService(db);
    const file = await fileService.getFileById(Number(fileId), Number(organizationId));
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    logger.info(`File found: ${file.id} (${file.original_filename})`);
    
    // Determine file type
    const fileType = file.mime_type?.includes('csv') ? 'csv' :
                    file.mime_type?.includes('excel') || file.mime_type?.includes('spreadsheet') ? 'excel' :
                    file.mime_type?.includes('pdf') ? 'pdf' :
                    file.mime_type?.includes('word') ? 'docx' : 'file';
    
    logger.info(`File type determined to be: ${fileType}`);
    
    // Create data source for the file
    const [dataSource] = await db('data_sources')
      .insert({
        name: file.original_filename || file.filename,
        type: 'local-files',
        organization_id: organizationId,
        created_by: userId,
        status: 'connected',
        description: `Uploaded file: ${file.original_filename || file.filename}`,
        metadata: {
          id: file.id,
          fileType: fileType,
          filename: file.original_filename || file.filename,
          mimeType: file.mime_type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploaded_by: userId
        },
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    logger.info(`Data source created with ID: ${dataSource.id}`);
    
    // Update file metadata with data source ID
    await fileService.updateFileMetadata(file.id.toString(), {
      metadata: {
        ...file.metadata,
        dataSourceId: dataSource.id
      }
    });
    
    logger.info(`File ${file.id} updated with data source ID: ${dataSource.id}`);
    
    return res.status(201).json({
      success: true,
      message: 'Data source created successfully',
      dataSource
    });
  } catch (error) {
    logger.error(`Error creating data source from file: ${error.message}`);
    return res.status(500).json({
      error: 'Failed to create data source',
      message: error.message
    });
  }
}));

// Admin endpoints
router.post('/:id/sync', (asyncHandler((req, res) => dataSourceController.syncData(req as any, res as any)) as unknown as RequestHandler));

// Utility endpoints
router.post('/fix-collection-references', (asyncHandler((req, res) => dataSourceController.updateDataSourceCollectionReferences(req as any, res as any)) as unknown as RequestHandler));

// Add a direct endpoint without authentication for debugging/fixing
router.post('/fix-collection-references-debug', (asyncHandler((req, res) => {
  console.log('Running collection references fix without authentication');
  return dataSourceController.updateDataSourceCollectionReferences(req as any, res as any);
}) as unknown as RequestHandler));

// Chunk-related endpoints
router.post('/chunks/search', (asyncHandler((req, res) => dataSourceController.searchDocumentChunks(req as any, res as any)) as unknown as RequestHandler));

// Route to upload a chunk
chunkRouter.post('/', upload.single('file'), (asyncHandler(async (req, res) => {
  // Log the chunk upload request
  logger.info('Chunk upload request received', {
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
  return chunkController.uploadChunk(req as any, res as any);
}) as unknown as RequestHandler));

// Export the router with named exports for the chunk router
export { router, chunkRouter };

// Also export as default for backward compatibility
export default router; 