import { ApiProperty } from '@nestjs/swagger';

export class JobResponseDto {
  @ApiProperty({ description: 'Unique identifier of the job' })
  id: string;

  @ApiProperty({ description: 'Unique identifier of the job, same as id' })
  jobId: string;

  @ApiProperty({ description: 'ID of the data source this job belongs to' })
  dataSourceId: string;

  @ApiProperty({ description: 'Current state of the job', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] })
  currentState: string;

  @ApiProperty({ description: 'Original filename if a file was uploaded', required: false })
  fileName?: string;

  @ApiProperty({ description: 'Progress percentage (0-100)', required: false })
  progress?: number;

  @ApiProperty({ description: 'Error message if job failed', required: false })
  error?: string;

  @ApiProperty({ description: 'When the job was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the job was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'When the job completed processing', required: false })
  completedAt?: Date;

  constructor(partial: Partial<JobResponseDto> = {}) {
    this.id = partial.id || '';
    this.jobId = partial.jobId || '';
    this.dataSourceId = partial.dataSourceId || '';
    this.currentState = partial.currentState || '';
    this.fileName = partial.fileName;
    this.progress = partial.progress;
    this.error = partial.error;
    this.createdAt = partial.createdAt || new Date();
    this.updatedAt = partial.updatedAt || new Date();
    this.completedAt = partial.completedAt;
  }
}

export class DataSourceJobsResponseDto {
  @ApiProperty({ description: 'ID of the data source' })
  dataSourceId: string;

  @ApiProperty({ description: 'List of active jobs (PENDING or PROCESSING)', type: [JobResponseDto] })
  activeJobs: JobResponseDto[];

  @ApiProperty({ description: 'List of completed jobs (COMPLETED, FAILED, or CANCELLED)', type: [JobResponseDto] })
  completedJobs: JobResponseDto[];

  constructor(partial: Partial<DataSourceJobsResponseDto> = {}) {
    this.dataSourceId = partial.dataSourceId || '';
    this.activeJobs = partial.activeJobs || [];
    this.completedJobs = partial.completedJobs || [];
  }
}

export class ProcessingMetricsResponseDto {
  @ApiProperty({ description: 'Total number of jobs' })
  totalJobs: number;

  @ApiProperty({ description: 'Number of pending jobs' })
  pendingJobs: number;

  @ApiProperty({ description: 'Number of processing jobs' })
  processingJobs: number;

  @ApiProperty({ description: 'Number of completed jobs' })
  completedJobs: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  failedJobs: number;

  @ApiProperty({ description: 'Number of cancelled jobs' })
  cancelledJobs: number;

  @ApiProperty({ description: 'Average processing time in seconds for completed jobs' })
  averageProcessingTimeSeconds: number;

  constructor(partial: Partial<ProcessingMetricsResponseDto> = {}) {
    this.totalJobs = partial.totalJobs || 0;
    this.pendingJobs = partial.pendingJobs || 0;
    this.processingJobs = partial.processingJobs || 0;
    this.completedJobs = partial.completedJobs || 0;
    this.failedJobs = partial.failedJobs || 0;
    this.cancelledJobs = partial.cancelledJobs || 0;
    this.averageProcessingTimeSeconds = partial.averageProcessingTimeSeconds || 0;
  }
} 