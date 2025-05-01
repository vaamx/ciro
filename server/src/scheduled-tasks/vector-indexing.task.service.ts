import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QdrantCollectionService } from '../services/vector/collection-manager.service';
import { TasksConfig } from '../types/utils/config';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VectorIndexingTaskService {
  private readonly logger = new Logger(VectorIndexingTaskService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly qdrantCollectionService: QdrantCollectionService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const tasksConfig = this.configService.get<TasksConfig>('tasks');
    if (!tasksConfig?.indexingInterval) {
      this.logger.warn(
        'Vector indexing interval not configured, skipping scheduled task',
      );
      return;
    }

    const interval = setInterval(
      () => this.performVectorIndexing(),
      tasksConfig.indexingInterval,
    );
    this.schedulerRegistry.addInterval('vector-indexing', interval);
    this.logger.log(
      `Scheduled vector indexing task with interval ${tasksConfig.indexingInterval}ms`,
    );
  }

  async performVectorIndexing() {
    this.logger.log('Performing vector indexing');
    try {
      await this.qdrantCollectionService.reindexAllCollections();
      this.logger.log('Vector indexing completed successfully');
    } catch (error) {
      this.logger.error('Error during vector indexing:', error);
    }
  }
} 