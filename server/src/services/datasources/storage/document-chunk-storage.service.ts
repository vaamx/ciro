import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service'; // Adjusted path
import { Prisma } from '@prisma/client';
import { createServiceLogger } from '../../../common/utils/logger-factory'; // Adjusted path
import { DataSourceStatus } from '../processors/file/base-document.processor'; // Adjusted path (Assuming status enum is here)
import { v4 as uuidv4 } from 'uuid';
// NOTE: We might need to inject DataSourceManagementService later if updateStatus needs to be called from here,
// or restructure how status updates are handled. For now, commenting out the updateStatus call.

@Injectable()
export class DocumentChunkStorageService {
  private logger = createServiceLogger('DocumentChunkStorageService');

  constructor(
    private prisma: PrismaService,
    // private qdrantIngestionService: QdrantIngestionService, // Not used in original method
    // private dataSourceManagementService: DataSourceManagementService // Needed if updateStatus call is kept
  ) {
    this.logger.info('DocumentChunkStorageService initialized');
  }

  /**
   * Store a document chunk, checking for existence and updating if found.
   * Currently updates/creates only in the relational DB (Prisma).
   * TODO: Determine if Qdrant upsert should also happen here.
   */
  async storeDocumentChunk(
    dataSourceId: number,
    // organizationId: number, // Needed for updateStatus, removed for now
    content: string,
    embedding: number[], // Keep embedding, might be stored or used later
    metadata: any,
  ): Promise<{ id: string | number | null; dataSourceId: number; content: string; status: 'created' | 'updated' | 'error' }> {
    this.logger.info(`Storing document chunk for data source ${dataSourceId}`);
    let chunkId: string | number | null = null;
    let status: 'created' | 'updated' | 'error' = 'error';

    try {
      // Check if this chunk already exists using Prisma
      const existingChunk = await this.prisma.document_chunks.findFirst({
        where: {
          data_source_id: dataSourceId,
          content: content, // Assuming exact content match is the criteria
        },
      });

      if (existingChunk) {
        chunkId = existingChunk.id;
        this.logger.info(`Chunk ${chunkId} already exists for data source ${dataSourceId}, updating.`);

        // Update the existing chunk in Prisma
        // Original code updated embedding and metadata
        const updateResult = await this.prisma.document_chunks.update({
          where: { id: existingChunk.id },
          data: {
            // Storing embedding as JSON string, matching original logic
            embedding: JSON.stringify(embedding),
            metadata: metadata, // Assuming metadata is a JSON field
          },
        });
        this.logger.debug(`Updated chunk ${chunkId} in DB.`);
        status = 'updated';

      } else {
        this.logger.info(`Creating new chunk for data source ${dataSourceId} in DB.`);

        // Insert new chunk using Prisma
        const newChunk = await this.prisma.document_chunks.create({
          data: {
            id: uuidv4(),
            data_source_id: dataSourceId,
            content: content,
            embedding: JSON.stringify(embedding),
            metadata: metadata,
            updated_at: new Date()
          },
        });

        chunkId = newChunk.id;
        if (chunkId) {
          this.logger.info(`Stored new document chunk with DB ID ${chunkId} for data source ${dataSourceId}`);
          status = 'created';
        } else {
          this.logger.error('Failed to insert new document chunk or retrieve DB ID.');
          throw new InternalServerErrorException('Failed to store document chunk in DB');
        }
      }

      // TODO: Decide if Qdrant upsert is needed here.
      // If so, inject QdrantIngestionService and call upsertVectors.

      return {
        id: chunkId,
        dataSourceId,
        content,
        status: status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error storing document chunk for data source ${dataSourceId}: ${message}`, stack);

      // Commenting out status update call as it requires injecting another service (or rethinking flow)
      /*
      try {
        await this.dataSourceManagementService.updateStatus(
          dataSourceId,
          organizationId,
          DataSourceStatus.ERROR, // Ensure correct enum/type
         `Failed to store document chunk: ${message}`
        );
      } catch (statusError) {
         this.logger.error(`Failed to update status after chunk storage error: ${statusError}`);
      }
      */
      // Re-throw the original error to indicate failure
      throw new InternalServerErrorException(`Failed to store document chunk: ${message}`);
    }
  }
} 