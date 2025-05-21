import { Module, forwardRef, Provider, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OpenAIService } from './services/ai/openai.service';
import { EmbeddingService } from './services/ai/embedding.service';
import { SocketService } from './services/util/socket.service';
import { CodeExecutionService } from './services/code-execution/code-execution.service';
import { CodeGenerationService } from './services/code-execution/code-generator.service';
import { QueryAnalysisService } from './services/analysis/query-analysis.service';
import { QueryAnalyzerService } from './services/rag/query-analyzer.service';
import { BaseRetrievalService } from './services/rag/base-retrieval.service';
import { RetrievalService } from './services/rag/retrieval.service';
import { EnhancedRetrievalService } from './services/rag/enhanced-retrieval.service';
import { GenerationService } from './services/rag/generation.service';
import { RagIntegrationService } from './services/rag/integration.service';
import { DocumentChunkingService } from './services/rag/chunking/document-chunking.service';
import { ElementChunkingService } from './services/rag/chunking/element-chunking.service';
import { SemanticChunkingService } from './services/rag/chunking/semantic-chunking.service';
import { ChunkingService } from './services/rag/chunking.service';
import { QdrantSearchService } from './services/vector/search.service';
import { HybridSearchService } from './services/vector/hybrid-search.service';
import { QdrantCollectionService } from './services/vector/collection-manager.service';
import { QdrantClientService } from './services/vector/qdrant-client.service';
import { QdrantIngestionService } from './services/vector/ingestion.service';
import { ProcessorsModule } from './services/datasources/processors/file/processors.module';
import { IntentAnalysisService } from './services/rag/intent-analyzer.service';
import { ComplexityAnalysisService } from './services/rag/complexity-analyzer.service';
import { EntityExtractionService } from './services/rag/entity-extraction.service';
import { DataSourceManagementService } from './services/datasources/management';
import { EnhancedMetadataService } from './services/shared/metadata/enhanced-metadata.service';
import { IngestionModule } from './services/ingestion/ingestion.module';
import { DocumentPipelineService } from './services/ingestion/document-pipeline.service';
import { HubSpotService } from './services/datasources/connectors/hubspot/HubSpotService';
import { WorkspaceService } from './services/workspace/workspace.service';
import { PythonExecutorService } from './services/code-execution/python-executor.service';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './services/ai/ai.module';
import { DualPathModule } from './modules/dual-path/dual-path.module';
import { CodeExecutionModule } from './services/code-execution/code-execution.module';
import { AnalysisModule } from './services/analysis/analysis.module';

// Check environment variables for Redis and Bull disabling
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

console.log('>>> SERVICES MODULE: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> SERVICES MODULE: NO_BULL =', IS_BULL_DISABLED);

// Define imports conditionally
const conditionalImports = [];

// Only import BullModule if neither Redis nor Bull are disabled
if (!IS_REDIS_DISABLED && !IS_BULL_DISABLED) {
  console.log('>>> SERVICES MODULE: Importing BullModule.registerQueue');
  conditionalImports.push(
    BullModule.registerQueue({
      name: 'document-processing',
    })
  );
} else {
  console.log('>>> SERVICES MODULE: Skipping BullModule.registerQueue');
}

// Define forwardRef providers using a factory pattern
// This helps ensure circular dependencies are handled properly
const createForwardRefProvider = <T>(ServiceClass: new (...args: any[]) => T): Provider => ({
  provide: ServiceClass,
  useFactory: (...deps: any[]) => new ServiceClass(...deps),
  inject: [
    ...ServiceClass.prototype.constructor.length > 0
      ? Array(ServiceClass.prototype.constructor.length).fill(null).map((_, i) => `dep${i}`)
      : []
  ],
});

/**
 * Module that registers all injectable services
 * This automatically provides dependency injection for converted services
 */
