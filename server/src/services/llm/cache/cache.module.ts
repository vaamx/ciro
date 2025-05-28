import { Module, Global } from '@nestjs/common';
import { ICacheService } from './cache.interface';
import { InMemoryCacheService } from './in-memory-cache.service';
import { CACHE_SERVICE } from './constants';

@Global() // Make InMemoryCacheService available globally, or import CacheModule where needed
@Module({
  providers: [
    {
      provide: CACHE_SERVICE,
      useClass: InMemoryCacheService,
    },
  ],
  exports: [CACHE_SERVICE],
})
export class CacheModule {} 