import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { DataSourceController } from './data-source.controller';
import { DataSourceManagementService } from '../../services/datasources/management';
import { OrphanedDataCleanupService } from '../../services/datasources/management/orphaned-data-cleanup.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaService } from '../../core/database/prisma.service';
import { IngestionModule } from '../../services/ingestion/ingestion.module';
import { VectorModule } from '../../services/vector/vector.module';
import { QdrantCollectionService } from '../../services/vector/collection-manager.service';

@Module({
  imports: [
    PrismaModule,
    VectorModule,
    forwardRef(() => IngestionModule),
  ],
  controllers: [DataSourceController],
  providers: [
    {
      provide: DataSourceManagementService,
      useFactory: (prismaService: PrismaService, qdrantCollectionService: QdrantCollectionService) => {
        console.log('>>> Creating DataSourceManagementService with delayed document pipeline access and Qdrant collection service');
        // Return a version with PrismaService and QdrantCollectionService but null documentPipelineService
        return new DataSourceManagementService(prismaService, null, qdrantCollectionService);
      },
      inject: [PrismaService, QdrantCollectionService]
    },
    OrphanedDataCleanupService,
  ],
  exports: [DataSourceManagementService, OrphanedDataCleanupService]
})
export class DataSourceModule {} 