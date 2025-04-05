import { Response, FileType } from '../types';
import { BadRequestError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { pool } from '../config/database';
import { DocumentPipelineService } from '../services/data-processing/document-pipeline.service';
import { getContentType, getFileType } from '../utils/file-utils';
import { createServiceLogger } from '../utils/logger-factory';

// Define our own UnstructuredElement type since we've replaced the original service
export interface UnstructuredElement {
  type: string;
  text: string;
  [key: string]: any;
}

// Directory to store temporary chunks
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Create the temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

interface ChunkInfo {
  fileId: string;
  index: number;
  total: number;
  path: string;
  mimeType: string;
}

export class ChunkController {
  private chunkRegistry: Map<string, ChunkInfo[]>;
  private documentPipelineService: DocumentPipelineService;
  private logger = createServiceLogger('ChunkController');

  constructor(private readonly documentPipelineService: DocumentPipelineService) {
    this.chunkRegistry = new Map();
    this.documentPipelineService = this.documentPipelineService;
    this.logger.info('ChunkController initialized (Unstructured API and LlamaIndex disabled)');
  }

  async uploadChunk(req: AuthRequest, res: Response) {
    try {
      const fileId = req.headers['x-file-id'] as string;
      const chunkIndex = parseInt(req.headers['x-chunk-index'] as string);
      const totalChunks = parseInt(req.headers['x-total-chunks'] as string);
      
      // Use the explicit content type header if provided, otherwise fallback to the file's mimetype
      const contentType = req.headers['x-content-type'] as string;
      const fileName = req.headers['x-file-name'] as string || '';
      const mimeType = contentType || req.file?.mimetype || getContentType(fileName) || 'application/octet-stream';

      if (!fileId || isNaN(chunkIndex) || isNaN(totalChunks)) {
        throw new BadRequestError('Missing or invalid chunk information');
      }

      if (!req.file) {
        throw new BadRequestError('No chunk data provided');
      }

      console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}`, {
        size: req.file.size,
        mimeType,
        fileName,
        contentTypeHeader: contentType || 'not provided'
      });

      // Create a unique filename for this chunk
      const chunkPath = path.join(TEMP_DIR, `${fileId}-${chunkIndex}`);
      
      // Save the chunk to disk
      await fs.promises.writeFile(chunkPath, req.file.buffer);

      // Register the chunk
      if (!this.chunkRegistry.has(fileId)) {
        this.chunkRegistry.set(fileId, []);
      }
      
      const chunks = this.chunkRegistry.get(fileId)!;
      chunks.push({
        fileId,
        index: chunkIndex,
        total: totalChunks,
        path: chunkPath,
        mimeType
      });

      // Sort chunks by index to maintain order
      chunks.sort((a, b) => a.index - b.index);

      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} saved successfully`);

      res.json({
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} received`,
        progress: ((chunkIndex + 1) / totalChunks) * 100
      });
    } catch (error: unknown) {
      console.error('Error uploading chunk:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async completeChunkedUpload(req: AuthRequest, res: Response) {
    // Try to get values from the request body first, fallback to headers if necessary
    const fileId = req.body?.fileId || req.headers['x-file-id'];
    const dataSourceId = req.body?.dataSourceId || req.headers['x-data-source-id'];
    const requestMetadata = req.body?.metadata || {};

    if (!fileId || !dataSourceId) {
      console.error('Missing required parameters for chunk upload completion', {
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        headers: {
          'x-file-id': req.headers['x-file-id'],
          'x-data-source-id': req.headers['x-data-source-id'],
          'content-type': req.headers['content-type']
        }
      });
      throw new BadRequestError('File ID and Data Source ID are required');
    }

    const chunks = this.chunkRegistry.get(fileId);
    if (!chunks || chunks.length === 0) {
      throw new BadRequestError('No chunks found for this file');
    }

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    // Verify we have all chunks
    const expectedTotal = chunks[0].total;
    if (chunks.length !== expectedTotal) {
      throw new BadRequestError(`Missing chunks. Expected ${expectedTotal}, got ${chunks.length}`);
    }

    // Define uploadedBy variable at a higher scope
    let uploadedBy = null;
    let dbFileId = '';

    try {
      // Combine chunks into a single buffer
      const buffer = await this.combineChunks(chunks);
      
      // Get mime type from chunks, metadata, or detect from buffer
      let mimeType = chunks[0].mimeType || 'application/octet-stream';
      
      // Check if we have file extension or file type info in the metadata
      let fileExtension = '';
      let fileType: FileType;
      
      // Try to get file extension from metadata first
      if (requestMetadata?.fileExtension) {
        fileExtension = requestMetadata.fileExtension;
      }
      
      // Check if mime type is in metadata
      if (requestMetadata?.mimeType && requestMetadata.mimeType !== 'application/octet-stream') {
        mimeType = requestMetadata.mimeType;
      }
      
      // Try to extract filename if available
      const fileNameFromPath = requestMetadata?.filename || path.basename(chunks[0].path);
      
      // If we still don't have a valid extension, try to get it from the filename
      if (!fileExtension && fileNameFromPath) {
        fileExtension = path.extname(fileNameFromPath).toLowerCase();
        console.log(`Extracted extension from filename: ${fileExtension}`);
      }
      
      // Additional safeguard for extensions - ensure they have a leading dot
      if (fileExtension && !fileExtension.startsWith('.')) {
        fileExtension = `.${fileExtension}`;
        console.log(`Added dot to extension: ${fileExtension}`);
      }
      
      console.log(`Processing file: ${fileNameFromPath}, MIME type: ${mimeType}, Extension: ${fileExtension}`);
      
      // First, try to determine file type from the data source metadata if available
      let dataSourceFileType: string | undefined = undefined;
      
      try {
        const dataSource = await db('data_sources')
          .where('id', dataSourceId)
          .first();
        
        if (dataSource?.metadata?.fileType) {
          dataSourceFileType = dataSource.metadata.fileType;
          console.log(`Retrieved file type from data source metadata: ${dataSourceFileType}`);
        }
      } catch (e) {
        console.warn(`Could not retrieve data source metadata: ${e}`);
      }
      
      // Determine file type based on available information
      try {
        // Try using data source metadata first
        if (dataSourceFileType) {
          fileType = dataSourceFileType as FileType;
          console.log(`Using data source metadata file type: ${fileType}`);
        } 
        // Check if we have explicit fileType in request metadata
        else if (requestMetadata?.fileType) {
          fileType = requestMetadata.fileType as FileType;
          console.log(`Using request metadata file type: ${fileType}`);
        }
        // Otherwise use extension and mime type
        else {
          fileType = this.getFileType(fileExtension, mimeType);
          console.log(`Determined file type from extension and mime type: ${fileType}`);
        }
        console.log(`Final detected file type: ${fileType}`);
      } catch (error) {
        console.error(`File type detection error:`, error);
        
        // Enhanced fallback logic for file types
        if (requestMetadata?.fileType === 'xlsx' || 
            dataSourceFileType === 'xlsx' || 
            mimeType.includes('spreadsheet') || 
            mimeType.includes('excel') ||
            fileExtension === '.xlsx' ||
            fileExtension === '.xls') {
          fileType = 'xlsx';
          console.log(`Using fallback file type 'xlsx' based on available information`);
        } else if (requestMetadata?.fileType === 'docx' ||
            dataSourceFileType === 'docx' ||
            mimeType.includes('document') ||
            mimeType.includes('word') ||
            fileExtension === '.docx' ||
            fileExtension === '.doc') {
          fileType = 'docx';
          console.log(`Using fallback file type 'docx' based on available information`);
        } else if (requestMetadata?.fileType === 'pdf' ||
            dataSourceFileType === 'pdf' ||
            mimeType.includes('pdf') ||
            fileExtension === '.pdf') {
          fileType = 'pdf'; 
          console.log(`Using fallback file type 'pdf' based on available information`);
        } else {
          throw new Error(`Unsupported file type. MIME: ${mimeType}, Extension: ${fileExtension}`);
        }
      }

      // Update the data source status to processing
      try {
        await db('data_sources')
          .where('id', dataSourceId)
          .update({
            status: 'processing',
            updated_at: new Date()
          });
        console.log(`Updated data source ${dataSourceId} status to processing`);
      } catch (dbError: any) {
        console.error('Error updating data source status:', dbError);
        throw new Error(`Failed to update data source status: ${dbError.message}`);
      }

      // Create a temporary file for processing
      const tempFilePath = path.join(TEMP_DIR, `${uuidv4()}-${fileNameFromPath}`);
      await fs.promises.writeFile(tempFilePath, buffer);
      console.log(`Created temporary file at ${tempFilePath}`);

      // Create a database entry for the file
      dbFileId = uuidv4();
      console.log(`Generated file ID: ${dbFileId}`);
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Get the user ID and check if it's actually present in the database
        // to avoid foreign key constraint violations
        if (req.user && req.user.id) {
          try {
            // Verify if the user exists in the database
            const userExists = await client.query(
              'SELECT 1 FROM users WHERE id = $1 LIMIT 1',
              [req.user.id.toString()]
            );
            
            if (userExists.rows.length > 0) {
              uploadedBy = req.user.id.toString();
              console.log(`Verified user exists in database: ${uploadedBy}`);
            } else {
              console.warn(`User ID ${req.user.id} does not exist in the database, setting uploaded_by to NULL`);
            }
          } catch (userCheckError) {
            console.error('Error checking if user exists:', userCheckError);
            // Proceed with NULL for uploaded_by
          }
        }
        
        const fileInsertQuery = `
          INSERT INTO files (
            id, filename, original_filename, mime_type, size, file_type, 
            uploaded_by, organization_id, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        const fileParams = [
          dbFileId,
          fileNameFromPath,
          fileNameFromPath,
          mimeType,
          buffer.length,
          fileType, 
          uploadedBy, // This may be null if user doesn't exist
          req.user!.organizationId,
          JSON.stringify({ dataSourceId, processing_status: 'processing' })
        ];
        
        console.log(`Inserting file record with parameters:`, {
          id: dbFileId,
          filename: fileNameFromPath,
          original_filename: fileNameFromPath,
          mime_type: mimeType,
          size: buffer.length,
          file_type: fileType,
          uploaded_by: uploadedBy, // Log null if user doesn't exist
          organization_id: req.user!.organizationId
        });
        
        await client.query(fileInsertQuery, fileParams);
        console.log(`File record inserted successfully`);
        
        await client.query('COMMIT');
      } catch (dbError: any) {
        await client.query('ROLLBACK');
        console.error('Database error creating file record:', dbError);
        
        // More detailed error logging for database errors
        if (dbError.code) {
          console.error(`SQL Error Code: ${dbError.code}, Detail: ${dbError.detail || 'No detail'}`);
        }
        
        throw new Error(`Failed to create file record: ${dbError.message}`);
      } finally {
        client.release();
      }

      // Process the document using the DocumentPipelineService
      try {
        console.log(`Processing document with DocumentPipelineService: ${tempFilePath}`);
        console.log(`Using dataSourceId as collection name: ${dataSourceId}`);
        
        // Use the document pipeline service to process the file
        const processingResult = await this.documentPipelineService.processDocumentStream(
          tempFilePath,
          fileType,
          dataSourceId, // This is used as the collection name in Qdrant
          {
            fileId: dbFileId,
            filename: fileNameFromPath,
            mimeType,
            originalSize: buffer.length,
            uploadSource: 'ui',
            uploadedBy: uploadedBy,
            organizationId: req.user!.organizationId,
            // Add additional metadata to help with debugging
            processingTimestamp: new Date().toISOString(),
            collectionName: dataSourceId // Explicitly set collection name to match dataSourceId
          }
        );
        
        console.log(`Document processing result:`, processingResult);
        
        if (processingResult.status === 'error') {
          throw new Error(`Document processing failed: ${processingResult.message}`);
        }
        
        // Update file status to 'processed'
        const updateClient = await pool.connect();
        try {
          await updateClient.query(
            'UPDATE files SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{processingResult}\', $1::jsonb) WHERE id = $2',
            [JSON.stringify(processingResult), dbFileId]
          );
          console.log(`File processing completed successfully for file ${dbFileId}`);
        } catch (updateError: any) {
          console.error('Error updating file status:', updateError);
          throw updateError;
        } finally {
          updateClient.release();
        }
      } catch (processingError: unknown) {
        console.error('Error processing file:', processingError);
        // Update file status to 'failed'
        try {
          const errorClient = await pool.connect();
          const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
          await errorClient.query(
            'UPDATE files SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{error}\', $1::jsonb) WHERE id = $2',
            [JSON.stringify(errorMessage), dbFileId]
          );
          errorClient.release();
        } catch (updateError: any) {
          console.error('Error updating file metadata with error information:', updateError);
        }
        throw new Error(`Document processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`);
      }

      // Update data source status based on processing result
      await db('data_sources')
        .where('id', dataSourceId)
        .update({
          status: 'ready',
          updated_at: new Date(),
          metadata: db.raw(`jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{fileInfo}',
            ?::jsonb
          )`, [JSON.stringify({
            fileId: dbFileId,
            filename: fileNameFromPath,
            mimeType,
            contentType: mimeType,
            originalSize: buffer.length,
            fileType,
            processingComplete: true,
            processingTimestamp: new Date().toISOString(),
            collectionName: dataSourceId // Explicitly record the collection name used
          })])
        });

      // Clean up chunks and temporary file
      this.cleanupChunks(chunks);
      this.chunkRegistry.delete(fileId);
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (unlinkError: any) {
        console.warn(`Failed to delete temporary file: ${tempFilePath}`, unlinkError);
      }

      return res.json({
        success: true,
        message: 'File processed successfully',
        fileId: dbFileId,
        dataSourceId: dataSourceId, // Return the dataSourceId for reference
        collectionName: dataSourceId // Explicitly return the collection name used
      });
    } catch (error: unknown) {
      console.error('Error during file processing:', error);
      
      // Update data source status to error
      try {
        await db('data_sources')
          .where('id', dataSourceId)
          .update({
            status: 'error',
            updated_at: new Date(),
            metadata: db.raw(`jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{processingError}',
              ?::jsonb
            )`, [JSON.stringify({
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })])
          });
      } catch (dbError) {
        console.error('Failed to update data source status to error:', dbError);
      }
      
      // Clean up chunks
      this.cleanupChunks(chunks);
      this.chunkRegistry.delete(fileId);
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'File processing failed'
      });
    }
  }

  private getFileType(extension: string, mimeType?: string): FileType {
    try {
      return getFileType(extension, mimeType);
    } catch (error) {
      // If we get here, we don't know what type of file this is
      throw new Error(`Unsupported file type: ${extension}, MIME: ${mimeType || 'unknown'}`);
    }
  }

  private async combineChunks(chunks: ChunkInfo[]): Promise<Buffer> {
    try {
      // Calculate total size
      let totalSize = 0;
      for (const chunk of chunks) {
        const stats = fs.statSync(chunk.path);
        totalSize += stats.size;
      }
      
      // Create a buffer to hold the entire file
      const combinedBuffer = Buffer.alloc(totalSize);
      let offset = 0;
      
      // Copy each chunk into the combined buffer
      for (const chunk of chunks) {
        const chunkData = fs.readFileSync(chunk.path);
        chunkData.copy(combinedBuffer, offset);
        offset += chunkData.length;
      }
      
      return combinedBuffer;
    } catch (error: unknown) {
      console.error('Error combining chunks:', error);
      throw new Error(`Failed to combine chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private cleanupChunks(chunks: ChunkInfo[]) {
    for (const chunk of chunks) {
      try {
        if (fs.existsSync(chunk.path)) {
          fs.unlinkSync(chunk.path);
        }
      } catch (error: unknown) {
        console.warn(`Failed to delete chunk at ${chunk.path}:`, error);
      }
    }
  }
} 