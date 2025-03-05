import { Request, Response } from 'express';
import * as multer from 'multer';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { FileService } from '../services/file.service';
import { config } from '../config';

export class UploadController {
  private readonly logger = console;
  private readonly uploadDir: string;
  private upload: multer.Multer;

  constructor() {
    this.uploadDir = config.uploadsDir || 'uploads';
    
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadDir}`);
    }

    // Configure multer
    this.upload = multer.default({
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, this.uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
          cb(null, uniqueFilename);
        }
      })
    });
  }

  // Middleware to handle file upload
  getUploadMiddleware() {
    return this.upload.single('file');
  }

  async uploadFile(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get user info from auth middleware
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Create file record
      const fileRecord = {
        id: uuidv4(),
        originalFilename: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
        userId: userId,
        organizationId: organizationId,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };

      // Store file record in database
      // TODO: Implement database storage

      return res.status(201).json({
        id: fileRecord.id,
        originalFilename: fileRecord.originalFilename,
        size: fileRecord.size,
        mimeType: fileRecord.mimeType,
        uploadedAt: fileRecord.uploadedAt,
        status: fileRecord.status
      });
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      return res.status(500).json({ error: 'Failed to upload file' });
    }
  }

  async getFileStatus(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }

      // TODO: Implement file status retrieval from database

      return res.status(200).json({
        id: fileId,
        status: 'processing',
        progress: 50
      });
    } catch (error) {
      this.logger.error('Error getting file status:', error);
      return res.status(500).json({ error: 'Failed to get file status' });
    }
  }

  async getUserFiles(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // TODO: Implement user files retrieval from database

      return res.status(200).json({
        files: [],
        total: 0,
        limit,
        offset
      });
    } catch (error) {
      this.logger.error('Error getting user files:', error);
      return res.status(500).json({ error: 'Failed to get user files' });
    }
  }

  async deleteFile(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // TODO: Implement file deletion from database and storage

      return res.status(204).send();
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      return res.status(500).json({ error: 'Failed to delete file' });
    }
  }
} 