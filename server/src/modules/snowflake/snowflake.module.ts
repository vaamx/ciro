import { Module, Logger } from '@nestjs/common';
import { SnowflakeController } from './snowflake.controller';
import { SnowflakeService } from './snowflake.service';
import { SnowflakeNLQueryService } from '../../services/features/nl-query/snowflake/snowflake-nl-query.service';
import { AuthModule } from '../../core/auth/auth.module';
import { LLMModule } from '../../services/llm/llm.module';
import { ServicesModule } from '../../services.module';
import { SnowflakeSchemaIndexerService } from '../../services/datasources/processors/schema/snowflake/snowflake-schema-indexer.service';
import { RowLevelIndexerService } from '../../services/datasources/processors/schema/snowflake/row-level-indexer.service';
import { EventManager } from '../../services/util/event-manager';
import { WebSocketService } from '../../services/util/websocket.service';

@Module({
  imports: [
    AuthModule, // For authentication guards
    LLMModule, // For embedding services
    ServicesModule, // For QdrantCollectionService, QdrantIngestionService, DocumentChunkingService, EnhancedMetadataService
  ],
  controllers: [SnowflakeController],
  providers: [
    Logger,
    SnowflakeService,
    SnowflakeNLQueryService,
    // SnowflakeSchemaIndexerService, // Temporarily disabled due to RowLevelIndexerService dependency issues
    {
      provide: EventManager,
      useFactory: () => EventManager.getInstance(),
    },
    WebSocketService,
  ],
  exports: [
    SnowflakeService,
    SnowflakeNLQueryService,
    // SnowflakeSchemaIndexerService, // Temporarily disabled
  ],
})
export class SnowflakeModule {} 