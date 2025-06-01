import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { DocumentProcessorManager } from '../../services/ingestion/document-processor-manager';
import { DataSourceProcessorService } from '../../services/ingestion/data-source-processor.service';
import { FileType } from '../../types';
import { DataSourceManagementService } from '../../services/datasources/management/datasource-management.service';

// Update Job Data interface to support our new format
interface DocumentJobData {
  filePath?: string; // Make filePath optional since we may have content instead
  fileType: FileType;
  dataSourceId: string; // Keep as string from job payload initially
  organizationId: number;
  userId: string;
  metadata?: Record<string, any>;
  options?: Record<string, any>;
  content?: string; // Add content field to support text content instead of file
  jobId?: string; // Add jobId for tracking
}

@Processor('document-processing') // Specify the queue name
@Injectable()
export class DocumentJobConsumer {
  private readonly logger = new Logger(DocumentJobConsumer.name);

  constructor(
    private readonly processorManager?: DocumentProcessorManager,
    private readonly dataSourceProcessorService?: DataSourceProcessorService,
    private readonly dataSourceManagementService?: DataSourceManagementService
  ) {
    if (!this.processorManager) {
      this.logger.warn('DocumentProcessorManager is not available in DocumentJobConsumer');
    }
    
    if (!this.dataSourceProcessorService) {
      this.logger.warn('DataSourceProcessorService is not available in DocumentJobConsumer');
    }
    
    if (!this.dataSourceManagementService) {
      this.logger.warn('DataSourceManagementService is not available in DocumentJobConsumer - status updates will be skipped');
    }
    this.logger.log('DocumentJobConsumer initialized');
  }

  @Process('process-job') // Specify the job name
  async handleDocumentProcessing(job: Job<DocumentJobData>) {
    // Extract new fields from job data
    const { 
      filePath, 
      fileType, 
      dataSourceId: dataSourceIdString, 
      organizationId, 
      userId, 
      metadata, 
      options, 
      content,
      jobId
    } = job.data;
    
    const dataSourceId = parseInt(dataSourceIdString, 10);
    
    // Add jobId to logging context if available
    const jobContext = jobId ? `(ID: ${jobId})` : `(Bull ID: ${job.id})`;
    this.logger.log(`Processing job ${jobContext} for DS ${dataSourceId}, Org ${organizationId}, User ${userId}...`);

    if (isNaN(dataSourceId)) {
        this.logger.error(`Job ${jobContext} has invalid dataSourceId: ${dataSourceIdString}`);
        throw new Error('Invalid dataSourceId received in job'); // Fail the job
    }

    // Validate that we have either a file path or content
    if (!filePath && !content) {
        this.logger.error(`Job ${jobContext}: No file path or content provided`);
        await this.updateDsStatus(dataSourceId, organizationId, 'failed', { 
            error: 'No file path or content provided for processing' 
        });
        throw new Error('No file path or content provided for processing');
    }

    try {
      // 1. Set status to PROCESSING
      this.logger.log(`Job ${jobContext}: Updating status to PROCESSING for DS ${dataSourceId}`);
      await this.updateDsStatus(dataSourceId, organizationId, 'processing');

      // 2. Perform actual document processing
      this.logger.log(`Job ${jobContext}: Starting document processing for DS ${dataSourceId}`);
      
      if (this.dataSourceProcessorService && filePath) {
        // Use DataSourceProcessorService if available and we have a file path
        this.logger.log(`Job ${jobContext}: Processing document using DataSourceProcessorService`);
        await this.dataSourceProcessorService.processDocument(
          filePath,
          fileType,
          dataSourceIdString,
          metadata || {}
        );
      } else if (this.processorManager && filePath) {
        // Fallback to DocumentProcessorManager if available
        this.logger.log(`Job ${jobContext}: Processing document using DocumentProcessorManager`);
        await this.processorManager.createJob(
          filePath,
          fileType,
          dataSourceIdString,
          metadata || {}
        );
      } else if (content) {
        // Handle content-based processing (for text content without file)
        this.logger.log(`Job ${jobContext}: Processing text content directly`);
        // TODO: Implement direct content processing
        // For now, we'll simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
        this.logger.log(`Job ${jobContext}: Content processing completed (simulated)`);
      } else {
        // No processors available - log warning but don't fail
        this.logger.warn(`Job ${jobContext}: No document processors available, marking as completed without processing`);
      }

      // 3. Set status to READY after successful processing
      this.logger.log(`Job ${jobContext}: Updating status to READY for DS ${dataSourceId}`);
      await this.updateDsStatus(dataSourceId, organizationId, 'ready');

      this.logger.log(`Finished processing job ${jobContext} for DS ${dataSourceId}.`);
      return { status: 'completed', resultMetadata: {} }; 

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Job ${jobContext} failed for DS ${dataSourceId}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
        // 4. Set status to ERROR on failure
        await this.updateDsStatus(dataSourceId, organizationId, 'failed', { 
            error: `Job execution failed: ${errorMessage}` 
        });
        throw error; // Re-throw error to mark job as failed in Bull
    }
  }

  // Helper to update data source status
  private async updateDsStatus(dataSourceId: number, organizationId: number, status: string, details: Record<string, any> = {}) {
    // Skip if DataSourceManagementService is not available
    if (!this.dataSourceManagementService) {
      this.logger.warn(`Cannot update status for DS ${dataSourceId} to '${status}' - DataSourceManagementService not available`);
      return;
    }
    
    try {
      const errorMessage = details.error || null;
      
      // Use the injected DataSourceManagementService
      await this.dataSourceManagementService.updateStatus(
        dataSourceId,
        organizationId, // Pass organizationId
        status as any, // Cast to any, assuming updateStatus handles string or enum
        errorMessage
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update status for DS ${dataSourceId}: ${errorMessage}`);
    }
  }

  // Optional: Add listeners for queue events like completed, failed, stalled
  // @OnQueueActive()
  // onActive(job: Job) { ... }
  
  // @OnQueueCompleted()
  // onCompleted(job: Job, result: any) { ... }
  
  // @OnQueueFailed()
  // onFailed(job: Job, err: Error) { ... }
} 