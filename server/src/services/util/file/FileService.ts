import { Knex } from 'knex';
import { BadRequestError } from '../../../utils/errors';
import { File } from '../../../types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = {
  'text/csv': 'csv',
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel'
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
  uploaded_by: string;
  created_at: Date;
  updated_at: Date;
}

export class FileService {
  constructor(private readonly db: Knex) {}

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

  async uploadFile(
    file: Express.Multer.File,
    organizationId: number,
    userId: string
  ): Promise<File> {
    await this.validateFile(file);

    if (!this.isFileTypeAllowed(file.mimetype)) {
      throw new BadRequestError('Unsupported file type');
    }

    // Generate a unique filename if one is not provided
    const timestamp = Date.now();
    const filename = file.filename || `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const fileData = {
      filename,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      file_type: ALLOWED_MIME_TYPES[file.mimetype],
      content: file.buffer,
      organization_id: organizationId,
      uploaded_by: userId,
      metadata: {}
    };

    const [insertedFile] = await this.db('files')
      .insert(fileData)
      .returning('*');

    return this.mapFileResponse(insertedFile);
  }

  async getAllFiles(organizationId: number | null): Promise<File[]> {
    if (!organizationId) {
      return [];
    }
    
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

  async updateFileMetadata(fileId: string, updateData: { metadata: Record<string, any> }): Promise<File> {
    const [updatedFile] = await this.db('files')
      .where({ id: fileId })
      .update({
        metadata: updateData.metadata,
        updated_at: this.db.fn.now()
      })
      .returning('*');

    if (!updatedFile) {
      throw new BadRequestError('File not found');
    }

    return this.mapFileResponse(updatedFile);
  }

  private mapFileResponse(file: DBFile): File {
    const { content, ...fileData } = file;
    return {
      ...fileData,
      hasContent: !!content
    };
  }
} 