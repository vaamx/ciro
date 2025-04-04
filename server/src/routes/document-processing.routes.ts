import { Router } from '../types/express-types';
import { DocumentProcessingController } from '../controllers/document-processing.controller';
import { authenticate } from '../middleware/auth';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 150 * 1024 * 1024, // 150MB limit (increased from 50MB)
  },
});

const router = Router();
const documentProcessingController = new DocumentProcessingController();

// Routes requiring authentication
router.post(
  '/jobs',
  authenticate, 
  upload.single('file'),
  (req, res) => documentProcessingController.createJob(req, res)
);

// Get job status - doesn't require auth to allow frontend polling
router.get(
  '/jobs/:jobId',
  (req, res) => documentProcessingController.getJobStatus(req, res)
);

// Get all jobs for a data source
router.get(
  '/data-sources/:dataSourceId/jobs',
  authenticate,
  (req, res) => documentProcessingController.getDataSourceJobs(req, res)
);

// Cancel a job
router.post(
  '/jobs/:jobId/cancel',
  authenticate,
  (req, res) => documentProcessingController.cancelJob(req, res)
);

// Get processing metrics
router.get(
  '/metrics',
  authenticate,
  (req, res) => documentProcessingController.getProcessingMetrics(req, res)
);

export default router; 