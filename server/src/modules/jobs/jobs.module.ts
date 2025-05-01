import { Module, forwardRef, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentJobConsumer } from './document.consumer';
import { ServicesModule } from '../../services.module';
import { DataSourceModule } from '../data-source/data-source.module';
import { IngestionModule } from '../../services/ingestion/ingestion.module';
import { DocumentProcessorManager } from '../../services/ingestion/document-processor-manager';
import { DataSourceProcessorService } from '../../services/ingestion/data-source-processor.service';
import { DataSourceManagementService } from '../../services/datasources/management/datasource-management.service';

// Check environment variables for Redis and Bull disabling
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

console.log('>>> JOBS MODULE: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> JOBS MODULE: NO_BULL =', IS_BULL_DISABLED);

// Define imports conditionally
const conditionalImports = [];

// Only import BullModule if neither Redis nor Bull are disabled
if (!IS_REDIS_DISABLED && !IS_BULL_DISABLED) {
  console.log('>>> JOBS MODULE: Importing BullModule.registerQueue');
  conditionalImports.push(
    BullModule.registerQueue({
      name: 'document-processing',
    })
  );
} else {
  console.log('>>> JOBS MODULE: Skipping BullModule.registerQueue');
}

@Module({
  imports: [
    forwardRef(() => ServicesModule),
    forwardRef(() => DataSourceModule),
    forwardRef(() => IngestionModule),
    ...conditionalImports, // Conditionally add BullModule
  ],
  providers: [
    {
      provide: DocumentJobConsumer,
      useFactory: (
        processorManager?: DocumentProcessorManager,
        dataSourceProcessorService?: DataSourceProcessorService,
        dataSourceManagementService?: DataSourceManagementService
      ) => {
        return new DocumentJobConsumer(
          processorManager as any,
          dataSourceProcessorService as any,
          dataSourceManagementService as any
        );
      },
      inject: [
        { token: DocumentProcessorManager, optional: true }, 
        { token: DataSourceProcessorService, optional: true },
        { token: DataSourceManagementService, optional: true }
      ]
    }
  ],
  exports: [DocumentJobConsumer]
})
export class JobsModule {} 