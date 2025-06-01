import { Module, forwardRef, Provider } from '@nestjs/common';
import { DocumentJobConsumer } from './document.consumer';
import { ServicesModule } from '../../services.module';
import { DataSourceModule } from '../data-source/data-source.module';
import { IngestionModule } from '../../services/ingestion/ingestion.module';
import { DocumentProcessorManager } from '../../services/ingestion/document-processor-manager';
import { DataSourceProcessorService } from '../../services/ingestion/data-source-processor.service';
import { DataSourceManagementService } from '../../services/datasources/management/datasource-management.service';

@Module({
  imports: [
    forwardRef(() => ServicesModule),
    forwardRef(() => DataSourceModule),
    forwardRef(() => IngestionModule),
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