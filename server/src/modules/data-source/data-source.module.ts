import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { DataSourceController } from './data-source.controller';
import { DataSourceManagementService } from '../../services/datasources/management';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaService } from '../../core/database/prisma.service';
import { BullModule } from '@nestjs/bull';
import { IngestionModule } from '../../services/ingestion/ingestion.module';

// Check environment variables for Redis and Bull disabling
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

console.log('>>> DATA-SOURCE MODULE: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> DATA-SOURCE MODULE: NO_BULL =', IS_BULL_DISABLED);

// Define imports conditionally
const conditionalImports = [];

// Only import BullModule if neither Redis nor Bull are disabled
if (!IS_REDIS_DISABLED && !IS_BULL_DISABLED) {
  console.log('>>> DATA-SOURCE MODULE: Importing BullModule.registerQueue');
  conditionalImports.push(
    BullModule.registerQueue({
      name: 'document-processing',
    })
  );
} else {
  console.log('>>> DATA-SOURCE MODULE: Skipping BullModule.registerQueue');
}

@Module({
  imports: [
    PrismaModule,
    ...conditionalImports, // Conditionally add BullModule
    forwardRef(() => IngestionModule),
  ],
  controllers: [DataSourceController],
  providers: [
    {
      provide: DataSourceManagementService,
      useFactory: (prismaService: PrismaService) => {
        console.log('>>> Creating DataSourceManagementService with delayed document pipeline access');
        // Return a version with PrismaService but null documentPipelineService
        return new DataSourceManagementService(prismaService, null);
      },
      inject: [PrismaService]
    }
  ],
  exports: [DataSourceManagementService]
})
export class DataSourceModule {} 