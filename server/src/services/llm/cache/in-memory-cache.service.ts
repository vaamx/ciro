import { Injectable, Logger } from '@nestjs/common';
import { ICacheService } from './cache.interface';

interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

@Injectable()
export class InMemoryCacheService implements ICacheService {
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();

  constructor() {
    this.logger.log('InMemoryCacheService initialized');
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.logger.debug(`Cache MISS for key: ${key}`);
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.logger.debug(`Cache EXPIRED for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`Cache HIT for key: ${key}`);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
    this.logger.debug(`Cache SET for key: ${key}${ttlSeconds ? ' with TTL: ' + ttlSeconds + 's' : ''}`);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.logger.debug(`Cache DELETE for key: ${key}`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('InMemoryCache cleared');
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key); // Clean up expired entry
      return false;
    }
    return true;
  }
} 