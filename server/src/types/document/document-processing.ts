

export enum ProcessingState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  VALIDATING = 'validating',
  EXTRACTING = 'extracting',
  PARSING = 'parsing',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
  STORING = 'storing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Detailed status for each processing stage
 */
export interface ProcessingStageStatus {
  state: ProcessingState;
  startTime?: Date;
  endTime?: Date;
  progress?: number; // 0-100
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Represents a document job throughout the processing pipeline
 */
export interface DocumentProcessingJob {
  id: string;
  dataSourceId: string;
  filePath: string;
  fileType: string;
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
}

/**
 * Event types emitted during document processing
 */
export enum ProcessingEventType {
  JOB_CREATED = 'job_created',
  STATE_CHANGED = 'state_changed',
  PROGRESS_UPDATED = 'progress_updated',
  ERROR_OCCURRED = 'error_occurred',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed'
}

/**
 * Processing event structure
 */
export interface ProcessingEvent {
  type: ProcessingEventType;
  jobId: string;
  timestamp: Date;
  data: {
    state?: ProcessingState;
    previousState?: ProcessingState;
    progress?: number;
    error?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Error types that can occur during processing
 */
export enum ProcessingErrorType {
  VALIDATION_ERROR = 'validation_error',
  FILE_ACCESS_ERROR = 'file_access_error',
  PARSING_ERROR = 'parsing_error',
  CHUNKING_ERROR = 'chunking_error',
  EMBEDDING_ERROR = 'embedding_error',
  DATABASE_ERROR = 'database_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Retry strategy for failed processing stages
 */
export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrors: ProcessingErrorType[];
}

/**
 * Default retry strategies for different processing stages
 */
export const DEFAULT_RETRY_STRATEGIES: Record<ProcessingState, RetryStrategy> = {
  [ProcessingState.VALIDATING]: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.FILE_ACCESS_ERROR
    ]
  },
  [ProcessingState.EXTRACTING]: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.FILE_ACCESS_ERROR,
      ProcessingErrorType.PARSING_ERROR
    ]
  },
  [ProcessingState.PARSING]: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.PARSING_ERROR,
      ProcessingErrorType.UNKNOWN_ERROR
    ]
  },
  [ProcessingState.CHUNKING]: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.CHUNKING_ERROR,
      ProcessingErrorType.UNKNOWN_ERROR
    ]
  },
  [ProcessingState.EMBEDDING]: {
    maxAttempts: 5,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.EMBEDDING_ERROR,
      ProcessingErrorType.RATE_LIMIT_ERROR,
      ProcessingErrorType.TIMEOUT_ERROR
    ]
  },
  [ProcessingState.STORING]: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 15000,
    backoffFactor: 2,
    retryableErrors: [
      ProcessingErrorType.DATABASE_ERROR,
      ProcessingErrorType.UNKNOWN_ERROR
    ]
  },
  // Terminal states don't need retry strategies
  [ProcessingState.PENDING]: {
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffFactor: 1,
    retryableErrors: []
  },
  [ProcessingState.PROCESSING]: {
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffFactor: 1,
    retryableErrors: []
  },
  [ProcessingState.COMPLETED]: {
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffFactor: 1,
    retryableErrors: []
  },
  [ProcessingState.FAILED]: {
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffFactor: 1,
    retryableErrors: []
  },
  [ProcessingState.CANCELLED]: {
    maxAttempts: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffFactor: 1,
    retryableErrors: []
  }
};

/**
 * Processing metrics for monitoring
 */
export interface ProcessingMetrics {
  totalJobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  averageProcessingTimeMs: Record<ProcessingState, number>;
  averageTotalProcessingTimeMs: number;
  errorRates: Record<ProcessingErrorType, number>;
  throughput: number; // jobs per minute
  batchSize: number;
  processingLoad: number; // 0-1 representing current load
}

/**
 * Embedding cache interface
 */
export interface EmbeddingCache {
  get(text: string): number[] | undefined;
  set(text: string, embedding: number[]): void;
  has(text: string): boolean;
  delete(text: string): boolean;
  clear(): void;
  size(): number;
  getStats(): {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  };
}

export interface DocumentChunk {
  content: string;
  metadata: Record<string, any>;
  similarity?: number;
} 