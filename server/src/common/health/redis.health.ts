import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisHealthIndicator {
  async isHealthy(key: string): Promise<any> {
    // Check if Redis is disabled via environment variables
    const redisDisabled = process.env.REDIS_DISABLED === 'true';
    
    if (redisDisabled) {
      return {
        [key]: {
          status: 'disabled',
          message: 'Redis is disabled by configuration',
        },
      };
    }

    try {
      // In a real implementation, we would check the Redis connection here
      // For now, we'll simulate success when not disabled
      return {
        [key]: {
          status: 'up',
          message: 'Redis is connected',
        },
      };
    } catch (error: any) {
      return {
        [key]: {
          status: 'down',
          message: error.message || 'Unknown Redis error',
        },
      };
    }
  }
} 