import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../../../core/config.service';
import { ChunkingService } from '../../../../rag/chunking.service';
import { QdrantSearchService } from '../../../../vector/search.service';
import { SocketService } from '../../../../util/socket.service';
import { OpenAIService } from '../../../../ai/openai.service';
import { QdrantCollectionService } from '../../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../../vector/ingestion.service';
import { createServiceLogger } from '../../../../../common/utils/logger-factory';
import { CsvProcessorService } from './csv.processor';
import { ProcessingResult, BaseDocumentProcessor } from '../base-document.processor';
import { DataSourceProcessingStatus } from '../../../../../types';

/**
 * Enhanced CSV Processor Service
 * Provides advanced processing for CSV files
 */
@Injectable()
export class EnhancedCsvProcessorService extends CsvProcessorService {
  protected readonly logger = createServiceLogger('EnhancedCsvProcessorService');

  constructor(
    // dataSourceService: DataSourceService, // TODO: Reinstate
    socketService: SocketService,
    protected readonly configService: ConfigService,
    protected readonly chunkingService: ChunkingService,
    protected readonly qdrantSearchService: QdrantSearchService,
    protected readonly qdrantCollectionService: QdrantCollectionService,
    protected readonly qdrantIngestionService: QdrantIngestionService,
    openAIService: OpenAIService
  ) {
    super(
        socketService,
        configService,
        chunkingService,
        qdrantSearchService,
        qdrantCollectionService,
        qdrantIngestionService,
        openAIService
    );
    this.logger.info('EnhancedCsvProcessorService initialized');
  }

  /**
   * Process a CSV file with enhanced analytics and chunking
   */
  async processFile(
    filePath: string,
    dataSourceId: number,
    organizationId: number,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    this.logger.info(`Using EnhancedCsvProcessorService for dataSourceId: ${dataSourceId}, orgId: ${organizationId}...`);

    try {
      const result = await super.processFile(filePath, dataSourceId, organizationId, userId, metadata);

      if (result.status === 'success') {
        this.logger.info('Enhanced processing steps completed successfully.');
      }

      return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error during enhanced CSV processing for ${filePath}: ${errorMessage}`);
        await this.updateStatus(dataSourceId, organizationId, DataSourceProcessingStatus.ERROR, undefined, `Enhanced processing failed: ${errorMessage}`);
        return { status: 'error', message: `Enhanced processing failed: ${errorMessage}`, chunks: 0 };
    }
  }
} 