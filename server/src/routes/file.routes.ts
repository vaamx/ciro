import { Router, Request, Response } from 'express';
import multer from 'multer';
import { fileService } from '../services/file.service';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/security';

// Extend the Express Request type to include our user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: fileService.getMaxFileSize(),
  },
  fileFilter: (req, file, cb) => {
    if (fileService.isFileTypeAllowed(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// Upload a file
router.post(
  '/upload',
  authenticate,
  rateLimiter,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const metadata = await fileService.uploadFile(req.file, req.user.id);
      res.status(201).json(metadata);
    } catch (error) {
      console.error('File upload error:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
);

// Search files
router.get(
  '/search',
  authenticate,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const files = await fileService.searchFiles(query, req.user.id);
      res.json(files);
    } catch (error) {
      console.error('File search error:', error);
      res.status(500).json({ error: 'Failed to search files' });
    }
  }
);

// Download a file
router.get('/:fileId', async (req: Request, res: Response) => {
  try {
    const fileHandle = await fileService.getFileStream(req.params.fileId);
    const stream = fileHandle.createReadStream();
    
    stream.on('end', () => {
      fileHandle.close();
    });

    stream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Delete a file
router.delete(
  '/:fileId',
  authenticate,
  rateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await fileService.deleteFile(req.params.fileId, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error('File deletion error:', error);
      res.status(404).json({ error: 'File not found' });
    }
  }
);

export default router; 