@Module({
  imports: [
    forwardRef(() => AiModule),
    ...conditionalImports,
    forwardRef(() => ProcessorsModule),
    forwardRef(() => IngestionModule),
    forwardRef(() => DualPathModule),
    ConfigModule,
    CodeExecutionModule,
    AnalysisModule,
  ],
  providers: [
    OpenAIService,
    EmbeddingService,
    SocketService,
    {
      provide: CodeExecutionService,
      useFactory: (
        codeGenerator: CodeGenerationService,
        pythonExecutor: PythonExecutorService,
        openAiService: OpenAIService,
        qdrantSearchService: QdrantSearchService
      ) => {
        return new CodeExecutionService(
          codeGenerator,
          pythonExecutor,
          openAiService,
          qdrantSearchService
        );
      },
      inject: [
        CodeGenerationService,
        PythonExecutorService,
        OpenAIService,
        QdrantSearchService
      ]
    },
    CodeGenerationService,
    BaseRetrievalService,
    RetrievalService,
    EnhancedRetrievalService,
    GenerationService,
    QueryAnalyzerService,
    {
      provide: RagIntegrationService,
      useFactory: (
        queryAnalyzerService: QueryAnalyzerService,
        retrievalService: RetrievalService,
        generationService: GenerationService,
        qdrantSearchService: QdrantSearchService | null,
        hybridSearchService: HybridSearchService | null,
        enhancedMetadataService: EnhancedMetadataService | null,
        enhancedRetrievalService: EnhancedRetrievalService | null
      ) => {
        const logger = new Logger('RagIntegrationService');
        
        if (!queryAnalyzerService) logger.warn('QueryAnalyzerService not available for RagIntegrationService');
        if (!retrievalService) logger.warn('RetrievalService not available for RagIntegrationService');
        if (!generationService) logger.warn('GenerationService not available for RagIntegrationService');
        if (!qdrantSearchService) logger.warn('QdrantSearchService not available for RagIntegrationService');
        if (!hybridSearchService) logger.warn('HybridSearchService not available for RagIntegrationService');
        if (!enhancedMetadataService) logger.warn('EnhancedMetadataService not available for RagIntegrationService');
        if (!enhancedRetrievalService) logger.warn('EnhancedRetrievalService not available for RagIntegrationService');
        
        return new RagIntegrationService(
          queryAnalyzerService,
          retrievalService,
          generationService,
          qdrantSearchService || undefined,
          hybridSearchService || undefined,
          enhancedMetadataService || undefined,
          enhancedRetrievalService || undefined
        );
      },
      inject: [
        QueryAnalyzerService,
        RetrievalService,
        GenerationService,
        { token: QdrantSearchService, optional: true },
        { token: HybridSearchService, optional: true },
        { token: EnhancedMetadataService, optional: true },
        { token: EnhancedRetrievalService, optional: true }
      ]
    },
    DocumentChunkingService,
    ElementChunkingService,
    SemanticChunkingService,
    ChunkingService,
    QdrantSearchService,
    HybridSearchService,
    QdrantCollectionService,
    QdrantClientService,
    QdrantIngestionService,
    IntentAnalysisService,
    ComplexityAnalysisService,
    EntityExtractionService,
    DataSourceManagementService,
    EnhancedMetadataService,
    HubSpotService,
    WorkspaceService,
    PythonExecutorService,
  ],
  exports: [
    OpenAIService,
    EmbeddingService,
    SocketService,
    CodeExecutionModule,
    AnalysisModule,
    CodeExecutionService,
    CodeGenerationService,
    BaseRetrievalService,
    RetrievalService,
    EnhancedRetrievalService,
    GenerationService,
    RagIntegrationService,
    QueryAnalyzerService,
    DocumentChunkingService,
    ElementChunkingService,
    SemanticChunkingService,
    ChunkingService,
    QdrantSearchService,
    HybridSearchService,
    QdrantCollectionService,
    QdrantClientService,
    QdrantIngestionService,
    IntentAnalysisService,
    ComplexityAnalysisService,
    EntityExtractionService,
    DataSourceManagementService,
    EnhancedMetadataService,
    HubSpotService,
    WorkspaceService,
    PythonExecutorService,
  ]
})
export class ServicesModule {}
  