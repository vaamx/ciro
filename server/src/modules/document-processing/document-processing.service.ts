import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../core/database/prisma.service';
import { processing_jobs, Prisma } from '@prisma/client';
import { JobResponseDto, DataSourceJobsResponseDto, ProcessingMetricsResponseDto } from './dto/job-response.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { S3Service } from '../../services/shared/s3/s3.service';
import { QueueService } from '../../services/shared/queue/queue.service';
import { JobStatus } from '../../core/database/prisma-types';

@Injectable()
export class DocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly queueService: QueueService,
  ) {}

  async createJob(
    file: Express.Multer.File,
    dataSourceId: string,
    metadata: Record<string, any> = {},
    userId: string,
    content?: string,
    fileType?: string,
  ): Promise<{ jobId: string }> {
    this.logger.log(`Creating processing job for dataSource: ${dataSourceId}`);
    
    // Validate inputs
    if (!file && !content) {
      throw new BadRequestException('Either file or content must be provided');
    }

    let s3Key: string | undefined = undefined;
    let fileName: string | undefined = undefined;
    
    // Upload file to S3 if provided and S3 is configured
    if (file) {
      fileName = file.originalname;
      s3Key = `documents/${userId}/${dataSourceId}/${uuidv4()}-${fileName}`;
      
      try {
        // Check if S3 is properly configured before attempting upload
        const bucketName = process.env.S3_BUCKET;
        if (bucketName && bucketName !== 'your-bucket-name') {
          await this.s3Service.uploadFile(s3Key, file.buffer, file.mimetype);
          this.logger.log(`File uploaded to S3: ${s3Key}`);
        } else {
          this.logger.log(`S3 not configured (bucket: ${bucketName}), skipping S3 upload. File is already saved locally.`);
          s3Key = undefined; // Don't store S3 key if not uploaded
        }
      } catch (error) {
        this.logger.warn(`S3 upload failed: ${error.message}. Continuing with local file storage.`);
        s3Key = undefined; // Don't store S3 key if upload failed
      }
    }

    // Create job record using Prisma with correct field names and types
    const jobData: Prisma.processing_jobsUncheckedCreateInput = {
      id: uuidv4(),
      data_source_id: parseInt(dataSourceId),
      status: JobStatus.PENDING,
      file_name: fileName || null,
      s3_key: s3Key || null,
      metadata: metadata as Prisma.JsonValue || {},
      content: content || null,
      file_type: fileType || null,
      progress: 0,
      error: null,
      updated_at: new Date(),
      // created_at will be set automatically by Prisma default
    };

    const job = await this.prisma.processing_jobs.create({
      data: jobData
    });
    
    this.logger.log(`Created processing job: ${job.id}`);

    // Add job to processing queue
    await this.queueService.addDocumentProcessingJob({
      jobId: job.id,
      dataSourceId,
      userId,
      s3Key,
      content,
      fileType,
    });

    return { jobId: job.id };
  }

  async getJobStatus(jobId: string): Promise<JobResponseDto> {
    const job = await this.prisma.processing_jobs.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return new JobResponseDto({
      id: job.id,
      jobId: job.id,
      dataSourceId: String(job.data_source_id),
      currentState: job.status as JobStatus,
      fileName: job.file_name || undefined,
      progress: (job.progress as number) || 0,
      error: job.error || undefined,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at || undefined,
    });
  }

  async getDataSourceJobs(dataSourceId: string): Promise<DataSourceJobsResponseDto> {
    this.logger.log(`Getting jobs for dataSource: ${dataSourceId}`);

    // Get all jobs for this data source
    const jobs = await this.prisma.processing_jobs.findMany({
      where: { data_source_id: parseInt(dataSourceId) },
      orderBy: { created_at: 'desc' },
    });

    // Separate active and completed jobs using the actual Prisma type
    const activeJobs = jobs.filter((job) => 
      job.status === JobStatus.PENDING || 
      job.status === JobStatus.PROCESSING);
    
    const completedJobs = jobs.filter((job) => 
      job.status === JobStatus.COMPLETED || 
      job.status === JobStatus.FAILED || 
      job.status === JobStatus.CANCELLED);

    // Map jobs to DTOs
    return new DataSourceJobsResponseDto({
      dataSourceId,
      activeJobs: activeJobs.map((job) => new JobResponseDto({
        id: job.id,
        jobId: job.id,
        dataSourceId: String(job.data_source_id),
        currentState: job.status as JobStatus,
        fileName: job.file_name || undefined,
        progress: (job.progress as number) || 0,
        error: job.error || undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at || undefined,
      })),
      completedJobs: completedJobs.map((job) => new JobResponseDto({
        id: job.id,
        jobId: job.id,
        dataSourceId: String(job.data_source_id),
        currentState: job.status as JobStatus,
        fileName: job.file_name || undefined,
        progress: (job.progress as number) || 0,
        error: job.error || undefined,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at || undefined,
      })),
    });
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    this.logger.log(`Cancelling job: ${jobId}`);
    
    // Update job status to cancelled
    const updatedJob = await this.prisma.processing_jobs.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        updated_at: new Date(),
        completed_at: new Date(),
      }
    });

    this.logger.log(`Job ${jobId} cancelled successfully`);
    return { success: true };
  }

  async getProcessingMetrics(): Promise<ProcessingMetricsResponseDto> {
    // Get job metrics from database
    const metrics = await this.prisma.processing_jobs.findMany({
      select: {
        status: true,
        created_at: true,
        completed_at: true,
      },
    });

    // Calculate metrics using the actual Prisma type
    const result = {
      totalJobs: metrics.length,
      pendingJobs: metrics.filter((job) => job.status === JobStatus.PENDING).length,
      processingJobs: metrics.filter((job) => job.status === JobStatus.PROCESSING).length,
      completedJobs: metrics.filter((job) => job.status === JobStatus.COMPLETED).length,
      failedJobs: metrics.filter((job) => job.status === JobStatus.FAILED).length,
      cancelledJobs: metrics.filter((job) => job.status === JobStatus.CANCELLED).length,
      averageProcessingTimeSeconds: metrics.reduce((total: number, job) => {
        if (job.status === JobStatus.COMPLETED && job.completed_at) {
          const processingTime = (job.completed_at.getTime() - job.created_at.getTime()) / 1000;
          return total + processingTime;
        }
        return total;
      }, 0) / (metrics.filter((job) => job.status === JobStatus.COMPLETED && job.completed_at).length || 1),
    };
    
    return new ProcessingMetricsResponseDto({
      totalJobs: result.totalJobs,
      pendingJobs: result.pendingJobs,
      processingJobs: result.processingJobs,
      completedJobs: result.completedJobs,
      failedJobs: result.failedJobs,
      cancelledJobs: result.cancelledJobs,
      averageProcessingTimeSeconds: Math.round(result.averageProcessingTimeSeconds * 100) / 100,
    });
  }
} 