import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { QdrantCollectionService } from '../services/vector/collection-manager.service';
import { db } from '../config/database'; // Assuming direct db import is okay for now
import { Config, TasksConfig } from '../types';

@Injectable()
export class AggregationRefreshTaskService implements OnModuleInit {
  private readonly logger = new Logger(AggregationRefreshTaskService.name);
  private readonly intervalMs: number;

  constructor(
    private readonly qdrantService: QdrantCollectionService,
    private readonly configService: ConfigService,
  ) {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    // Default to 15 minutes if not configured
    this.intervalMs = tasksConfig.aggregationRefreshInterval || 15 * 60 * 1000;
  }

  async onModuleInit() {
    this.logger.log('Running initial Aggregation Refresh Task on startup...');
    await this.handleCron();
  }

  // Using a dynamic cron expression based on config is tricky, so using @Interval instead
  // Or setting a fixed default like EVERY_30_MINUTES
  @Cron(CronExpression.EVERY_30_MINUTES) // Defaulting to 30 mins, config controls if it *runs* logic
  async handleCron() {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    if (tasksConfig.aggregationRefreshInterval === 0) {
      // Explicitly disabled
      // this.logger.log('Aggregation Refresh Task is disabled via config (interval 0).');
      return;
    }
    // Actual interval check is complex with @Cron, better handled via enable/disable flag or logic inside

    this.logger.log('Running Aggregation Refresh Task...');
    try {
      // --- Add the original aggregation refresh logic here ---
      // This part needs the actual implementation from the old index.ts
      // Example placeholders:
      const collections = await this.qdrantService.listCollections();
      this.logger.debug(`Found collections: ${collections.join(', ')}`);

      const userCount = await db('users').count('* as count').first();
      this.logger.debug(`Current user count: ${userCount?.count}`);

      // TODO: Implement the actual aggregation logic
      this.logger.log('Placeholder for aggregation logic.');

      this.logger.log('Aggregation Refresh Task finished.');
    } catch (error) {
      this.logger.error('Aggregation Refresh Task failed', error);
    }
  }
} 