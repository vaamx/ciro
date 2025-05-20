import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ServicesModule } from '../services.module';
// import { ConversationSummaryModule } from '../services/util/conversation-summary.module'; // If conversationSummaryService becomes injectable

import { AggregationRefreshTaskService } from './aggregation-refresh.task.service';
import { ConversationSummarizationTaskService } from './conversation-summarization.task.service';
import { DataCleanupTaskService } from './data-cleanup.task.service';
import { VectorIndexingTaskService } from './vector-indexing.task.service';
import { ChatModule } from '@modules/chat/chat.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule, // Needed for accessing config values
    ServicesModule, // Provides QdrantCollectionService, QdrantClientService via ServicesModule
    ChatModule, // Provide ConversationService
    // ConversationSummaryModule, // Uncomment if conversationSummaryService is refactored
  ],
  providers: [
    AggregationRefreshTaskService,
    ConversationSummarizationTaskService,
    DataCleanupTaskService,
    VectorIndexingTaskService,
  ],
  exports: [ 
    // Export services if they need to be injected elsewhere, otherwise remove exports
    AggregationRefreshTaskService,
    ConversationSummarizationTaskService,
    DataCleanupTaskService,
    VectorIndexingTaskService,
  ],
})
export class ScheduledTasksModule {} 