import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import sharp from 'sharp';
import type { Multer } from 'multer';
import { pool } from '../infrastructure/database';
import { openai } from './openai.service';
import { createReadStream } from 'fs';
import { PDFExtract, PDFExtractResult } from 'pdf.js-extract';
import { Readable } from 'stream';

type File = Express.Multer.File;
type FileStatus = 'processing' | 'ready' | 'error';

interface PDFPage {
  content: string;
  [key: string]: any;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  userId: number;
  status: FileStatus;
  contentType?: string;
  contentText?: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class FileService {
  private static instance: FileService;
  private uploadDir: string;
  private allowedTypes: Set<string>;
  private maxFileSize: number;
  private pdfExtract: PDFExtract;

  private constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]);
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.pdfExtract = new PDFExtract();
    this.initializeStorage();
  }

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  private async initializeStorage() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'thumbnails'), { recursive: true });
    }
  }

  private validateFile(file: File): void {
    if (!this.allowedTypes.has(file.mimetype)) {
      throw new Error('File type not allowed');
    }

    if (file.size > this.maxFileSize) {
      throw new Error('File size exceeds limit');
    }
  }

  private async generateThumbnail(file: File): Promise<string | undefined> {
    if (!file.mimetype.startsWith('image/')) {
      return undefined;
    }

    const fileId = uuidv4();
    const thumbnailPath = path.join(this.uploadDir, 'thumbnails', `${fileId}.jpg`);

    await sharp(file.buffer)
      .resize(200, 200, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return `/files/thumbnails/${fileId}.jpg`;
  }

  private async compressImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    if (!mimeType.startsWith('image/')) {
      return buffer;
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (metadata.width && metadata.width > 2048) {
      image.resize(2048, undefined, { fit: 'inside' });
    }

    if (mimeType === 'image/jpeg') {
      return image.jpeg({ quality: 85 }).toBuffer();
    } else if (mimeType === 'image/png') {
      return image.png({ compressionLevel: 8 }).toBuffer();
    }

    return buffer;
  }

  private async extractText(file: File): Promise<string | undefined> {
    try {
      if (file.mimetype === 'text/plain') {
        return file.buffer.toString('utf-8');
      }

      if (file.mimetype === 'application/pdf') {
        const tempPath = path.join(this.uploadDir, 'temp', `${uuidv4()}.pdf`);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, file.buffer);
        
        const data = await this.pdfExtract.extract(tempPath);
        await fs.unlink(tempPath);
        
        return data.pages
          .map(page => page.content.map(text => text.str).join(' '))
          .join('\n');
      }

      // Add more document type handlers here

      return undefined;
    } catch (error) {
      console.error('Text extraction error:', error);
      return undefined;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit text length
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      return [];
    }
  }

  async uploadFile(file: File, userId: number): Promise<FileMetadata> {
    this.validateFile(file);

    const fileId = uuidv4();
    const fileExt = path.extname(file.originalname);
    const fileName = `${fileId}${fileExt}`;
    const filePath = path.join(this.uploadDir, fileName);

    // Compress image if applicable
    const processedBuffer = await this.compressImage(file.buffer, file.mimetype);
    await fs.writeFile(filePath, processedBuffer);

    const thumbnailUrl = await this.generateThumbnail(file);

    // Initial database entry
    const result = await pool.query(
      `INSERT INTO files (
        id, original_name, mime_type, size, url, thumbnail_url, 
        user_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        fileId,
        file.originalname,
        file.mimetype,
        processedBuffer.length,
        `/files/${fileName}`,
        thumbnailUrl,
        userId,
        'processing'
      ]
    );

    const metadata = result.rows[0];

    // Process file asynchronously
    this.processFile(fileId, file).catch(console.error);

    return {
      id: metadata.id,
      originalName: metadata.original_name,
      mimeType: metadata.mime_type,
      size: metadata.size,
      url: metadata.url,
      thumbnailUrl: metadata.thumbnail_url,
      userId: metadata.user_id,
      status: metadata.status,
      createdAt: metadata.created_at,
      updatedAt: metadata.updated_at
    };
  }

  private async processFile(fileId: string, file: File): Promise<void> {
    try {
      // Extract text content
      const contentText = await this.extractText(file);
      
      if (contentText) {
        // Generate embedding
        const embedding = await this.generateEmbedding(contentText);

        // Update database with processed data
        await pool.query(
          `UPDATE files 
           SET status = $1, content_text = $2, embedding = $3
           WHERE id = $4`,
          ['ready', contentText, embedding, fileId]
        );
      } else {
        await pool.query(
          `UPDATE files SET status = $1 WHERE id = $2`,
          ['ready', fileId]
        );
      }
    } catch (error) {
      console.error('File processing error:', error);
      await pool.query(
        `UPDATE files SET status = $1 WHERE id = $2`,
        ['error', fileId]
      );
    }
  }

  async deleteFile(fileId: string, userId: number): Promise<void> {
    const result = await pool.query(
      'DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING url, thumbnail_url',
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('File not found or unauthorized');
    }

    const { url, thumbnail_url } = result.rows[0];

    // Delete physical files
    const filePath = path.join(this.uploadDir, path.basename(url));
    await fs.unlink(filePath);

    if (thumbnail_url) {
      const thumbnailPath = path.join(this.uploadDir, 'thumbnails', path.basename(thumbnail_url));
      try {
        await fs.unlink(thumbnailPath);
      } catch {
        // Ignore if thumbnail doesn't exist
      }
    }
  }

  async getFileStream(fileId: string): Promise<fs.FileHandle> {
    const result = await pool.query(
      'SELECT url FROM files WHERE id = $1',
      [fileId]
    );

    if (result.rows.length === 0) {
      throw new Error('File not found');
    }

    const filePath = path.join(this.uploadDir, path.basename(result.rows[0].url));
    return fs.open(filePath, 'r');
  }

  async searchFiles(query: string, userId: number): Promise<FileMetadata[]> {
    try {
      const embedding = await this.generateEmbedding(query);
      
      const result = await pool.query(
        `SELECT *, (embedding <=> $1) as similarity
         FROM files
         WHERE user_id = $2 AND embedding IS NOT NULL
         ORDER BY similarity
         LIMIT 10`,
        [embedding, userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        originalName: row.original_name,
        mimeType: row.mime_type,
        size: row.size,
        url: row.url,
        thumbnailUrl: row.thumbnail_url,
        userId: row.user_id,
        status: row.status,
        contentType: row.content_type,
        contentText: row.content_text,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('File search error:', error);
      return [];
    }
  }

  isFileTypeAllowed(mimeType: string): boolean {
    return this.allowedTypes.has(mimeType);
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }
}

export const fileService = FileService.getInstance(); 