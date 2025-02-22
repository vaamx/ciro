import { Request, Response } from 'express';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import { FileService } from '../services/FileService';
import { db } from '../infrastructure/db';

class FileController {
  constructor(private fileService: FileService = new FileService(db)) {}

  private ensureAuthenticated(req: Request): { userId: string; organizationId: number } {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userId = req.user.id;
    const organizationId = req.user.organizationId ? parseInt(req.user.organizationId, 10) : null;

    if (!userId) {
      throw new UnauthorizedError('Invalid user ID');
    }

    if (!organizationId) {
      throw new BadRequestError('Organization ID is required to upload files. Please create or join an organization first.');
    }

    return { userId, organizationId };
  }

  uploadFile = async (req: Request, res: Response): Promise<void> => {
    const { userId, organizationId } = this.ensureAuthenticated(req);

    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const file = await this.fileService.uploadFile(req.file, organizationId, userId);
    res.status(201).json(file);
  };

  getAllFiles = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = this.ensureAuthenticated(req);
    
    if (!organizationId) {
      // Return empty array if user has no organization
      res.json([]);
      return;
    }

    const files = await this.fileService.getAllFiles(organizationId);
    res.json(files);
  };
}

export default new FileController(); 