import { Controller, Get } from '@nestjs/common';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: await this.getRedisStatus(),
      }
    };
  }

  private async getRedisStatus() {
    try {
      const result = await this.redisHealth.isHealthy('redis');
      return result;
    } catch (error: unknown) {
      return { 
        status: 'down', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
} 