import { CsvProcessorService } from './csv-processor.service';
import { ConfigService } from '../config.service';
import { ChunkingService } from '../chunking.service';
import { QdrantService } from '../qdrant.service';
import { WebSocketService } from '../websocket.service';
import { ProcessingResult } from './base-document-processor';
import { createServiceLogger } from '../../utils/logger-factory';

/**
 * Enhanced CSV Processor Service
 * Extends the base CSV processor with advanced analytics and processing
 */
export class EnhancedCsvProcessorService extends CsvProcessorService {
  constructor(
    configService: ConfigService,
    chunkingService: ChunkingService,
    qdrantService: QdrantService,
    websocketService: WebSocketService
  ) {
    super(configService, chunkingService, qdrantService, websocketService);
    this.processorName = 'Enhanced CSV Processor';
    this.logger = createServiceLogger('EnhancedCsvProcessorService');
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