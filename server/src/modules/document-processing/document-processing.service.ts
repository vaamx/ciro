import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { JobStatus } from '../../core/database/prisma-types';
import { DataSourceTypeEnum, DataSourceProcessingStatus } from '../../types';
import { S3Service } from '../../services/shared/s3';
import { QueueService } from '../../services/shared/queue';
import { v4 as uuidv4 } from 'uuid';
import { CreateJobDto } from './dto/create-job.dto';
import { JobResponseDto, DataSourceJobsResponseDto, ProcessingMetricsResponseDto } from './dto/job-response.dto';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
// Use reference path directive instead of import for type declaration
/// <reference path="../../types/prisma-extensions.d.ts" />

// Update the interface to match Prisma types
interface ProcessingJob {
  id: string;
  dataSourceId: number;
  status: string;
  fileName: string | null;
  s3Key: string | null;
  metadata: any; // Use any instead of Prisma.JsonValue due to export issues
  content: string | null;
  fileType: string | null;
  progress: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

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
    // Validate data source exists and belongs to user
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { 
        id: parseInt(dataSourceId)
      },
    });

    if (!dataSource) {
      throw new NotFoundException(`Data source with ID ${dataSourceId} not found`);
    }

    // Validate that either file or content is provided
    if (!file && !content) {
      throw new BadRequestException('Either file or content must be provided');
    }

    let s3Key: string | undefined = undefined;
    let fileName: string | undefined = undefined;
    
    // Upload file to S3 if provided
    if (file) {
      fileName = file.originalname;
      s3Key = `documents/${userId}/${dataSourceId}/${uuidv4()}-${fileName}`;
      await this.s3Service.uploadFile(s3Key, file.buffer, file.mimetype);
      this.logger.log(`File uploaded to S3: ${s3Key}`);
    }

    // Create job record using Prisma without type assertion
    const job = await this.prisma.processingJob.create({
      data: {
        id: uuidv4(),
        dataSourceId: parseInt(dataSourceId),
        status: JobStatus.PENDING,
        fileName: fileName || null,
        s3Key: s3Key || null,
        metadata: metadata || {},
        content: content || null,
        fileType: fileType || null,
        progress: 0,
        error: null,
      }
    });
    
    this.logger.log(`Created processing job: ${job.id}`);

    // Add job to processing queue
    await this.queueService.addDocumentProcessingJob({
      jobId: job.id,
      dataSourceId,
      userId,
      s3Key,
      content,
      metadata,
      fileType,
    });

    return { jobId: job.id };
  }

  async getJobStatus(jobId: string): Promise<JobResponseDto> {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Map job to response DTO using constructor
    return new JobResponseDto({
      id: job.id,
      jobId: job.id,
      dataSourceId: String(job.dataSourceId),
      currentState: job.status as JobStatus,
      fileName: job.fileName || undefined,
      progress: job.progress || 0,
      error: job.error || undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt || undefined,
    });
  }

  async getDataSourceJobs(dataSourceId: string): Promise<DataSourceJobsResponseDto> {
    // Validate data source exists
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: parseInt(dataSourceId) },
    });

    if (!dataSource) {
      throw new NotFoundException(`Data source with ID ${dataSourceId} not found`);
    }

    // Get all jobs for this data source
    const jobs = await this.prisma.processingJob.findMany({
      where: { dataSourceId: parseInt(dataSourceId) },
      orderBy: { createdAt: 'desc' },
    });

    // Separate active and completed jobs
    const activeJobs = jobs.filter((job: ProcessingJob) => 
      job.status === JobStatus.PENDING || 
      job.status === JobStatus.PROCESSING);
    
    const completedJobs = jobs.filter((job: ProcessingJob) => 
      job.status === JobStatus.COMPLETED || 
      job.status === JobStatus.FAILED || 
      job.status === JobStatus.CANCELLED);

    // Map jobs to DTOs using constructors
    return new DataSourceJobsResponseDto({
      dataSourceId,
      activeJobs: activeJobs.map((job: ProcessingJob) => new JobResponseDto({
        id: job.id,
        jobId: job.id,
        dataSourceId: String(job.dataSourceId),
        currentState: job.status as JobStatus,
        fileName: job.fileName || undefined,
        progress: job.progress || 0,
        error: job.error || undefined,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt || undefined,
      })),
      completedJobs: completedJobs.map((job: ProcessingJob) => new JobResponseDto({
        id: job.id,
        jobId: job.id,
        dataSourceId: String(job.dataSourceId),
        currentState: job.status as JobStatus,
        fileName: job.fileName || undefined,
        progress: job.progress || 0,
        error: job.error || undefined,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt || undefined,
      })),
    });
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const job = await this.prisma.processingJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    // Check if job can be cancelled
    if (job.status === JobStatus.COMPLETED || 
        job.status === JobStatus.FAILED || 
        job.status === JobStatus.CANCELLED) {
      throw new BadRequestException(`Job ${jobId} is already in final state: ${job.status}`);
    }

    // Update job status
    await this.prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        updatedAt: new Date(),
        completedAt: new Date(),
      }
    });

    // Signal queue to cancel the job
    await this.queueService.cancelDocumentProcessingJob(jobId);

    return { success: true };
  }

  async getProcessingMetrics(): Promise<ProcessingMetricsResponseDto> {
    // Use Prisma for better performance on aggregations
    const metrics = await this.prisma.processingJob.findMany({
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Define types for the metrics calculation
    interface JobMetric {
      status: string;
      createdAt: Date;
      completedAt: Date | null;
    }

    const result = {
      totalJobs: metrics.length,
      pendingJobs: metrics.filter((job: JobMetric) => job.status === JobStatus.PENDING).length,
      processingJobs: metrics.filter((job: JobMetric) => job.status === JobStatus.PROCESSING).length,
      completedJobs: metrics.filter((job: JobMetric) => job.status === JobStatus.COMPLETED).length,
      failedJobs: metrics.filter((job: JobMetric) => job.status === JobStatus.FAILED).length,
      cancelledJobs: metrics.filter((job: JobMetric) => job.status === JobStatus.CANCELLED).length,
      averageProcessingTimeSeconds: metrics.reduce((total: number, job: JobMetric) => {
        if (job.status === JobStatus.COMPLETED && job.completedAt) {
          const processingTime = (job.completedAt.getTime() - job.createdAt.getTime()) / 1000;
          return total + processingTime;
        }
        return total;
      }, 0) / (metrics.filter((job: JobMetric) => job.status === JobStatus.COMPLETED && job.completedAt).length || 1),
    };
    
    return new ProcessingMetricsResponseDto({
      totalJobs: result.totalJobs,
      pendingJobs: result.pendingJobs,
      processingJobs: result.processingJobs,
      completedJobs: result.completedJobs,
      failedJobs: result.failedJobs,
      cancelledJobs: result.cancelledJobs,
      averageProcessingTimeSeconds: result.averageProcessingTimeSeconds,
    });
  }
} 