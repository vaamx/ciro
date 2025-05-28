import { Module, forwardRef, Provider, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
// OpenAIService removed - migrated to LLM abstraction layer
// Migrated to LLM module
import { LLMModule, LegacyAIAdapter, EmbeddingService, LLMService } from './services/llm';
import { VectorModule } from './services/vector/vector.module'; // RE-ENABLED TO TEST
import { QdrantSearchService } from './services/vector/search.service'; // Import for CodeExecutionService
import { HybridSearchService } from './services/vector/hybrid-search.service'; // Import for RagIntegrationService
import { SocketService } from './services/util/socket.service';
import { CodeExecutionService } from './services/code-execution/code-execution.service';
import { CodeGenerationService } from './services/code-execution/code-generator.service';
import { QueryAnalyzerService } from './services/rag/query-analyzer.service';
import { QueryRouterService } from './services/code-execution/query-router.service';
import { RerankingService } from './services/rag/reranking.service';
import { DirectRAGService } from './services/rag/direct-rag.service';
import { RagAggregationService } from './services/rag/rag-aggregation.service';
import { QueryOrchestratorService } from './services/rag/query-orchestrator.service';
import { BaseRetrievalService } from './services/rag/base-retrieval.service';
import { RetrievalService } from './services/rag/retrieval.service';
import { EnhancedRetrievalService } from './services/rag/enhanced-retrieval.service';
import { GenerationService } from './services/rag/generation.service';
import { RagIntegrationService } from './services/rag/integration.service';
import { AnalyticalRAGService } from './services/rag/analytical-rag.service';
import { DocumentChunkingService } from './services/rag/chunking/document-chunking.service';
import { ElementChunkingService } from './services/rag/chunking/element-chunking.service';
import { SemanticChunkingService } from './services/rag/chunking/semantic-chunking.service';
import { ChunkingService } from './services/rag/chunking.service';
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
import { SandboxManagerService } from './services/sandbox/sandbox-manager.service';
import { ConfigModule } from '@nestjs/config';
import { SnowflakeService } from './services/datasources/connectors/snowflake/snowflake.service';
import { ServiceRegistry } from './services/core/service-registry';
import { AnalysisModule } from './services/analysis/analysis.module';
import { StateModule } from './modules/state/state.module';
import { SandboxModule } from './services/sandbox/sandbox.module';
import { FormsModule } from './services/features/forms/forms.module';
import { DualPathModule } from './modules/dual-path/dual-path.module';

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
    ConfigModule, // Add ConfigModule to provide ConfigService
    LLMModule, // LLM abstraction layer
    VectorModule, // RE-ENABLED TO TEST
    ...conditionalImports,
    ProcessorsModule, // Add back now that circular dependency is resolved
    forwardRef(() => IngestionModule),

    AnalysisModule,
    StateModule,
    SandboxModule,
    FormsModule,
    forwardRef(() => DualPathModule),
  ],
  providers: [
    // OpenAIService removed - migrated to LLM abstraction layer
    // EmbeddingService now comes from LLM module
    SocketService,
    {
      provide: CodeExecutionService,
      useFactory: (
        codeGenerator: CodeGenerationService,
        pythonExecutor: PythonExecutorService,
        llmService: LLMService,
        qdrantSearchService: QdrantSearchService
      ) => {
        return new CodeExecutionService(
          codeGenerator,
          pythonExecutor,
          llmService,
          qdrantSearchService
        );
      },
      inject: [
        CodeGenerationService,
        PythonExecutorService,
        LLMService,
        QdrantSearchService
      ]
    },
    CodeGenerationService,
    BaseRetrievalService,
    RetrievalService,
    EnhancedRetrievalService,
    GenerationService,
    QueryAnalyzerService,
    QueryRouterService,
    RerankingService,
    DirectRAGService,
    RagAggregationService,
    QueryOrchestratorService,
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
    HybridSearchService,
    IntentAnalysisService,
    ComplexityAnalysisService,
    EntityExtractionService,
    DataSourceManagementService, // Keeping this for now
    EnhancedMetadataService,
    DocumentPipelineService,
    HubSpotService,
    WorkspaceService,
    PythonExecutorService,
    SandboxManagerService,
    AnalyticalRAGService,
    {
      provide: SnowflakeService,
      useFactory: () => SnowflakeService.getInstance(),
    },
    {
      provide: ServiceRegistry,
      useFactory: () => new ServiceRegistry(),
    },
  ],
  exports: [
    // OpenAIService removed - migrated to LLM abstraction layer
    LLMModule, // Export LLM module to make its services available
    VectorModule, // Export VectorModule to make Qdrant services available
    ProcessorsModule, // Export ProcessorsModule to make document processors available
    SocketService,
    AnalysisModule,
    FormsModule,
    CodeExecutionService,
    CodeGenerationService,
    BaseRetrievalService,
    RetrievalService,
    EnhancedRetrievalService,
    GenerationService,
    QueryAnalyzerService,
    QueryRouterService,
    RerankingService,
    DirectRAGService,
    RagAggregationService,
    QueryOrchestratorService,
    RagIntegrationService,
    DocumentChunkingService,
    ElementChunkingService,
    SemanticChunkingService,
    ChunkingService,
    HybridSearchService,
    IntentAnalysisService,
    ComplexityAnalysisService,
    EntityExtractionService,
    DataSourceManagementService,
    EnhancedMetadataService,
    DocumentPipelineService,
    HubSpotService,
    WorkspaceService,
    PythonExecutorService,
    SandboxManagerService,
    AnalyticalRAGService,
    SnowflakeService,
    ServiceRegistry,
  ]
})
export class ServicesModule {}
  