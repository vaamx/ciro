/**
 * Types for data processing and analysis
 */

export enum ProcessingStage {
  INITIALIZING = 'Initializing',
  ANALYZING_QUERY = 'Analyzing Query',
  DETERMINING_OPERATIONS = 'Determining Operations',
  PREPROCESSING_DATA = 'Preprocessing Data',
  ENHANCING_DATA = 'Enhancing Data',
  GENERATING_RESPONSE = 'Generating Response',
  PARSING_RESPONSE = 'Parsing Response',
  PREPARING_VISUALIZATION = 'Preparing Visualization',
  COMPLETED = 'Completed'
}

export enum DataSourceType {
  EXCEL = 'excel',
  CSV = 'csv',
  PDF = 'pdf',
  DOC = 'document',
  TEXT = 'text',
  JSON = 'json',
  TABLE = 'table', // Any generic tabular data
  UNKNOWN = 'unknown'
}

export enum AnalyticalOperationType {
  SUMMARIZE = 'summarize',
  COUNT = 'count',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  TREND = 'trend',
  FORECAST = 'forecast',
  COMPARE = 'compare',
  CORRELATE = 'correlate',
  SEGMENT = 'segment',
  RANK = 'rank',
  CATEGORIZE = 'categorize',
  CLASSIFY = 'classify',
  CLUSTER = 'cluster',
  ANOMALY_DETECTION = 'anomaly_detection'
}

export enum VisualizationType {
  BAR_CHART = 'bar_chart',
  LINE_CHART = 'line_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_PLOT = 'scatter_plot',
  AREA_CHART = 'area_chart',
  BUBBLE_CHART = 'bubble_chart',
  HEATMAP = 'heatmap',
  TABLE = 'table',
  NONE = 'none'
}

export type ProgressCallback = (stage: ProcessingStage, progress: number, message?: string) => void;

export interface AnalysisStep {
  id: string;
  type: string;
  description: string;
  content?: string;
  order: number;
  data?: any;
}

export interface StructuredAnalysisResponse {
  summary: string;
  steps: AnalysisStep[];
  insights: string[];
  visualization?: {
    type: string;
    config: any;
  };
}

export interface ProcessingProgress {
  totalChunks: number;
  processedChunks: number;
  currentPhase: ProcessingPhase;
  startTime: Date;
  estimatedTimeRemaining?: number;
  error?: string;
  warnings: string[];
  status: ProcessingStatus;
  fileInfo: {
    size: number;
    type: string;
    name: string;
  };
}

export type ProcessingPhase = 
  | 'validation'
  | 'sanitization'
  | 'loading'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'complete'
  | 'failed';

export type ProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed';

export interface ProcessingOptions {
  validateContent?: boolean;
  sanitizeContent?: boolean;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  progressCallback?: (progress: ProcessingProgress) => void;
  sanitizationRules?: SanitizationRule[];
  validationRules?: ValidationRule[];
  chunkSize?: number;
  chunkOverlap?: number;
  useSemanticChunking?: boolean;
  dataSourceId?: number;
  collectionName?: string;
  organizationId?: number;
  [key: string]: any;
}

export interface SanitizationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

export interface ValidationRule {
  validate: (content: string | Buffer) => boolean | Promise<boolean>;
  errorMessage: string;
}

export const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  {
    pattern: /[^\x20-\x7E\n\r\t]/g, // Remove non-printable characters
    replacement: '',
    description: 'Remove non-printable characters'
  },
  {
    pattern: /(\r\n|\r|\n){3,}/g, // Normalize multiple line breaks
    replacement: '\n\n',
    description: 'Normalize multiple line breaks'
  },
  {
    pattern: /[\u0000-\u001F\u007F-\u009F]/g, // Remove control characters
    replacement: '',
    description: 'Remove control characters'
  }
];

export const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  {
    validate: (content) => {
      if (typeof content === 'string') {
        return content.length > 0;
      }
      return Buffer.isBuffer(content) && content.length > 0;
    },
    errorMessage: 'Content cannot be empty'
  },
  {
    validate: (content) => {
      if (typeof content === 'string') {
        return content.length <= 10_000_000; // 10MB text limit
      }
      return Buffer.isBuffer(content) && content.length <= 50_000_000; // 50MB binary limit
    },
    errorMessage: 'Content exceeds maximum size limit'
  }
]; 