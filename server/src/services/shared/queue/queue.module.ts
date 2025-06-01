import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { ConfigModule } from '@nestjs/config';

// Define conditional imports based on environment variables
const IS_REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const IS_BULL_DISABLED = process.env.NO_BULL === 'true';

@Module({
  imports: [
    ConfigModule,
    // Only import Bull queue if Redis and Bull are enabled
    ...(IS_REDIS_DISABLED || IS_BULL_DISABLED ? [] : [
      BullModule.registerQueue({
        name: 'document-processing',
      })
    ])
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {} 