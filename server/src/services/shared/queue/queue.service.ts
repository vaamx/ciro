import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../core/database/prisma.service';
import * as path from 'path';
import { UPLOAD_DIR } from '../../../common/utils/upload';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue('document-processing') private readonly documentQueue: Queue | null
  ) {
    if (this.documentQueue) {
      this.logger.log('QueueService initialized with Bull queue');
    } else {
      this.logger.warn('QueueService initialized without Bull queue - jobs will be logged only');
    }
  }

  /**
   * Add a document processing job to the queue
   * @param job The document processing job details
   */
  async addDocumentProcessingJob(job: {
    jobId: string;
    dataSourceId: string;
    userId: string;
    s3Key?: string;
    content?: string;
    metadata?: Record<string, any>;
    fileType?: string;
  }): Promise<void> {
    this.logger.log(`Adding document processing job to queue: ${job.jobId}`);
    this.logger.debug('Job details:', job);

    // Try to get the file information from the database to determine the correct file path
    let filePath: string | undefined = job.s3Key; // Default to S3 key if available
    let organizationId = 1; // Default organization

    try {
      // Look up the data source to get organization and file information
      const dataSource = await this.prisma.data_sources.findUnique({
        where: { id: parseInt(job.dataSourceId) },
        include: {
          // We don't have a direct relation to files, so we'll use metadata
        }
      });

      if (dataSource) {
        organizationId = dataSource.workspace_id;
        
        // If config contains fileId, look up the actual file path
        const config = dataSource.config as any;
        if (config?.fileId) {
          try {
            const fileRecord = await this.prisma.files.findUnique({
              where: { id: config.fileId }
            });
            
            if (fileRecord) {
              // Construct the local file path
              filePath = path.join(
                UPLOAD_DIR,
                'organizations',
                organizationId.toString(),
                fileRecord.filename
              );
              this.logger.log(`Using local file path for processing: ${filePath}`);
            }
          } catch (fileError) {
            this.logger.warn(`Could not find file record for fileId ${config.fileId}, using S3 key or content`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not look up data source ${job.dataSourceId}, using default organization ID`);
    }

    // If Bull queue is available, add the job
    if (this.documentQueue) {
      try {
        const bullJob = await this.documentQueue.add('process-job', {
          jobId: job.jobId,
          dataSourceId: job.dataSourceId,
          organizationId: organizationId,
          userId: job.userId,
          fileType: job.fileType || 'text',
          filePath: filePath, // Use the resolved file path (local or S3)
          content: job.content,
          metadata: job.metadata || {}
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          },
          removeOnComplete: 5,
          removeOnFail: 10
        });
        
        this.logger.log(`Job ${job.jobId} successfully added to Bull queue with ID: ${bullJob.id}`);
        this.logger.log(`Job will process file: ${filePath || 'content-based'}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to add job ${job.jobId} to Bull queue: ${errorMessage}`);
        throw error;
      }
    } else {
      // Fallback to logging when queue is not available
      this.logger.warn(`Bull queue not available - job ${job.jobId} would be queued here`);
    }
  }

  /**
   * Cancel a document processing job
   * @param jobId The ID of the job to cancel
   */
  async cancelDocumentProcessingJob(jobId: string): Promise<void> {
    this.logger.log(`Cancelling document processing job: ${jobId}`);

    if (this.documentQueue) {
      try {
        // Find jobs by data.jobId and cancel them
        const jobs = await this.documentQueue.getJobs(['waiting', 'active', 'delayed']);
        const jobToCancel = jobs.find(j => j.data.jobId === jobId);
        
        if (jobToCancel) {
          await jobToCancel.remove();
          this.logger.log(`Job ${jobId} successfully cancelled`);
        } else {
          this.logger.warn(`Job ${jobId} not found in queue`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to cancel job ${jobId}: ${errorMessage}`);
        throw error;
      }
    } else {
      this.logger.warn(`Bull queue not available - cancellation of job ${jobId} would happen here`);
    }
  }
} 