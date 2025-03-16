import { Router, Request, Response } from '../types/express-types';
import multer from 'multer';
import fileController from '../controllers/file.controller';
import { FileService } from '../services/file.service';
import { db } from '../infrastructure/database/knex';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/security';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { createServiceLogger } from '../utils/logger-factory';

// Create logger for file routes
const logger = createServiceLogger('FileRoutes');

// Configure multer storage
const storage = multer.memoryStorage();
const fileService = new FileService(db);

// For chunked uploads
const chunkedUploads = new Map();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    try {
      if (fileService.isFileTypeAllowed(file.mimetype)) {
        // Generate a unique filename
        const timestamp = Date.now();
        file.filename = `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
      }
    } catch (error) {
      cb(error as Error);
    }
  }
});

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

function ensureAuthenticated(req: Request): { userId: string; organizationId: number } {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const userId = req.user.id;
  let organizationId: number = typeof req.user.organizationId === 'string' ? parseInt(req.user.organizationId, 10) : req.user.organizationId;

  if (!userId) {
    throw new UnauthorizedError('Invalid user ID');
  }

  if (!organizationId) {
    throw new UnauthorizedError('Organization ID is required');
  }

  return { userId, organizationId };
}

// File routes
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Log the entire request for debugging
    console.log('File upload request received:');
    console.log('- Headers:', JSON.stringify(req.headers));
    console.log('- Body:', JSON.stringify(req.body));
    console.log('- File:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    } : 'No file');
    
    // Pass the processing method from the request to the controller
    const processingMethod = req.body.processingMethod;
    
    if (processingMethod) {
      console.log(`Processing method specified in request: ${processingMethod}`);
    }
    
    // Ensure uploads directory exists
    const uploadsDir = 'uploads';
    if (!fs.existsSync(uploadsDir)) {
      console.log(`Creating uploads directory: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Test file write permissions
    try {
      const testPath = path.join(uploadsDir, '_test_' + Date.now());
      fs.writeFileSync(testPath, 'test', 'utf8');
      fs.unlinkSync(testPath);
      console.log('File write permissions test: SUCCESS');
    } catch (writeError) {
      console.error('File write permissions test: FAILED', writeError);
      return res.status(500).json({ 
        error: 'Server file write permissions error',
        details: writeError instanceof Error ? writeError.message : String(writeError)
      });
    }
    
    // Call the controller with the added parameter
    await fileController.uploadFile(req as any, res as any, processingMethod);
  } catch (error) {
    console.error('Error in file upload route:', error);
    // Return detailed error information
    return res.status(500).json({ 
      error: 'Internal server error during file upload',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

router.get('/', fileController.getAllFiles);
router.get('/:id', fileController.getFileById);
router.delete('/:id', fileController.deleteFile);

// Handle file metadata storage
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = ensureAuthenticated(req);
    const { metadata, content } = req.body;

    // Update the file metadata in the database
    const updatedFile = await fileService.updateFileMetadata(metadata.id, {
      metadata: {
        ...metadata,
        content,
        userId,
        organizationId
      }
    });

    res.json(updatedFile);
  } catch (error) {
    console.error('Error storing file metadata:', error);
    res.status(500).json({ error: 'Failed to store file metadata' });
  }
});

router.get('/search', rateLimiter, async (req: Request, res: Response) => {
  try {
    const { organizationId } = ensureAuthenticated(req);
    const query = req.query.q as string;
    
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const files = await fileService.searchFiles(query, organizationId);
    res.json(files);
  } catch (error) {
    console.error('File search error:', error);
    res.status(500).json({ error: 'Failed to search files' });
  }
});

router.get('/:id/content', async (req: Request, res: Response) => {
  try {
    const { organizationId } = ensureAuthenticated(req);
    const fileId = parseInt(req.params.id, 10);
    
    if (isNaN(fileId)) {
      throw new BadRequestError('Invalid file ID');
    }

    const content = await fileService.getFileContent(fileId, organizationId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content);
  } catch (error) {
    console.error('File content retrieval error:', error);
    res.status(404).json({ error: 'File content not found' });
  }
});

// Add the chunked upload endpoints before the export
// Initiate chunked upload
router.post('/initiate-chunked-upload', async (req: Request, res: Response) => {
  console.log('Initiate chunked upload request received');
  console.log('Request body:', req.body);
  
  try {
    const { userId, organizationId } = ensureAuthenticated(req);
    console.log('Authenticated user:', { userId, organizationId });
    
    const { filename, fileSize, fileType, processingMethod } = req.body;
    
    logger.info(`Initiating chunked upload: ${filename} (${fileSize} bytes)`);
    
    if (!filename || !fileSize) {
      return res.status(400).json({ error: 'Filename and fileSize are required' });
    }
    
    // Create a unique upload ID
    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    console.log('Generated upload ID:', uploadId);
    
    // Ensure temp directory exists
    const tempDir = path.join('uploads', 'temp', uploadId);
    console.log('Temp directory path:', tempDir);
    
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('Created temp directory:', tempDir);
    } catch (mkdirError) {
      console.error('Error creating temp directory:', mkdirError);
      throw mkdirError;
    }
    
    // Store upload info
    const uploadInfo = {
      filename,
      fileSize,
      fileType,
      processingMethod,
      userId,
      organizationId,
      chunks: [],
      tempDir,
      timestamp: Date.now()
    };
    
    chunkedUploads.set(uploadId, uploadInfo);
    console.log('Added to chunkedUploads Map. Current uploads:', Array.from(chunkedUploads.keys()));
    console.log('Upload info stored:', uploadInfo);
    
    logger.info(`Created chunked upload with ID: ${uploadId}`);
    res.json({ uploadId });
    
  } catch (error) {
    console.error('Detailed initiate error:', error);
    logger.error('Error initiating chunked upload:', error);
    res.status(500).json({ 
      error: 'Failed to initiate chunked upload',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Upload a chunk
const chunkUpload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      console.log('Multer destination callback called');
      try {
        // Use req.query for the parameters if req.body is empty
        // This is because multer hasn't processed the form yet at this point
        let uploadId = req.body.uploadId || req.query.uploadId as string;
        
        console.log('Multer destination uploadId:', uploadId);
        
        if (!uploadId) {
          logger.error('No uploadId provided for chunk upload');
          return cb(new Error('No uploadId provided'), '');
        }
        
        const upload = chunkedUploads.get(uploadId);
        console.log('Multer found upload in map:', Boolean(upload));
        
        if (!upload) {
          logger.error(`Invalid upload ID: ${uploadId} (not found in chunkedUploads map)`);
          console.log('Available upload IDs:', Array.from(chunkedUploads.keys()));
          return cb(new Error('Invalid upload ID'), '');
        }
        
        // Check if directory exists
        const dirExists = fs.existsSync(upload.tempDir);
        console.log(`Temp directory ${upload.tempDir} exists:`, dirExists);
        
        if (!dirExists) {
          logger.warn(`Temp directory ${upload.tempDir} doesn't exist, creating it`);
          fs.mkdirSync(upload.tempDir, { recursive: true });
        }
        
        console.log('Using destination:', upload.tempDir);
        cb(null, upload.tempDir);
      } catch (dirError) {
        console.error('Error setting chunk destination (detailed):', dirError);
        logger.error('Error setting chunk destination:', dirError);
        cb(new Error(`Error setting chunk destination: ${dirError instanceof Error ? dirError.message : String(dirError)}`), '');
      }
    },
    filename: (req, file, cb) => {
      console.log('Multer filename callback called');
      try {
        // Use req.query for the parameters if req.body is empty
        // This is because multer hasn't processed the form yet at this point
        let chunkIndex = req.body.chunkIndex || req.query.chunkIndex as string;
        console.log('Chunk index from request:', chunkIndex);
        
        if (!chunkIndex && chunkIndex !== '0') {
          logger.error('No chunkIndex provided for chunk upload');
          return cb(new Error('No chunkIndex provided'), '');
        }
        const filename = `chunk-${chunkIndex}`;
        console.log('Using filename:', filename);
        cb(null, filename);
      } catch (fileError) {
        console.error('Error setting chunk filename (detailed):', fileError);
        logger.error('Error setting chunk filename:', fileError);
        cb(new Error(`Error setting chunk filename: ${fileError instanceof Error ? fileError.message : String(fileError)}`), '');
      }
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 } // Increased to 20MB per chunk for large PDFs
});

// Modified upload-chunk endpoint that uses URL query parameters instead of relying on form data
router.post('/upload-chunk', async (req: Request, res: Response) => {
  logger.info('Received chunk upload request');
  
  // Extract query parameters
  const uploadId = req.query.uploadId as string;
  const chunkIndex = req.query.chunkIndex as string;
  const totalChunks = req.query.totalChunks as string;
  
  console.log('Query parameters:', { uploadId, chunkIndex, totalChunks });
  
  if (!uploadId || chunkIndex === undefined || !totalChunks) {
    logger.error(`Missing required chunk parameters in query: uploadId=${uploadId}, chunkIndex=${chunkIndex}, totalChunks=${totalChunks}`);
    return res.status(400).json({ error: 'Missing required chunk parameters' });
  }
  
  // Check if upload ID exists
  const upload = chunkedUploads.get(uploadId);
  if (!upload) {
    logger.error(`Invalid upload ID: ${uploadId} (not found in chunkedUploads map)`);
    console.log('Current chunkedUploads keys:', Array.from(chunkedUploads.keys()));
    return res.status(400).json({ error: 'Invalid upload ID' });
  }
  
  try {
    const { userId } = ensureAuthenticated(req);
    
    logger.info(`Processing chunk ${chunkIndex}/${totalChunks} for upload ${uploadId}`);
    
    if (upload.userId !== userId) {
      logger.error(`Auth mismatch: upload user ${upload.userId} vs request user ${userId}`);
      return res.status(403).json({ error: 'Not authorized to upload to this session' });
    }
    
    // Now process with multer to handle the file upload
    chunkUpload.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          logger.error(`Chunk size exceeded limit: ${err.message}`);
          return res.status(413).json({ error: 'Chunk size exceeds limit (20MB per chunk)' });
        }
        logger.error(`Error in multer processing: ${err.message}`);
        console.error('Multer error details:', err);
        return res.status(500).json({ error: `Multer error: ${err.message}` });
      }
      
      try {
        if (!req.file) {
          logger.error(`No file found in request for chunk ${chunkIndex}`);
          return res.status(400).json({ error: 'No file data received in chunk' });
        }
        
        const chunkPath = path.join(upload.tempDir, `chunk-${chunkIndex}`);
        
        // Verify file exists on disk
        if (!fs.existsSync(chunkPath)) {
          logger.error(`Chunk file not found at path: ${chunkPath}`);
          console.error('Disk storage error - file not saved. Upload tempDir:', upload.tempDir);
          return res.status(500).json({ error: 'Chunk file not properly saved' });
        }
        
        // Record this chunk
        upload.chunks.push({
          index: parseInt(chunkIndex),
          path: chunkPath
        });
        
        logger.info(`Stored chunk ${chunkIndex} for upload ${uploadId}`);
        res.json({ success: true });
      } catch (innerError) {
        logger.error(`Error processing chunk: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
        res.status(500).json({ 
          error: 'Failed to process uploaded chunk',
          message: innerError instanceof Error ? innerError.message : String(innerError)
        });
      }
    });
  } catch (error) {
    logger.error('Error in chunk upload request:', error);
    res.status(500).json({ 
      error: 'Failed to handle upload chunk request',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Complete chunked upload
router.post('/complete-chunked-upload', async (req: Request, res: Response) => {
  try {
    const { userId, organizationId } = ensureAuthenticated(req);
    const { uploadId, processingMethod, totalChunks } = req.body;
    
    logger.info(`Completing chunked upload for ID: ${uploadId}`);
    
    if (!uploadId) {
      return res.status(400).json({ error: 'Upload ID is required' });
    }
    
    const upload = chunkedUploads.get(uploadId);
    if (!upload) {
      logger.error(`Invalid upload ID for completion: ${uploadId}`);
      return res.status(400).json({ error: 'Invalid upload ID' });
    }
    
    if (upload.userId !== userId) {
      logger.error(`Auth mismatch for upload completion: ${upload.userId} vs ${userId}`);
      return res.status(403).json({ error: 'Not authorized to complete this upload' });
    }
    
    // Sort chunks by index
    const sortedChunks = [...upload.chunks].sort((a, b) => a.index - b.index);
    
    // Verify we have the correct number of chunks
    // We don't calculate expectedTotalChunks ourselves anymore as it can vary based on client's chunk size
    // Instead, we trust the client to tell us how many chunks to expect via totalChunks parameter
    const receivedChunks = sortedChunks.length;
    logger.info(`Checking chunks: Received ${receivedChunks} chunks for upload ${uploadId}`);
    
    if (receivedChunks === 0) {
      logger.error(`No chunks received for upload ${uploadId}`);
      return res.status(400).json({ error: 'No chunks received' });
    }
    
    // Check that the highest chunk index matches expected total chunks (0-indexed)
    const highestChunkIndex = sortedChunks[sortedChunks.length - 1].index;
    const expectedChunksFromIndices = highestChunkIndex + 1; // +1 because indices are 0-based
    
    logger.info(`Highest chunk index: ${highestChunkIndex}, expected chunks from indices: ${expectedChunksFromIndices}`);
    
    if (receivedChunks !== expectedChunksFromIndices) {
      logger.error(`Missing chunks in sequence. Received ${receivedChunks} but highest index is ${highestChunkIndex}`);
      return res.status(400).json({ error: `Missing chunks in sequence. Got ${receivedChunks} but highest index is ${highestChunkIndex}` });
    }
    
    // Ensure uploads directory exists
    const uploadsDir = path.join('uploads', userId);
    fs.mkdirSync(uploadsDir, { recursive: true });
    
    // Create destination file
    const filePath = path.join(uploadsDir, upload.filename);
    logger.info(`Creating final file at: ${filePath}`);
    
    // Use a stream-based approach for merging chunks to minimize memory usage
    const writeStream = fs.createWriteStream(filePath);
    
    // Track progress
    let processedBytes = 0;
    let totalBytes = 0;
    
    // Process each chunk sequentially to avoid memory pressure
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      
      // Verify chunk exists
      if (!fs.existsSync(chunk.path)) {
        logger.error(`Chunk file missing: ${chunk.path}`);
        writeStream.end(); // Close the write stream
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Clean up the partial file
        }
        return res.status(500).json({ error: `Chunk file ${i} is missing` });
      }
      
      const chunkStats = fs.statSync(chunk.path);
      totalBytes += chunkStats.size;
      
      // Use streams to append this chunk to the final file
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunk.path);
        
        readStream.on('error', (err) => {
          logger.error(`Error reading chunk ${i}: ${err.message}`);
          reject(err);
        });
        
        readStream.on('data', (data) => {
          processedBytes += data.length;
          if (processedBytes % (10 * 1024 * 1024) === 0) { // Log every 10MB
            logger.info(`Processed ${(processedBytes / 1024 / 1024).toFixed(2)}MB / ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
          }
        });
        
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          // Clean up this chunk after successfully writing it
          try {
            fs.unlinkSync(chunk.path);
          } catch (cleanupErr) {
            logger.warn(`Failed to clean up chunk ${i}: ${cleanupErr.message}`);
          }
          resolve(undefined);
        });
      });
    }
    
    // Close the write stream after all chunks processed
    writeStream.end();
    
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => {
        logger.info(`Successfully wrote file ${upload.filename} (${totalBytes} bytes)`);
        resolve();
      });
      writeStream.on('error', (err) => {
        logger.error(`Error writing final file: ${err.message}`);
        reject(err);
      });
    });
    
    // Verify the final file size matches the expected size
    const finalStats = fs.statSync(filePath);
    if (finalStats.size !== upload.fileSize) {
      logger.warn(`File size mismatch: expected ${upload.fileSize}, got ${finalStats.size}`);
    }
    
    // Clean up temp directory
    try {
      fs.rmdirSync(upload.tempDir, { recursive: true });
    } catch (rmError) {
      logger.warn(`Failed to clean up temp directory: ${rmError.message}`);
    }
    
    // Clear from memory
    chunkedUploads.delete(uploadId);
    
    logger.info(`Completed chunked upload for ${upload.filename}`);
    
    // Return the file info for the client to process
    res.json({
      filename: upload.filename,
      path: filePath,
      size: finalStats.size,
      type: upload.fileType
    });
    
    // If processing method is specified, trigger async processing
    const method = processingMethod || upload.processingMethod;
    if (method) {
      try {
        logger.info(`Triggering async processing with method: ${method}`);
        processUploadedFile(filePath, userId, organizationId.toString(), method);
      } catch (procError) {
        logger.error(`Error triggering file processing: ${procError.message}`);
        // We don't reject the upload here, just log the error
      }
    }
    
  } catch (error) {
    logger.error('Error completing chunked upload:', error);
    res.status(500).json({ 
      error: 'Failed to complete chunked upload',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Add a cleanup task for abandoned uploads
setInterval(() => {
  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [uploadId, upload] of chunkedUploads.entries()) {
    if (now - upload.timestamp > expireTime) {
      logger.info(`Cleaning up expired upload: ${uploadId}`);
      
      // Remove temp directory
      fs.rm(upload.tempDir, { recursive: true, force: true }, (err) => {
        if (err) {
          logger.error(`Failed to remove temp directory ${upload.tempDir}:`, err);
        }
      });
      
      // Remove from map
      chunkedUploads.delete(uploadId);
    }
  }
}, 60 * 60 * 1000); // Check every hour

// Function to process uploaded files
async function processUploadedFile(filePath: string, userId: string, organizationId: string, processingMethod: string): Promise<void> {
  try {
    logger.info(`Processing uploaded file ${filePath} with method ${processingMethod}`);
    
    // Get file details
    const stats = fs.statSync(filePath);
    const fileInfo = path.parse(filePath);
    const originalFilename = fileInfo.base;
    
    // Create file data object that matches Express.Multer.File expected by fileService
    const fileData = {
      originalname: originalFilename,
      filename: originalFilename,
      path: filePath,
      mimetype: getMimeType(fileInfo.ext),
      size: stats.size,
      buffer: fs.readFileSync(filePath) // Read file into buffer
    };
    
    // Call the file service to process the file with proper type conversion
    await fileService.uploadFile(
      fileData as Express.Multer.File,
      parseInt(organizationId), // Convert to number as required
      userId.toString(), // Ensure userId is a string
      processingMethod
    );
    
    logger.info(`Successfully processed file ${filePath}`);
  } catch (error) {
    logger.error(`Error processing file ${filePath}:`, error);
    throw error;
  }
}

// Helper to get MIME type from extension
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

export default router; 