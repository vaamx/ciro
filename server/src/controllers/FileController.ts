import { Request, Response } from 'express';
import { FileService } from '../services/FileService';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export class FileController {
  constructor(private readonly fileService: FileService) {}

  private ensureAuthenticated(req: Request): { userId: string; organizationId: number } {
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
    const files = await this.fileService.getAllFiles(organizationId);
    res.json(files);
  };

  getFileById = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = this.ensureAuthenticated(req);
    const fileId = parseInt(req.params.id, 10);
    
    if (isNaN(fileId)) {
      throw new BadRequestError('Invalid file ID');
    }

    const file = await this.fileService.getFileById(fileId, organizationId);
    res.json(file);
  };

  deleteFile = async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = this.ensureAuthenticated(req);
    const fileId = parseInt(req.params.id, 10);
    
    if (isNaN(fileId)) {
      throw new BadRequestError('Invalid file ID');
    }

    await this.fileService.deleteFile(fileId, organizationId);
    res.status(204).send();
  };
} 