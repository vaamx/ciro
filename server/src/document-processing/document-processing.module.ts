import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

// Add improved Redis connection settings for Bull
const getBullQueueOptions = () => {
  return {
    name: 'document-processing',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 5000,  // 5 second connection timeout
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        if (times > 5) {
          console.error(`[Bull] Retry limit exceeded for Redis connection. Giving up.`);
          return null; // Give up after 5 retries
        }
        return Math.min(times * 100, 3000); // Incremental backoff capped at 3 seconds
      }
    }
  };
};

@Module({
  imports: [
    // Conditionally import Bull module with improved configuration
    ...(process.env.REDIS_DISABLED !== 'true' && process.env.NO_BULL !== 'true'
      ? [
          BullModule.registerQueue(getBullQueueOptions()),
        ]
      : []),
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class DocumentProcessingModule {} 