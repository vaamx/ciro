import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DataAnalysisOrchestratorService } from './data-analysis-orchestrator.service';
import { DocumentPipelineService } from './document-pipeline.service';
import { DocumentProcessorManager } from './document-processor-manager';
import { DataSourceProcessorService } from './data-source-processor.service';
import { QdrantSearchService } from '../vector/search.service';
import { QdrantCollectionService } from '../vector/collection-manager.service';

// Import dependency modules (assuming standard locations and names)
import { LLMModule } from '../llm/llm.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { VisualizationModule } from '../../modules/visualization/visualization.module';
import { VectorModule } from '../vector/vector.module';
import { DatasourcesProcessorsUtilsModule } from '../datasources/processors/utils/datasources-processors-utils.module';
import { ProcessorsModule } from '../datasources/processors/file/processors.module';
import { PrismaModule } from '../../core/database/prisma.module';

// Check if Redis/Bull should be disabled
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

@Module({
  imports: [
    PrismaModule,
    VectorModule,
    LLMModule, 
    AnalysisModule, 
    forwardRef(() => VisualizationModule),
    DatasourcesProcessorsUtilsModule,
    forwardRef(() => ProcessorsModule),
    // Add BullModule only if Redis/Bull are enabled
    ...(IS_REDIS_DISABLED || IS_BULL_DISABLED ? [] : [
      BullModule.registerQueue({
        name: 'document-processing',
      })
    ])
  ],
  providers: [
    DataAnalysisOrchestratorService,
    DocumentPipelineService,
    DocumentProcessorManager,
    {
      provide: DataSourceProcessorService,
      useFactory: (
        documentPipelineService: DocumentPipelineService,
        qdrantSearchService: QdrantSearchService,
        qdrantCollectionService: QdrantCollectionService
      ) => {
        return new DataSourceProcessorService(
          documentPipelineService,
          qdrantSearchService || null,
          qdrantCollectionService || null
        );
      },
      inject: [
        DocumentPipelineService, 
        { token: QdrantSearchService, optional: true },
        { token: QdrantCollectionService, optional: true }
      ]
    },
  ],
  exports: [
    DataAnalysisOrchestratorService,
    DocumentPipelineService,
    DocumentProcessorManager,
    DataSourceProcessorService,
  ],
})
export class IngestionModule {} 