import { Module } from '@nestjs/common';
import { RedisHealthIndicator } from './redis.health';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';

@Module({
  imports: [
    HttpModule,
  ],
  providers: [
    RedisHealthIndicator,
    {
      provide: 'REDIS_HEALTH_INDICATOR',
      useExisting: RedisHealthIndicator,
    },
  ],
  controllers: [
    HealthController,
  ],
  exports: [
    RedisHealthIndicator,
    'REDIS_HEALTH_INDICATOR',
  ],
})
export class HealthModule {} 