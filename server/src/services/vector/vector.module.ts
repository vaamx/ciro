import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMModule } from '../llm';
import { QdrantClientService } from './qdrant-client.service';
import { QdrantCollectionService } from './collection-manager.service';
import { QdrantSearchService } from './search.service';
import { QdrantIngestionService } from './ingestion.service';
import { BaseSearchService } from './base-search.service';

/**
 * Isolated module for Qdrant vector services
 * This module is separate from ServicesModule to avoid circular dependency issues
 */
@Module({
  imports: [
    ConfigModule, // Needed for QdrantClientService
    LLMModule, // Needed for EmbeddingService (required by QdrantSearchService)
  ],
  providers: [
    QdrantClientService,
    QdrantCollectionService,
    QdrantSearchService,
    QdrantIngestionService,
  ],
  exports: [
    QdrantClientService,
    QdrantCollectionService,
    QdrantSearchService,
    QdrantIngestionService,
  ],
})
export class VectorModule {} 