import express from 'express';
import { authenticate } from '../middleware/auth';
import { OpenAIService } from '../services/openai.service';
import { createLogger } from '../utils/logger';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { db } from '../infrastructure/database';

const router = express.Router();
const logger = createLogger('FineTuningRoutes');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'fine-tuning');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept JSON and JSONL files
    if (file.mimetype === 'application/json' || 
        path.extname(file.originalname) === '.jsonl' ||
        path.extname(file.originalname) === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON and JSONL files are allowed'));
    }
  }
});

// Apply authentication middleware to all routes
router.use(authenticate);

// Get an instance of the OpenAI service with database connection
const openAIService = new OpenAIService(db);

/**
 * @route   GET /api/fine-tuning/models
 * @desc    Get available models for fine-tuning
 * @access  Private
 */
router.get('/models', async (req, res) => {
  try {
    const models = await openAIService.getAvailableFineTuningModels();
    res.json({ success: true, data: models });
  } catch (error) {
    logger.error('Error fetching fine-tuning models', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch fine-tuning models',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route   GET /api/fine-tuning/jobs
 * @desc    List all fine-tuning jobs
 * @access  Private
 */
router.get('/jobs', async (req, res) => {
  try {
    const { limit, after, status } = req.query;
    
    const jobs = await openAIService.listFineTuningJobs({
      limit: limit ? parseInt(limit as string, 10) : undefined,
      after: after as string,
      status: status as string
    });
    
    res.json({ success: true, data: jobs });
  } catch (error) {
    logger.error('Error fetching fine-tuning jobs', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch fine-tuning jobs',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route   GET /api/fine-tuning/jobs/:jobId
 * @desc    Get details of a specific fine-tuning job
 * @access  Private
 */
router.get('/jobs/:jobId', 
  param('jobId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
      const { jobId } = req.params;
      const job = await openAIService.getFineTuningJob(jobId);
      res.json({ success: true, data: job });
    } catch (error) {
      logger.error(`Error fetching fine-tuning job ${req.params.jobId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch fine-tuning job',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route   GET /api/fine-tuning/jobs/:jobId/events
 * @desc    Get events for a specific fine-tuning job
 * @access  Private
 */
router.get('/jobs/:jobId/events',
  param('jobId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
      const { jobId } = req.params;
      const { limit, after } = req.query;
      
      const events = await openAIService.getFineTuningJobEvents(jobId, {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        after: after as string
      });
      
      res.json({ success: true, data: events });
    } catch (error) {
      logger.error(`Error fetching events for fine-tuning job ${req.params.jobId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch fine-tuning job events',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route   POST /api/fine-tuning/jobs
 * @desc    Create a new fine-tuning job
 * @access  Private
 */
router.post('/jobs',
  body('model').isString().notEmpty(),
  body('training_file').isString().notEmpty(),
  body('suffix').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
      const jobResponse = await openAIService.createFineTuningJob(req.body);
      res.status(201).json({ success: true, data: jobResponse });
    } catch (error) {
      logger.error('Error creating fine-tuning job', {
        error: error instanceof Error ? error.message : String(error),
        payload: req.body
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create fine-tuning job',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route   POST /api/fine-tuning/upload
 * @desc    Upload a file for fine-tuning
 * @access  Private
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded'
      });
    }
    
    const uploadedFile = req.file;
    const filePath = uploadedFile.path;
    
    // Upload file to OpenAI
    const openaiFile = await openAIService.uploadFile(filePath, 'fine-tune');
    
    // Return success response with file details
    res.status(201).json({ 
      success: true, 
      data: {
        id: openaiFile.id,
        filename: uploadedFile.originalname,
        purpose: openaiFile.purpose,
        bytes: openaiFile.bytes,
        created_at: openaiFile.created_at
      }
    });
  } catch (error) {
    logger.error('Error uploading file for fine-tuning', {
      error: error instanceof Error ? error.message : String(error),
      file: req.file?.originalname
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route   POST /api/fine-tuning/cancel/:jobId
 * @desc    Cancel a fine-tuning job
 * @access  Private
 */
router.post('/cancel/:jobId',
  param('jobId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
      const { jobId } = req.params;
      const result = await openAIService.cancelFineTuningJob(jobId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error cancelling fine-tuning job ${req.params.jobId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to cancel fine-tuning job',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * @route   POST /api/fine-tuning/dataset-from-conversations
 * @desc    Create a fine-tuning dataset from chat conversations
 * @access  Private
 */
router.post('/dataset-from-conversations',
  body('session_ids').isArray().notEmpty(),
  body('output_name').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    try {
      const { session_ids, output_name } = req.body;
      
      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), 'uploads', 'fine-tuning');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Generate output filename
      const filename = output_name || `dataset-${Date.now()}.jsonl`;
      const outputPath = path.join(outputDir, filename);
      
      // Create dataset
      await openAIService.createFineTuningDatasetFromConversations(session_ids, outputPath);
      
      // Upload file to OpenAI
      const openaiFile = await openAIService.uploadFile(outputPath, 'fine-tune');
      
      res.status(201).json({
        success: true,
        data: {
          file_id: openaiFile.id,
          filename,
          purpose: openaiFile.purpose,
          bytes: openaiFile.bytes,
          created_at: openaiFile.created_at,
          path: outputPath
        }
      });
    } catch (error) {
      logger.error('Error creating dataset from conversations', {
        error: error instanceof Error ? error.message : String(error),
        payload: req.body
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create dataset from conversations',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router; 