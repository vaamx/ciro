import { Router } from 'express';
import multer from 'multer';
import { FileController } from '../controllers/FileController';
import { FileService } from '../services/FileService';
import { db } from '../infrastructure/database';
import { authenticate } from '../middleware/auth';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

const fileService = new FileService(db);
const fileController = new FileController(fileService);

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// File routes
router.post('/upload', upload.single('file'), fileController.uploadFile);
router.get('/', fileController.getAllFiles);
router.get('/:id', fileController.getFileById);
router.delete('/:id', fileController.deleteFile);

export default router; 