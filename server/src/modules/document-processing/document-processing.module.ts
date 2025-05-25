import { Module, forwardRef } from '@nestjs/common';
import { DocumentProcessingController } from './document-processing.controller';
import { DocumentProcessingService } from './document-processing.service';
import { S3Module } from '../../services/shared/s3';
import { QueueModule } from '../../services/shared/queue';
import { AuthModule } from '../../core/auth/auth.module';
import { BullModule } from '@nestjs/bull';
import { ServicesModule } from '../../services.module';
import { PrismaModule } from '../../core/database/prisma.module';
import { JobsModule } from '../jobs/jobs.module';

// Check environment variables for Redis and Bull disabling
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

console.log('>>> DOCUMENT-PROCESSING MODULE: REDIS_DISABLED =', IS_REDIS_DISABLED);
console.log('>>> DOCUMENT-PROCESSING MODULE: NO_BULL =', IS_BULL_DISABLED);

// Define imports conditionally
const conditionalImports = [];

// Only import BullModule if neither Redis nor Bull are disabled
if (!IS_REDIS_DISABLED && !IS_BULL_DISABLED) {
  console.log('>>> DOCUMENT-PROCESSING MODULE: Importing BullModule.registerQueue');
  conditionalImports.push(
    BullModule.registerQueue({
      name: 'document-processing'
    })
  );
} else {
  console.log('>>> DOCUMENT-PROCESSING MODULE: Skipping BullModule.registerQueue');
}

@Module({
  imports: [
    PrismaModule,
    S3Module,
    QueueModule,
    AuthModule,
    ...conditionalImports, // Conditionally add BullModule
    ServicesModule,
    JobsModule,
  ],
  controllers: [DocumentProcessingController],
  providers: [DocumentProcessingService],
  exports: [DocumentProcessingService],
})
export class DocumentProcessingModule {} 