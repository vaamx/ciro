import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DocumentPipelineService } from '@services/ingestion/document-pipeline.service';
import fs from 'fs';
import path from 'path';
import { FileType } from '../../types';
import { getFileType } from '../../common/utils/file-utils';
import { v4 as uuidv4 } from 'uuid';

interface ChunkInfo {
  fileId: string;
  index: number;
  total: number;
  path: string;
  mimeType: string;
  fileName: string;
}

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

@Injectable()
export class ChunkService {
  private readonly logger = new Logger(ChunkService.name);
  private chunkRegistry: Map<string, ChunkInfo[]> = new Map();

  constructor(
    private readonly documentPipelineService: DocumentPipelineService
  ) {
    this.logger.log('ChunkService initialized');
  }

  async storeChunk(fileId: string, index: number, total: number, mimeType: string, fileName: string, fileBuffer: Buffer): Promise<void> {
    const chunkPath = path.join(TEMP_DIR, `${fileId}-${index}`);
    await fs.promises.writeFile(chunkPath, fileBuffer);

    if (!this.chunkRegistry.has(fileId)) {
      this.chunkRegistry.set(fileId, []);
    }

    const chunks = this.chunkRegistry.get(fileId)!;
    chunks.push({
      fileId,
      index,
      total,
      path: chunkPath,
      mimeType,
      fileName,
    });

    chunks.sort((a, b) => a.index - b.index);
    this.logger.log(`Stored chunk ${index + 1}/${total} for file ${fileId} at ${chunkPath}`);
  }

  async processCompleteUpload(fileId: string, dataSourceId: string, userId: string, requestMetadata: any): Promise<{ documentId: string | null; jobId: string | number }> {
    const chunks = this.chunkRegistry.get(fileId);

    if (!chunks || chunks.length === 0) {
      throw new BadRequestException(`No chunks found for file ID: ${fileId}`);
    }

    chunks.sort((a, b) => a.index - b.index);

    const expectedTotal = chunks[0].total;
    if (chunks.length !== expectedTotal) {
      this.cleanupChunks(chunks, fileId);
      this.chunkRegistry.delete(fileId);
      throw new BadRequestException(`Missing chunks for file ID ${fileId}. Expected ${expectedTotal}, got ${chunks.length}`);
    }

    let combinedFilePath: string | null = null;
    try {
      combinedFilePath = await this.combineChunksToFile(chunks, fileId);

      const firstChunk = chunks[0];
      const mimeType = requestMetadata?.mimeType || firstChunk.mimeType || 'application/octet-stream';
      const originalFilename = requestMetadata?.filename || firstChunk.fileName || `${fileId}-combined`;
      const fileExtension = path.extname(originalFilename).toLowerCase() || requestMetadata?.fileExtension || '';

      const fileType = this.determineFileType(requestMetadata, mimeType, fileExtension, dataSourceId);

      this.logger.log(`Processing combined file ${originalFilename} (Path: ${combinedFilePath}, Type: ${fileType}) for data source ${dataSourceId}`);

      const processingMetadata = {
        ...requestMetadata,
        originalFilename,
        mimeType,
        fileExtension,
        userId,
        chunkedUploadFileId: fileId,
      };

      const processingResult = await this.documentPipelineService.processDocumentStream(
        combinedFilePath,
        fileType,
        dataSourceId,
        processingMetadata
      );

      this.logger.log(`Successfully submitted combined file ${fileId} (Job ID: ${processingResult.jobId}) for processing.`);

      this.cleanupChunks(chunks, fileId);
      this.chunkRegistry.delete(fileId);

      return { documentId: null, jobId: processingResult.jobId };

    } catch (error) {
      this.logger.error(`Error processing complete upload for file ${fileId}: ${error}`, error instanceof Error ? error.stack : undefined);
      if (chunks) {
        this.cleanupChunks(chunks, fileId);
      }
      if (combinedFilePath) {
        fs.unlink(combinedFilePath, err => {
          if (err) this.logger.warn(`Failed to delete combined temp file ${combinedFilePath}: ${err.message}`);
        });
      }
      this.chunkRegistry.delete(fileId);
      if (error instanceof BadRequestException) {
          throw error;
      }
      throw new InternalServerErrorException(`Failed to process chunked upload for file ID ${fileId}`);
    }
  }

  private async combineChunksToFile(chunks: ChunkInfo[], fileId: string): Promise<string> {
    const combinedFileName = `${fileId}-${uuidv4()}-combined`;
    const combinedFilePath = path.join(TEMP_DIR, combinedFileName);
    const writeStream = fs.createWriteStream(combinedFilePath);

    this.logger.log(`Combining ${chunks.length} chunks into temporary file: ${combinedFilePath}`);

    try {
        for (const chunk of chunks) {
            const readStream = fs.createReadStream(chunk.path);
            await new Promise<void>((resolve, reject) => {
                readStream.pipe(writeStream, { end: false });
                readStream.on('end', () => resolve());
                readStream.on('error', reject);
                writeStream.on('error', reject);
            });
            readStream.close();
        }
        writeStream.end();

        await new Promise<void>((resolve, reject) => {
            const finishHandler = () => {
                cleanup();
                resolve();
            };
            const errorHandler = (err: Error) => {
                cleanup();
                reject(err);
            };
            const cleanup = () => {
                writeStream.removeListener('finish', finishHandler);
                writeStream.removeListener('error', errorHandler);
            };

            writeStream.on('finish', finishHandler);
            writeStream.on('error', errorHandler);
        });

        this.logger.log(`Successfully combined chunks into ${combinedFilePath}`);
        return combinedFilePath;
    } catch (error) {
        this.logger.error(`Error combining chunks for file ${fileId} to ${combinedFilePath}: ${error}`);
        try {
            if (!writeStream.destroyed) {
                writeStream.end();
                await new Promise<void>(resolve => writeStream.once('close', () => resolve()));
            }
            if (fs.existsSync(combinedFilePath)) {
                 await fs.promises.unlink(combinedFilePath);
            }
        } catch (cleanupError) {
            this.logger.warn(`Failed to cleanup partially combined file ${combinedFilePath}: ${cleanupError}`);
        }
        throw error;
    }
  }

  private cleanupChunks(chunks: ChunkInfo[], fileId: string): void {
    if (!chunks || chunks.length === 0) return;
    this.logger.log(`Cleaning up ${chunks.length} chunk files for upload ${fileId}`);
    chunks.forEach(chunk => {
      fs.unlink(chunk.path, err => {
        if (err) {
          this.logger.warn(`[${fileId}] Failed to delete chunk file ${chunk.path}: ${err.message}`);
        } else {
          this.logger.debug(`[${fileId}] Deleted chunk file ${chunk.path}`);
        }
      });
    });
  }

  private determineFileType(metadata: any, mimeType: string, extension: string, dataSourceId: string): FileType {
    const validTypes: FileType[] = [
      'text', 'markdown', 'pdf', 'docx', 'json', 'csv', 'html', 'xml', 'yaml', 'code', 'pptx', 'xlsx', 'excel'
    ];

    if (metadata?.fileType) {
       if (validTypes.includes(metadata.fileType)) {
         return metadata.fileType as FileType;
       }
       this.logger.warn(`Invalid fileType '${metadata.fileType}' in metadata. Falling back.`);
    }
    try {
      return getFileType(extension, mimeType);
    } catch (e) {
      this.logger.warn(`Could not determine file type for mime: ${mimeType}, ext: ${extension}. Falling back to text. Error: ${e}`);
      return 'text';
    }
  }
} 