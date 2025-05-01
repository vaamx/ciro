import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DocumentPipelineService {
  private readonly logger = new Logger(DocumentPipelineService.name);
  private simulationMode = false;

  constructor(
    @Optional() @InjectQueue('document-processing') private readonly documentQueue: Queue
  ) {
    // Check if we're in simulation mode (no queue available)
    this.simulationMode = !this.documentQueue;
    this.logger.log(`DocumentPipelineService initialized in ${this.simulationMode ? 'SIMULATION' : 'STANDARD'} mode`);
  }

  async processDocument(documentId: string, options: any = {}): Promise<any> {
    this.logger.log(`Processing document ${documentId} with options: ${JSON.stringify(options)}`);
    
    if (this.simulationMode) {
      this.logger.log(`[SIMULATION] Document ${documentId} would be queued for processing`);
      // Return a simulated job ID
      return { 
        id: `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'simulated'
      };
    }

    try {
      // Add the job to the queue with proper options
      const job = await this.documentQueue.add('process', {
        documentId,
        ...options
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        timeout: 300000, // 5 minutes
        removeOnComplete: true
      });
      
      this.logger.log(`Document ${documentId} queued for processing. Job ID: ${job.id}`);
      return { id: job.id, status: 'queued' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to queue document ${documentId}: ${errorMessage}`, errorStack);
      throw new Error(`Failed to process document: ${errorMessage}`);
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    if (this.simulationMode) {
      this.logger.log(`[SIMULATION] Getting simulated status for job ${jobId}`);
      // Simulate a job status
      return { status: 'completed', data: { success: true, documentId: jobId.split('-')[1] } };
    }

    try {
      const job = await this.documentQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }
      
      const state = await job.getState();
      return { status: state, data: job.data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get status for job ${jobId}: ${errorMessage}`, errorStack);
      throw new Error(`Failed to get job status: ${errorMessage}`);
    }
  }
} 