import { CsvProcessorService } from './csv-processor.service';
import { ConfigService } from '../../services/core/config.service';
import { ChunkingService } from '../../services/rag/chunking.service';
import { SocketService } from '../../services/util/socket.service';
import { ProcessingResult } from './base-document-processor';
import { createServiceLogger } from '../../utils/logger-factory';
import { Injectable } from '@nestjs/common';

/**
 * Enhanced CSV Processor Service
 * Extends the base CSV processor with advanced analytics and processing
 */
@Injectable()
export class EnhancedCsvProcessorService extends CsvProcessorService {
  protected readonly logger = createServiceLogger('EnhancedCsvProcessorService');

  constructor(
    configService: ConfigService,
    chunkingService: ChunkingService,
    websocketService: SocketService
  ) {
    super(configService, chunkingService, websocketService);
  }

  /**
   * Process a CSV file with enhanced analytics and chunking
   */
  async processFile(
    filePath: string,
    dataSourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingResult> {
    // For now, just call the parent method
    // Later, we can enhance this with additional processing steps
    return super.processFile(filePath, dataSourceId, metadata);
  }
} 