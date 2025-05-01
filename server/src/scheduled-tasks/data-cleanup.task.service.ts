import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import knex from 'knex';
import { PrismaService } from '../core/database/prisma.service';
import { TasksConfig } from '../types/utils/config';

@Injectable()
export class DataCleanupTaskService implements OnModuleInit {
  private readonly logger = new Logger(DataCleanupTaskService.name);
  private readonly intervalMs: number;
  private db: any; // Use any for now since we don't have direct access to the db object

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    // Default to 24 hours if not configured
    this.intervalMs = tasksConfig.cleanupInterval || 24 * 60 * 60 * 1000;
    
    // Initialize db connection using the same approach as in database.ts
    // This is a fallback solution until the proper db import path is determined
    this.db = knex({
      client: 'pg',
      connection: this.configService.get('database')
    });
  }

  async onModuleInit() {
    this.logger.log('Running initial Data Cleanup Task on startup...');
    await this.handleCron();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM) // Defaulting to 3 AM daily
  async handleCron() {
    const tasksConfig = this.configService.get<TasksConfig>('tasks', {} as TasksConfig);
    if (tasksConfig.cleanupInterval === 0) {
      // this.logger.log('Data Cleanup Task is disabled via config (interval 0).');
      return;
    }

    this.logger.log('Running Data Cleanup Task...');
    try {
      // Get date threshold (30 days ago)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let messagesResult = 0;
      
      // Check if chat_messages table exists
      const hasChatMessagesTable = await this.tableExists('chat_messages');
      if (hasChatMessagesTable) {
        // Cleanup old chat messages that have been archived or summarized
        messagesResult = await this.db('chat_messages')
          .whereRaw("(metadata->>'archived')::boolean = true")
          .andWhere('created_at', '<', thirtyDaysAgo)
          .delete();
        
        this.logger.log(`Cleaned up ${messagesResult} archived chat messages`);
      } else {
        this.logger.log('Skipping chat messages cleanup - table does not exist');
      }
      
      let tempFilesResult = 0;
      
      // Check if uploaded_files table exists
      const hasUploadedFilesTable = await this.tableExists('uploaded_files');
      if (hasUploadedFilesTable) {
        // Cleanup temporary files older than 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        tempFilesResult = await this.db('uploaded_files')
          .where('is_temporary', true)
          .andWhere('created_at', '<', sevenDaysAgo)
          .delete();
        
        this.logger.log(`Cleaned up ${tempFilesResult} temporary files`);
      } else {
        this.logger.log('Skipping uploaded files cleanup - table does not exist');
      }
      
      this.logger.log('Data cleanup completed', {
        archivedMessagesRemoved: messagesResult,
        temporaryFilesRemoved: tempFilesResult
      });
    } catch (error) {
      this.logger.error('Data Cleanup Task failed', error);
    }
  }

  /**
   * Helper function to check if a table exists
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const exists = await this.db.schema.hasTable(tableName);
      return exists;
    } catch (error) {
      this.logger.error(`Error checking if table ${tableName} exists: ${error}`);
      return false;
    }
  }
} 