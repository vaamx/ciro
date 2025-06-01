import { Module, Logger } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { DocumentProcessingModule } from '../document-processing/document-processing.module';
import { DataSourceManagementService } from '../../services/datasources/management';
import { ServicesModule } from '../../services.module';

@Module({
  imports: [
    PrismaModule,
    DocumentProcessingModule,
    ServicesModule // This provides DataSourceManagementService
  ],
  controllers: [FileController],
  providers: [
    FileService,
    Logger
  ],
  exports: [
    FileService
  ]
})
export class FileModule {} 