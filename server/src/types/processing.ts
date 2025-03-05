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