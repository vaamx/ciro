import { v4 as uuidv4 } from 'uuid';
import { DocumentProcessorService } from '../../services/document-processor.service';
import { FileType } from '../../types/file-types';
import { createLogger } from '../../utils/logger';
import { db } from '../../infrastructure/database';

// Define ProcessingState enum if not already defined elsewhere
export enum ProcessingState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Interface for the job object
export interface ProcessingJob {
  id: string;
  dataSourceId: string;
  filePath: string;
  fileType: FileType | string;
  fileName?: string;
  currentState: ProcessingState;
  previousState?: ProcessingState;
  metadata: Record<string, any>;
  totalChunks?: number;
  processedChunks?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: any;
  attempts: number;
  maxAttempts: number;
  error?: string;
}

/**
 * Manager for document processing jobs
 */
class DocumentProcessorManager {
  private jobs: Map<string, ProcessingJob>;
  private documentProcessor: DocumentProcessorService;
  private logger = createLogger('DocumentProcessorManager');

  constructor() {
    this.jobs = new Map();
    this.documentProcessor = DocumentProcessorService.getInstance();
    this.logger.info('Document Processor Manager initialized');
  }

  /**
   * Create a new document processing job
   */
  async createJob(
    filePath: string,
    fileType: FileType | string,
    dataSourceId: string,
    metadata: Record<string, any> = {}
  ): Promise<ProcessingJob> {
    const jobId = uuidv4();
    const fileName = filePath.split('/').pop() || '';

    // Create job object
    const job: ProcessingJob = {
      id: jobId,
      dataSourceId,
      filePath,
      fileType,
      fileName,
      currentState: ProcessingState.PENDING,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    // Store job in memory
    this.jobs.set(jobId, job);

    // Store job in database
    await db('document_processing_jobs').insert({
      id: jobId,
      data_source_id: dataSourceId,
      file_path: filePath,
      file_name: fileName,
      file_type: fileType,
      current_state: ProcessingState.PENDING,
      metadata: JSON.stringify(metadata),
      created_at: job.createdAt,
      updated_at: job.updatedAt
    });

    // Start processing in background
    this.processJob(job);

    return job;
  }

  /**
   * Process a job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    if (job.currentState !== ProcessingState.PENDING) {
      return;
    }

    try {
      // Update job state
      job.previousState = job.currentState;
      job.currentState = ProcessingState.PROCESSING;
      job.updatedAt = new Date();
      job.attempts += 1;

      // Update database
      await this.updateJobInDb(job);

      this.logger.info(`Processing document job ${job.id}`, {
        jobId: job.id,
        dataSourceId: job.dataSourceId,
        filePath: job.filePath,
        fileType: job.fileType,
        attempt: job.attempts
      });

      // Process document using the document processor service
      await this.documentProcessor.processDocument(
        job.filePath,
        job.fileType as FileType,
        job.dataSourceId,
        job.metadata
      );

      // Mark job as completed
      job.previousState = job.currentState;
      job.currentState = ProcessingState.COMPLETED;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      this.logger.info(`Document job ${job.id} completed successfully`, {
        jobId: job.id,
        dataSourceId: job.dataSourceId
      });

      // Update database
      await this.updateJobInDb(job);

      // Remove from memory after completion
      setTimeout(() => {
        this.jobs.delete(job.id);
      }, 3600000); // Keep in memory for 1 hour
    } catch (error) {
      this.logger.error(`Error processing document job ${job.id}`, {
        jobId: job.id,
        dataSourceId: job.dataSourceId,
        error
      });

      // Mark job as failed or retry
      if (job.attempts >= job.maxAttempts) {
        job.previousState = job.currentState;
        job.currentState = ProcessingState.FAILED;
        job.failedAt = new Date();
        job.error = error instanceof Error ? error.message : 'Unknown error';
      } else {
        job.previousState = job.currentState;
        job.currentState = ProcessingState.PENDING;
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => this.processJob(job), delay);
      }

      job.updatedAt = new Date();

      // Update database
      await this.updateJobInDb(job);
    }
  }

  /**
   * Update job record in database
   */
  private async updateJobInDb(job: ProcessingJob): Promise<void> {
    try {
      await db('document_processing_jobs')
        .where({ id: job.id })
        .update({
          current_state: job.currentState,
          previous_state: job.previousState,
          total_chunks: job.totalChunks,
          processed_chunks: job.processedChunks,
          updated_at: job.updatedAt,
          completed_at: job.completedAt,
          failed_at: job.failedAt,
          result: job.result ? JSON.stringify(job.result) : null,
          error: job.error,
          attempts: job.attempts
        });
    } catch (error) {
      this.logger.error(`Error updating job ${job.id} in database`, {
        jobId: job.id,
        error
      });
    }
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a data source
   */
  getJobsByDataSource(dataSourceId: string): ProcessingJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.dataSourceId === dataSourceId
    );
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return false;
    }
    
    if (job.currentState === ProcessingState.COMPLETED || 
        job.currentState === ProcessingState.FAILED) {
      return false;
    }
    
    job.previousState = job.currentState;
    job.currentState = ProcessingState.CANCELLED;
    job.updatedAt = new Date();
    
    // Update database
    await this.updateJobInDb(job);
    
    return true;
  }

  /**
   * Get processing metrics
   */
  getMetrics(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    pendingJobs: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(job => job.currentState === ProcessingState.PROCESSING).length,
      completedJobs: jobs.filter(job => job.currentState === ProcessingState.COMPLETED).length,
      failedJobs: jobs.filter(job => job.currentState === ProcessingState.FAILED).length,
      pendingJobs: jobs.filter(job => job.currentState === ProcessingState.PENDING).length
    };
  }
}

// Create singleton instance
export const documentProcessorManager = new DocumentProcessorManager(); 