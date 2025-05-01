/**
 * Represents the various data source types supported by the application
 */
export type DataSourceType = 
  | 'snowflake' 
  | 'file' 
  | '***REMOVED***ql' 
  | 'mysql'
  | 'excel'
  | 'csv'
  | 'pdf'
  | 'docx'
  | 'unknown';

/**
 * Interface for data source configuration
 */
export interface DataSourceConfig {
  id: string | number;
  name: string;
  type: DataSourceType;
  connectionParams: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Interface for data source status information
 */
export interface DataSourceStatus {
  id: string | number;
  status: 'ready' | 'loading' | 'error' | 'not_configured';
  lastUpdated?: Date;
  error?: string;
  stats?: {
    totalRecords?: number;
    embeddingsCount?: number;
    lastSync?: Date;
  };
}

export interface DataSource {
  id?: number;
  user_id?: string | number;
  created_by?: string | number;
  uploadedBy?: string | number;
  organization_id?: string | number;
  name: string;
  type?: string;
  provider?: string;
  status?: string;
  description?: string;
  credentials?: any;
  metadata?: any;
  config?: any;
  last_sync_at?: Date;
  created_at?: Date;
  updated_at?: Date;
  
  // File-specific fields
  filename?: string;
  originalFilename?: string;
  original_filename?: string;
  mimetype?: string;
  mime_type?: string;
  filetype?: string;
  file_type?: string;
  size?: number;
}

/**
 * Represents a record in a data source
 */
export interface DataSourceRecord {
  external_id: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  embedding?: number[];
}

// Renamed enum to avoid conflict with interface
export enum DataSourceProcessingStatus { 
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
  COMPLETED = 'completed'
}

// Define and export the DataSourceType enum
export enum DataSourceTypeEnum {
  SNOWFLAKE = 'snowflake',
  FILE = 'file',
  POSTGRESQL = '***REMOVED***ql',
  MYSQL = 'mysql',
  EXCEL = 'excel',
  CSV = 'csv',
  PDF = 'pdf',
  DOCX = 'docx',
  UNKNOWN = 'unknown'
  // Add others like WEB if needed
} 