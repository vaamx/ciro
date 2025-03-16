import { BaseDataSource } from '../core/data-source-types';

/**
 * Types for local file data sources, leveraging existing implementation
 */

// Supported file types - match your existing types
export type LocalFileType = 'csv' | 'json' | 'xlsx' | 'pdf' | 'docx';

// Structure representing a file chunk
export interface FileChunk {
  index: number;
  total: number;
  data: Uint8Array | string;
  id?: string;
  metadata?: Record<string, any>;
}

// Core metadata for local files, compatible with existing implementation
export interface LocalFileMetadata {
  id: string;
  filename: string;
  fileType: LocalFileType;
  size: number;
  uploadedAt: Date | string;
  lastModified: Date | string;
  status: 'ready' | 'processing' | 'error';
  records?: number;
  content?: any[] | string;
  preview?: string;
  metadata?: Record<string, any>;
  chunks?: any[];
  dataSourceId?: string;
  requiresEmbedding?: boolean;
  isExcelFile?: boolean;
  
  // Extensions for embeddings support
  embeddingStatus?: 'pending' | 'processing' | 'completed' | 'error';
  embeddingCount?: number;
  
  // Extended properties for advanced features
  processingOptions?: {
    chunkSize?: number;
    chunkOverlap?: number;
    embeddingModel?: string;
    includeMetadata?: boolean;
  };
}

// Local file data source type
export interface LocalFileDataSource extends BaseDataSource {
  type: 'local-files';
  fileType?: LocalFileType;
  metadata: LocalFileMetadata & {
    records: number;
    syncRate: number;
    avgSyncTime: string;
  };
  
  // Extensions for comprehensive data handling
  processingResults?: {
    totalChunks: number;
    completedChunks: number;
    errorChunks: number;
    embeddingsGenerated: number;
  };
}

// Type guard to check if a data source is a local file data source
export function isLocalFileDataSource(source: BaseDataSource): source is LocalFileDataSource {
  return source.type === 'local-files';
}

// Function to check if a file type is supported
export function isSupportedFileType(fileType: string): fileType is LocalFileType {
  return ['csv', 'json', 'xlsx', 'pdf', 'docx'].includes(fileType);
} 