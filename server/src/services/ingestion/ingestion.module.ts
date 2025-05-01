import { Module, forwardRef } from '@nestjs/common';
import { DataAnalysisOrchestratorService } from './data-analysis-orchestrator.service';
import { DocumentPipelineService } from './document-pipeline.service';
import { DocumentProcessorManager } from './document-processor-manager';
import { DataSourceProcessorService } from './data-source-processor.service';
import { QdrantSearchService } from '../vector/search.service';
import { QdrantCollectionService } from '../vector/collection-manager.service';
import { BullModule } from '@nestjs/bull';

// Import dependency modules (assuming standard locations and names)
import { AiModule } from '../ai/ai.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { VisualizationModule } from '../../modules/visualization/visualization.module';
import { DatasourcesProcessorsUtilsModule } from '../datasources/processors/utils/datasources-processors-utils.module';
import { ProcessorsModule } from '../datasources/processors/file/processors.module';
import { PrismaModule } from '../../core/database/prisma.module';

// Check environment variables for Redis and Bull disabling
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

console.log('>>> INGESTION MODULE: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> INGESTION MODULE: NO_BULL =', IS_BULL_DISABLED);

// Define imports conditionally
const conditionalImports = [];

// Only import BullModule if neither Redis nor Bull are disabled
if (!IS_REDIS_DISABLED && !IS_BULL_DISABLED) {
  console.log('>>> INGESTION MODULE: Importing BullModule.registerQueue');
  conditionalImports.push(
    BullModule.registerQueue({
      name: 'document-processing',
    })
  );
} else {
  console.log('>>> INGESTION MODULE: Skipping BullModule.registerQueue');
}

@Module({
  imports: [
    PrismaModule,
    AiModule, 
    AnalysisModule, 
    forwardRef(() => VisualizationModule),
    DatasourcesProcessorsUtilsModule,
    ...conditionalImports, // Conditionally add BullModule
    forwardRef(() => ProcessorsModule),
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