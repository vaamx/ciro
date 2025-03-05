import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { QdrantService } from '../services/qdrant.service';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { DocumentProcessorService } from '../services/document-processor.service';
import { FileType } from '../types/file-types';
import { OpenAIService } from '../services/openai.service';

const router = Router();
const documentProcessor = DocumentProcessorService.getInstance();
const qdrantService = QdrantService.getInstance();
const openAIService = OpenAIService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticate);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const originalName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '');
    const timestamp = Date.now();
    const uniqueSuffix = `${timestamp}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${originalName}-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      '.pdf', '.docx', '.xlsx', '.xls', '.csv', '.json', '.pptx', '.txt', '.md'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Supported types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Define the upload endpoint
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    
    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const file = req.file;
    const filePath = file.path;
    const extension = path.extname(file.originalname).toLowerCase();
    
    // Map file extension to file type
    let fileType: FileType = 'pdf'; // Default
    if (['.pdf'].includes(extension)) {
      fileType = 'pdf';
    } else if (['.docx', '.doc'].includes(extension)) {
      fileType = 'docx';
    } else if (['.xlsx', '.xls'].includes(extension)) {
      fileType = 'excel';
    } else if (['.csv'].includes(extension)) {
      fileType = 'csv';
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
    
    // Generate a unique ID for the data source
    const dataSourceId = uuidv4();
    
    // Insert file record into database
    const fileResult = await pool.query(
      `INSERT INTO files 
       (name, original_name, path, mime_type, size, user_id, organization_id, status, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id`,
      [
        file.filename,
        file.originalname,
        filePath,
        file.mimetype,
        file.size,
        userId,
        organizationId,
        'uploaded',
        JSON.stringify({ dataSourceId })
      ]
    );
    
    const fileId = fileResult.rows[0].id;
    
    // Generate a collection name based on the numerical ID
    const collectionName = documentProcessor.getCollectionName(fileId.toString());
    
    // Create the collection in Qdrant
    await qdrantService.createCollection(collectionName, {
      vectors: {
        size: 1536, // OpenAI embeddings dimensions
        distance: 'Cosine'
      }
    });
    
    // Start background processing
    // Note: In a production system, this would be handled by a queue/worker system
    processFileInBackground(filePath, fileType, collectionName, fileId);
    
    res.status(201).json({
      id: fileId,
      name: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      status: 'processing',
      metadata: {
        collectionName
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      message: error.message
    });
  }
}));

// Utility function for background processing
async function processFileInBackground(
  filePath: string,
  fileType: FileType,
  collectionName: string,
  fileId: number
) {
  try {
    console.log(`Starting background processing for file ${fileId} (${filePath})`);
    
    // Update status to processing
    await pool.query(
      `UPDATE files SET status = $1, metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{collectionName}', $2::jsonb) WHERE id = $3`,
      ['processing', JSON.stringify(collectionName), fileId]
    );
    
    // Process the document
    await documentProcessor.processDocument(filePath, fileType, collectionName);
    
    // Update status to processed
    await pool.query(
      `UPDATE files SET status = $1 WHERE id = $2`,
      ['processed', fileId]
    );
    
    console.log(`File ${fileId} processed successfully`);
  } catch (error) {
    console.error(`Error processing file ${fileId}:`, error);
    
    // Update status to error
    await pool.query(
      `UPDATE files SET status = $1, metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', $2::jsonb) WHERE id = $3`,
      ['error', JSON.stringify({ message: error.message }), fileId]
    );
  }
}

// Get all uploaded files
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  
  if (!userId || !organizationId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const filesResult = await pool.query(
    `SELECT * FROM files WHERE organization_id = $1 ORDER BY created_at DESC`,
    [organizationId]
  );
  
  res.json(filesResult.rows);
}));

// Get file by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  const fileId = req.params.id;
  
  if (!userId || !organizationId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const fileResult = await pool.query(
    `SELECT * FROM files WHERE id = $1 AND organization_id = $2`,
    [fileId, organizationId]
  );
  
  if (fileResult.rows.length === 0) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.json(fileResult.rows[0]);
}));

// Delete file
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  const fileId = req.params.id;
  
  if (!userId || !organizationId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Get file info
  const fileResult = await pool.query(
    `SELECT * FROM files WHERE id = $1 AND organization_id = $2`,
    [fileId, organizationId]
  );
  
  if (fileResult.rows.length === 0) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const file = fileResult.rows[0];
  const collectionName = file.metadata?.collectionName;
  
  // Delete the collection if it exists
  if (collectionName) {
    try {
      await qdrantService.deleteCollection(collectionName);
    } catch (error) {
      console.error(`Error deleting collection ${collectionName}:`, error);
      // Continue with file deletion even if collection deletion fails
    }
  }
  
  // Delete the file record
  await pool.query(
    `DELETE FROM files WHERE id = $1`,
    [fileId]
  );
  
  // Delete the file from disk
  try {
    const fs = require('fs').promises;
    await fs.unlink(file.path);
  } catch (error) {
    console.error(`Error deleting file from disk:`, error);
    // Continue even if file deletion fails
  }
  
  res.status(204).send();
}));

export default router; 