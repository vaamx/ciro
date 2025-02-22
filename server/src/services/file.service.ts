import { Knex } from 'knex';
import { BadRequestError } from '../utils/errors';
import { File } from '../types/file';
import { db } from '../infrastructure/database';
import sharp from 'sharp';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = {
  'text/csv': 'csv',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image'
} as const;

type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES;

interface DBFile {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  file_type: string;
  content: Buffer | null;
  metadata: Record<string, any>;
  organization_id: number;
  uploaded_by: number;
  created_at: Date;
  updated_at: Date;
}

export class FileService {
  constructor(private readonly db: Knex = db) {}

  isFileTypeAllowed(mimeType: string): mimeType is AllowedMimeType {
    return mimeType in ALLOWED_MIME_TYPES;
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestError('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestError(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!this.isFileTypeAllowed(file.mimetype)) {
      throw new BadRequestError('Unsupported file type');
    }
  }

  private async processImage(file: Express.Multer.File): Promise<{ content: Buffer; metadata: any }> {
    const image = sharp(file.buffer);
    const metadata = await image.metadata();
    
    // Resize if image is too large
    if (metadata.width && metadata.width > 2048) {
      const content = await image.resize(2048, undefined, {
        withoutEnlargement: true,
        fit: 'inside'
      }).toBuffer();
      return { content, metadata };
    }

    return { content: file.buffer, metadata };
  }

  async uploadFile(
    file: Express.Multer.File,
    organizationId: number,
    userId: number
  ): Promise<File> {
    await this.validateFile(file);

    let content = file.buffer;
    let metadata = {};

    // Process images
    if (file.mimetype.startsWith('image/')) {
      const processed = await this.processImage(file);
      content = processed.content;
      metadata = processed.metadata;
    }

    const fileData = {
      filename: file.filename,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      size: content.length,
      file_type: ALLOWED_MIME_TYPES[file.mimetype as AllowedMimeType],
      content,
      metadata,
      organization_id: organizationId,
      uploaded_by: userId
    };

    const [insertedFile] = await this.db('files')
      .insert(fileData)
      .returning('*');

    return this.mapFileResponse(insertedFile);
  }

  async getAllFiles(organizationId: number): Promise<File[]> {
    const files = await this.db('files')
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');

    return files.map(this.mapFileResponse);
  }

  async getFileById(fileId: number, organizationId: number): Promise<File> {
    const file = await this.db('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .first();

    if (!file) {
      throw new BadRequestError('File not found');
    }

    return this.mapFileResponse(file);
  }

  async deleteFile(fileId: number, organizationId: number): Promise<void> {
    const deleted = await this.db('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .delete();

    if (!deleted) {
      throw new BadRequestError('File not found');
    }
  }

  async searchFiles(query: string, organizationId: number): Promise<File[]> {
    const files = await this.db('files')
      .where({ organization_id: organizationId })
      .where(builder => {
        builder
          .whereILike('filename', `%${query}%`)
          .orWhereILike('original_filename', `%${query}%`)
          .orWhereILike('file_type', `%${query}%`);
      })
      .orderBy('created_at', 'desc');

    return files.map(this.mapFileResponse);
  }

  async getFileContent(fileId: number, organizationId: number): Promise<Buffer> {
    const file = await this.db('files')
      .where({ 
        id: fileId,
        organization_id: organizationId 
      })
      .select('content')
      .first();

    if (!file || !file.content) {
      throw new BadRequestError('File content not found');
    }

    return file.content;
  }

  private mapFileResponse(file: DBFile): File {
    const { content, ...fileData } = file;
    return {
      ...fileData,
      hasContent: !!content
    };
  }
} 