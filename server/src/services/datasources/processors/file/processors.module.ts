import { Module, forwardRef } from '@nestjs/common';
import { CustomPdfProcessorService } from './pdf/custom-pdf-processor.service';
// ADD imports for other processors
import { CsvProcessorService } from './csv/csv-processor.service';
import { EnhancedCsvProcessorService } from './csv/enhanced-csv-processor.service';
import { CustomDocxProcessorService } from './docx/custom-docx.processor';
import { EnhancedExcelProcessorService } from './excel/enhanced-excel.processor';
// ADD import for the factory
import { DocumentProcessorFactory } from './document-processor.factory';
import { DocumentChunkingService } from '../../../rag/chunking/document-chunking.service';

// Import modules providing dependencies needed by processors
import { ServicesModule } from '../../../../services.module'; // Corrected path
import { ConfigModule } from '@nestjs/config';
import { ConfigService as CoreConfigService } from '../../../core/config.service';
// import { ChunkingService } from '../../../rag/chunking.service'; // Removed import
import { WebSocketService } from '../../../util/websocket.service';
import { OpenAIService } from '../../../ai/openai.service';
import { DataSourceManagementService } from '../../management/datasource-management.service';
import { QdrantSearchService } from '../../../vector/search.service';
import { QdrantCollectionService } from '../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../vector/ingestion.service';
import { EventManager } from '../../../util/event-manager';
import { SocketService } from '../../../util/socket.service'; // Import SocketService
import { AiModule } from '../../../ai/ai.module';
import { EmbeddingService } from '../../../ai/embedding.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ServicesModule),
    forwardRef(() => AiModule),
  ],
  providers: [
    // Make sure CoreConfigService is provided
    CoreConfigService,
    // Add EventManager as a singleton provider
    {
      provide: EventManager,
      useFactory: () => EventManager.getInstance(),
    },
    // Add WebSocketService with EventManager injected
    {
      provide: WebSocketService,
      useFactory: (eventManager: EventManager) => {
        return new WebSocketService(eventManager);
      },
      inject: [EventManager],
    },
    
    // Document Processor Factory
    {
      provide: DocumentProcessorFactory,
      useFactory: (
        configService: CoreConfigService,
        pdfProcessor: CustomPdfProcessorService,
        enhancedCsvProcessor: EnhancedCsvProcessorService,
        docxProcessor: CustomDocxProcessorService,
        enhancedExcelProcessor: EnhancedExcelProcessorService,
        openAIService: OpenAIService,
        documentChunkingService: DocumentChunkingService,
        websocketService: WebSocketService
      ) => {
        return new DocumentProcessorFactory(
          configService,
          pdfProcessor,
          enhancedCsvProcessor,
          docxProcessor,
          enhancedExcelProcessor,
          openAIService,
          documentChunkingService,
          websocketService
        );
      },
      inject: [
        CoreConfigService,
        CustomPdfProcessorService,
        EnhancedCsvProcessorService,
        CustomDocxProcessorService,
        EnhancedExcelProcessorService,
        OpenAIService,
        DocumentChunkingService,
        WebSocketService
      ]
    },
    // PDF Processor
    {
      provide: CustomPdfProcessorService,
      useFactory: (
        dataSourceService: DataSourceManagementService,
        socketService: SocketService,
        coreConfigService: CoreConfigService,
        documentChunkingService: DocumentChunkingService,
        qdrantService: QdrantSearchService,
        openAIService: OpenAIService,
      ) => {
        return new CustomPdfProcessorService(
          dataSourceService,
          socketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantService,
          openAIService,
        );
      },
      inject: [
        DataSourceManagementService,
        SocketService,
        CoreConfigService,
        DocumentChunkingService,
        QdrantSearchService,
        OpenAIService,
      ],
    },
    // CSV Processor
    {
      provide: CsvProcessorService,
      useFactory: (
        dataSourceService: DataSourceManagementService,
        socketService: SocketService,
        coreConfigService: CoreConfigService,
        documentChunkingService: DocumentChunkingService,
        qdrantSearchService: QdrantSearchService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        openAIService: OpenAIService,
      ) => {
        return new CsvProcessorService(
          dataSourceService,
          socketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantSearchService,
          qdrantCollectionService,
          qdrantIngestionService,
          openAIService,
        );
      },
      inject: [
        DataSourceManagementService,
        SocketService,
        CoreConfigService,
        DocumentChunkingService,
        QdrantSearchService,
        QdrantCollectionService,
        QdrantIngestionService,
        OpenAIService,
      ],
    },
    // Enhanced CSV Processor
    {
      provide: EnhancedCsvProcessorService,
      useFactory: (
        dataSourceManagementService: DataSourceManagementService,
        webSocketService: WebSocketService,
        coreConfigService: CoreConfigService,
        documentChunkingService: DocumentChunkingService,
        qdrantSearchService: QdrantSearchService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        openAIService: OpenAIService,
      ) => {
        return new EnhancedCsvProcessorService(
          dataSourceManagementService,
          webSocketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantSearchService,
          qdrantCollectionService,
          qdrantIngestionService,
          openAIService,
        );
      },
      inject: [
        DataSourceManagementService,
        WebSocketService,
        CoreConfigService,
        DocumentChunkingService,
        QdrantSearchService,
        QdrantCollectionService,
        QdrantIngestionService,
        OpenAIService,
      ],
    },
    // DOCX Processor
    {
      provide: CustomDocxProcessorService,
      useFactory: (
        coreConfigService: CoreConfigService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        openAIService: OpenAIService,
        embeddingService: EmbeddingService,
        socketService: SocketService,
        documentChunkingService: DocumentChunkingService,
      ) => {
        return new CustomDocxProcessorService(
          coreConfigService as any,
          qdrantCollectionService,
          qdrantIngestionService,
          openAIService,
          embeddingService,
          socketService,
          documentChunkingService,
        );
      },
      inject: [
        CoreConfigService,
        QdrantCollectionService,
        QdrantIngestionService,
        OpenAIService,
        EmbeddingService,
        SocketService,
        DocumentChunkingService,
      ],
    },
    // Excel Processor
    {
      provide: EnhancedExcelProcessorService,
      useFactory: (
        coreConfigService: CoreConfigService,
        documentChunkingService: DocumentChunkingService,
        openAIService: OpenAIService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        socketService: SocketService,
      ) => {
        return new EnhancedExcelProcessorService(
          coreConfigService as any,
          documentChunkingService,
          openAIService,
          qdrantCollectionService,
          qdrantIngestionService,
          socketService,
        );
      },
      inject: [
        CoreConfigService,
        DocumentChunkingService,
        OpenAIService,
        QdrantCollectionService,
        QdrantIngestionService,
        SocketService,
      ],
    },
  ],
  exports: [DocumentProcessorFactory],
})
export class ProcessorsModule {} 