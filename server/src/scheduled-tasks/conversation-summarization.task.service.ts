import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { conversationSummaryService } from '@services/util/conversation-summary.service'; // Use path alias
import { TasksConfig } from '../types/utils/config'; // Corrected relative path

@Injectable()
export class ConversationSummarizationTaskService implements OnModuleInit {
  private readonly logger = new Logger(ConversationSummarizationTaskService.name);
  private readonly intervalMs: number;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    // Default to 1 hour if not configured
    this.intervalMs = tasksConfig.summarizationInterval || 60 * 60 * 1000;
  }

  async onModuleInit() {
    this.logger.log('Running initial Conversation Summarization Task on startup...');
    await this.handleCron();
  }

  @Cron(CronExpression.EVERY_HOUR) // Defaulting to every hour
  async handleCron() {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    if (tasksConfig.summarizationInterval === 0) {
      // this.logger.log('Conversation Summarization Task is disabled via config (interval 0).');
      return;
    }

    this.logger.log('Running Conversation Summarization Task...');
    try {
      const result = await conversationSummaryService.summarizeActiveConversations();
      
      this.logger.log('Conversation summarization completed', {
        processed: result.processed,
        summarized: result.summarized,
        errors: result.errors
      });
    } catch (error) {
      this.logger.error('Conversation Summarization Task failed', error);
    }
  }
} 