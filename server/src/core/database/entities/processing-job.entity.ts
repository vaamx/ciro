import { JobStatus } from './job-status.enum';

export class ProcessingJob {
  id!: string;

  dataSourceId!: string;

  status!: JobStatus;

  fileName?: string;

  s3Key?: string;

  metadata?: Record<string, any>;

  content?: string;

  fileType?: string;

  progress?: number;

  error?: string;

  createdAt!: Date;

  updatedAt!: Date;

  completedAt?: Date;
} 