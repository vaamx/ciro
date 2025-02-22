import { Router, Request, Response } from 'express';
import multer from 'multer';
import { FileController } from '../controllers/FileController';
import { FileService } from '../services/FileService';
import { db } from '../infrastructure/database';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/security';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    try {
      const fileService = new FileService(db);
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

const fileService = new FileService(db);
const fileController = new FileController(fileService);

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

function ensureAuthenticated(req: Request): { userId: string; organizationId: number } {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const userId = req.user.id;
  const organizationId = parseInt(req.user.organizationId, 10);

  if (!userId) {
    throw new UnauthorizedError('Invalid user ID');
  }

  if (isNaN(organizationId)) {
    throw new BadRequestError('Invalid organization ID');
  }

  return { userId, organizationId };
}

// File routes
router.post('/upload', upload.single('file'), fileController.uploadFile);
router.get('/', fileController.getAllFiles);

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

router.get('/:id', fileController.getFileById);
router.delete('/:id', fileController.deleteFile);

export default router; 