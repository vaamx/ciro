import { Module, Logger, forwardRef } from '@nestjs/common';
import { VisualizationController } from './visualization.controller';
import { VisualizationService } from './visualization.service';
// Import VisualizationPreparationService
import { VisualizationPreparationService } from '../../services/visualization/visualization-preparation.service';
// Import necessary modules with updated paths
import { AuthModule } from '../../core/auth/auth.module';
import { ServicesModule } from '../../services.module';
import { SnowflakeService } from '../../services/datasources/connectors/snowflake/snowflake.service';
import { DataSourceModule } from '../data-source/data-source.module';
import { DataSourceManagementService } from '../../services/datasources/management/datasource-management.service';
import { LLMService } from '../../services/llm';
import { QdrantClientService } from '../../services/vector/qdrant-client.service';
import { QdrantCollectionService } from '../../services/vector/collection-manager.service';
import { QdrantIngestionService } from '../../services/vector/ingestion.service';

@Module({
  imports: [
    AuthModule, // For authentication guard
    forwardRef(() => ServicesModule), // Wrap ServicesModule with forwardRef
    forwardRef(() => DataSourceModule), // Import DataSourceModule with forwardRef
  ],
  controllers: [VisualizationController],
  providers: [
    VisualizationPreparationService,
    Logger,
    // Properly provide SnowflakeService as a value directly
    {
      provide: SnowflakeService,
      useFactory: () => {
        // Import the actual SnowflakeService class
        const { SnowflakeService } = require('../../services/datasources/connectors/snowflake/snowflake.service');
        // Call the static getInstance method
        return SnowflakeService.getInstance();
      }
    },
    // Properly provide VisualizationService with all its dependencies
    {
      provide: VisualizationService,
      useFactory: (
        dataSourceManagementService?: DataSourceManagementService,
        qdrantClientService?: QdrantClientService,
        qdrantCollectionService?: QdrantCollectionService,
        snowflakeService?: SnowflakeService,
        llmService?: LLMService,
        qdrantIngestionService?: QdrantIngestionService
      ) => {
        return new VisualizationService(
          dataSourceManagementService as any,
          qdrantClientService as any,
          qdrantCollectionService as any,
          snowflakeService as any,
          llmService as any,
          qdrantIngestionService as any
        );
      },
      inject: [
        { token: DataSourceManagementService, optional: true },
        { token: QdrantClientService, optional: true },
        { token: QdrantCollectionService, optional: true },
        { token: SnowflakeService, optional: true },
        { token: LLMService, optional: true },
        { token: QdrantIngestionService, optional: true }
      ]
    }
  ],
  exports: [
    VisualizationService,
    VisualizationPreparationService
  ]
})
export class VisualizationModule {} 