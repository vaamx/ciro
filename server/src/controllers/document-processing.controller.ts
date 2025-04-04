import { Request, Response, ProcessingState, FileType } from '../types';
import { documentProcessorManager, ProcessingJob } from '../services/document-processing/document-processor-manager';
import { FileService } from '../services/file.service';
import { db } from '../config/database';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { detectFileType } from '../utils/file-utils';

export class DocumentProcessingController {
  private fileService: FileService;
  
  constructor() {
    this.fileService = new FileService();
  }
  
  /**
   * Create a new document processing job
   */
  async createJob(req: Request, res: Response): Promise<void> {
    try {
      const { dataSourceId } = req.body;
      const file = req.file;
      const { content, metadata } = req.body;
      
      if (!dataSourceId) {
        throw new BadRequestError('Data source ID is required');
      }
      
      // Check if data source exists
      const dataSource = await db('data_sources')
        .where({ id: dataSourceId })
        .first();
        
      if (!dataSource) {
        throw new NotFoundError(`Data source with ID ${dataSourceId} not found`);
      }
      
      let filePath: string;
      let fileType: FileType;
      
      if (file) {
        // Store file
        filePath = await this.fileService.storeFile(file, `doc_${dataSourceId}_${Date.now()}`);
        fileType = detectFileType(file.mimetype, file.originalname);
        
        logger.info(`Stored file for processing: ${filePath}`, {
          dataSourceId,
          fileType,
          fileName: file.originalname,
          fileSize: file.size
        });
      } else if (content) {
        // Store content to a file
        fileType = req.body.fileType || 'text';
        
        // Convert content to buffer
        const contentBuffer = typeof content === 'string' 
          ? Buffer.from(content) 
          : Buffer.from(JSON.stringify(content));
        
        // Store buffer to file
        filePath = await this.fileService.storeBuffer(
          contentBuffer,
          `doc_${dataSourceId}_${Date.now()}`
        );
        
        logger.info(`Stored content for processing: ${filePath}`, {
          dataSourceId,
          fileType,
          contentSize: contentBuffer.length
        });
      } else {
        throw new BadRequestError('Either file or content is required');
      }
      
      // Create job
      const jobMetadata = {
        ...metadata,
        uploadedBy: req.user?.id,
        uploadedAt: new Date().toISOString(),
        originalName: file?.originalname
      };
      
      const job = await documentProcessorManager.createJob(
        filePath,
        fileType,
        dataSourceId.toString(),
        jobMetadata
      );
      
      // Update data source status
      await db('data_sources')
        .where({ id: dataSourceId })
        .update({
          status: 'processing',
          updated_at: new Date()
        });
      
      res.status(202).json({
        message: 'Document processing job created',
        jobId: job.id,
        status: job.currentState,
        dataSourceId: job.dataSourceId
      });
    } catch (error) {
      logger.error('Error creating document processing job', { error });
      
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        res.status(error instanceof BadRequestError ? 400 : 404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to create document processing job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Get job status
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        throw new BadRequestError('Job ID is required');
      }
      
      // Get job from service
      const job = documentProcessorManager.getJob(jobId);
      
      if (!job) {
        // Check if job exists in database (might be a completed job)
        const dbJob = await db('document_processing_jobs')
          .where({ id: jobId })
          .first();
          
        if (!dbJob) {
          throw new NotFoundError(`Job with ID ${jobId} not found`);
        }
        
        // Return job from database
        res.json({
          id: dbJob.id,
          dataSourceId: dbJob.data_source_id,
          currentState: dbJob.current_state,
          fileName: dbJob.file_name,
          fileType: dbJob.file_type,
          totalChunks: dbJob.total_chunks,
          processedChunks: dbJob.processed_chunks,
          createdAt: dbJob.created_at,
          updatedAt: dbJob.updated_at,
          completedAt: dbJob.completed_at,
          failedAt: dbJob.failed_at,
          result: dbJob.result
        });
        return;
      }
      
      // Return job
      res.json({
        id: job.id,
        dataSourceId: job.dataSourceId,
        currentState: job.currentState,
        previousState: job.previousState,
        fileName: job.fileName,
        fileType: job.fileType,
        totalChunks: job.totalChunks,
        processedChunks: job.processedChunks,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        result: job.result,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      });
    } catch (error) {
      logger.error('Error getting job status', { error });
      
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        res.status(error instanceof BadRequestError ? 400 : 404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get job status',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Get all jobs for a data source
   */
  async getDataSourceJobs(req: Request, res: Response): Promise<void> {
    try {
      const { dataSourceId } = req.params;
      
      if (!dataSourceId) {
        throw new BadRequestError('Data source ID is required');
      }
      
      // Get active jobs from service
      const activeJobs = documentProcessorManager.getJobsByDataSource(dataSourceId);
      
      // Get completed jobs from database
      const completedJobs = await db('document_processing_jobs')
        .where({
          data_source_id: dataSourceId
        })
        .whereIn('current_state', [
          ProcessingState.COMPLETED, 
          ProcessingState.FAILED,
          ProcessingState.CANCELLED
        ])
        .orderBy('updated_at', 'desc')
        .limit(50)
        .select('*');
      
      // Combine and format jobs
      const formattedCompletedJobs = completedJobs.map((job: any) => ({
        id: job.id,
        dataSourceId: job.data_source_id,
        currentState: job.current_state,
        fileName: job.file_name,
        fileType: job.file_type,
        totalChunks: job.total_chunks,
        processedChunks: job.processed_chunks,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at,
        failedAt: job.failed_at,
        result: job.result
      }));
      
      const formattedActiveJobs = activeJobs.map((job: ProcessingJob) => ({
        id: job.id,
        dataSourceId: job.dataSourceId,
        currentState: job.currentState,
        previousState: job.previousState,
        fileName: job.fileName,
        fileType: job.fileType,
        totalChunks: job.totalChunks,
        processedChunks: job.processedChunks,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      }));
      
      res.json({
        activeJobs: formattedActiveJobs,
        completedJobs: formattedCompletedJobs
      });
    } catch (error) {
      logger.error('Error getting data source jobs', { error });
      
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        res.status(error instanceof BadRequestError ? 400 : 404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get data source jobs',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Cancel a job
   */
  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        throw new BadRequestError('Job ID is required');
      }
      
      // Cancel job
      const cancelled = await documentProcessorManager.cancelJob(jobId);
      
      if (!cancelled) {
        // Check if job exists
        const job = await db('document_processing_jobs')
          .where({ id: jobId })
          .first();
          
        if (!job) {
          throw new NotFoundError(`Job with ID ${jobId} not found`);
        }
        
        res.status(400).json({
          error: `Job with ID ${jobId} cannot be cancelled because it's in state ${job.current_state}`
        });
        return;
      }
      
      res.json({
        message: `Job ${jobId} cancelled successfully`
      });
    } catch (error) {
      logger.error('Error cancelling job', { error });
      
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        res.status(error instanceof BadRequestError ? 400 : 404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to cancel job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  
  /**
   * Get processing metrics
   */
  async getProcessingMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Get metrics from service
      const serviceMetrics = documentProcessorManager.getMetrics();
      
      // Get additional metrics from database
      const dbMetrics = await db.raw(`
        SELECT * FROM document_processing_job_stats
      `);
      
      res.json({
        serviceMetrics,
        dbMetrics: dbMetrics.rows
      });
    } catch (error) {
      logger.error('Error getting processing metrics', { error });
      
      res.status(500).json({
        error: 'Failed to get processing metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
} 