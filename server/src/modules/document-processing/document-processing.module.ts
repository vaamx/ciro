import { Module, forwardRef } from '@nestjs/common';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './document-processing.service';
import { S3Module } from '../../services/shared/s3';
import { QueueModule } from '../../services/shared/queue';
import { AuthModule } from '../../core/auth/auth.module';
import { ServicesModule } from '../../services.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    PrismaModule,
    S3Module,
    QueueModule,
    AuthModule,
    ServicesModule,
    JobsModule,
  ],
  controllers: [DocumentProcessingController],
  providers: [DocumentProcessingService],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {} 