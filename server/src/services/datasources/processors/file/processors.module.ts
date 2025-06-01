import { Module, forwardRef } from '@nestjs/common';
import { CustomPdfProcessorService } from './pdf/custom-pdf-processor.service';
// ADD imports for other processors
import { CsvProcessorService } from './csv/csv-processor.service';
import { EnhancedCsvProcessorService } from './csv/enhanced-csv-processor.service';
import { CustomDocxProcessorService } from './docx/custom-docx.processor';
import { EnhancedExcelProcessorService } from './excel/enhanced-excel.processor';
import { JsonProcessorService } from './json/json-processor.service';
// ADD import for the factory
import { DocumentProcessorFactory } from './document-processor.factory';
import { DocumentChunkingService } from '../../../rag/chunking/document-chunking.service';

// Import specific modules instead of ServicesModule to break circular dependency
import { VectorModule } from '../../../vector/vector.module'; // Provides Qdrant services
import { LLMModule } from '../../../llm/llm.module'; // Provides EmbeddingService
import { ConfigModule } from '@nestjs/config';
import { ConfigService as CoreConfigService } from '../../../core/config.service';
import { WebSocketService } from '../../../util/websocket.service';
import { EmbeddingService, LLMService } from '../../../llm';
import { DataSourceManagementService } from '../../management/datasource-management.service';
import { QdrantSearchService } from '../../../vector/search.service';
import { QdrantCollectionService } from '../../../vector/collection-manager.service';
import { QdrantIngestionService } from '../../../vector/ingestion.service';
import { EventManager } from '../../../util/event-manager';
import { SocketService } from '../../../util/socket.service'; // Import SocketService

@Module({
  imports: [
    ConfigModule,
    VectorModule, // Direct import instead of through ServicesModule
    LLMModule, // Direct import instead of through ServicesModule
  ],
  providers: [
    // Make sure CoreConfigService is provided
    CoreConfigService,
    
    // Provide DataSourceManagementService directly since we can't get it from ServicesModule
    DataSourceManagementService,
    
    // Provide DocumentChunkingService directly
    DocumentChunkingService,
    
    // Provide SocketService directly
    SocketService,
    
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
        documentChunkingService: DocumentChunkingService,
        websocketService: WebSocketService
      ) => {
        return new DocumentProcessorFactory(
          configService,
          pdfProcessor,
          enhancedCsvProcessor,
          docxProcessor,
          enhancedExcelProcessor,
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
        embeddingService: EmbeddingService,
      ) => {
        return new CustomPdfProcessorService(
          dataSourceService,
          socketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantService,
          embeddingService,
        );
      },
      inject: [
        DataSourceManagementService,
        SocketService,
        CoreConfigService,
        DocumentChunkingService,
        QdrantSearchService,
        EmbeddingService,
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
        embeddingService: EmbeddingService,
      ) => {
        return new CsvProcessorService(
          dataSourceService,
          socketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantSearchService,
          qdrantCollectionService,
          qdrantIngestionService,
          embeddingService,
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
        EmbeddingService,
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
        embeddingService: EmbeddingService,
      ) => {
        return new EnhancedCsvProcessorService(
          dataSourceManagementService,
          webSocketService,
          coreConfigService as any,
          documentChunkingService,
          qdrantSearchService,
          qdrantCollectionService,
          qdrantIngestionService,
          embeddingService,
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
        EmbeddingService,
      ],
    },
    // DOCX Processor
    {
      provide: CustomDocxProcessorService,
      useFactory: (
        coreConfigService: CoreConfigService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        embeddingService: EmbeddingService,
        socketService: SocketService,
        documentChunkingService: DocumentChunkingService,
      ) => {
        return new CustomDocxProcessorService(
          coreConfigService as any,
          qdrantCollectionService,
          qdrantIngestionService,
          embeddingService,
          socketService,
          documentChunkingService,
        );
      },
      inject: [
        CoreConfigService,
        QdrantCollectionService,
        QdrantIngestionService,
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
        embeddingService: EmbeddingService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        socketService: SocketService,
        dataSourceManagementService: DataSourceManagementService,
      ) => {
        return new EnhancedExcelProcessorService(
          coreConfigService as any,
          documentChunkingService,
          embeddingService,
          qdrantCollectionService,
          qdrantIngestionService,
          socketService,
          dataSourceManagementService,
        );
      },
      inject: [
        CoreConfigService,
        DocumentChunkingService,
        EmbeddingService,
        QdrantCollectionService,
        QdrantIngestionService,
        SocketService,
        DataSourceManagementService,
      ],
    },
    // JSON Processor
    {
      provide: JsonProcessorService,
      useFactory: (
        coreConfigService: CoreConfigService,
        qdrantCollectionService: QdrantCollectionService,
        qdrantIngestionService: QdrantIngestionService,
        embeddingService: EmbeddingService,
        socketService: SocketService,
        documentChunkingService: DocumentChunkingService,
      ) => {
        return new JsonProcessorService(
          coreConfigService as any,
          qdrantCollectionService,
          qdrantIngestionService,
          embeddingService,
          socketService,
          documentChunkingService,
        );
      },
      inject: [
        CoreConfigService,
        QdrantCollectionService,
        QdrantIngestionService,
        EmbeddingService,
        SocketService,
        DocumentChunkingService,
      ],
    },
  ],
  exports: [DocumentProcessorFactory],
})
export class ProcessorsModule {} 