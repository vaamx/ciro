/**
 * Shared type definitions to ensure consistency across the application
 */

// Base types used across the application
export type DataSourceType = 
  | 'database' 
  | 'crm' 
  | 'storage' 
  | 'analytics' 
  | 'sap' 
  | 'local-files' 
  | 'custom' 
  | 'crm-hubspot' 
  | 'warehouse' 
  | 'snowflake';

export type DataSourceStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'processing' 
  | 'error' 
  | 'syncing' 
  | 'ready' 
  | 'completed';

// Common error structure for consistent error handling
export interface ErrorInfo {
  message: string;
  phase?: string;
  timestamp?: string;
}

// Generic metrics structure
export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  lastError?: string | ErrorInfo;
}

// Local file specific types
export type LocalFileType = 'csv' | 'json' | 'xlsx' | 'pdf' | 'docx';

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
}

// Common interface for all data sources
export interface BaseDataSource {
  id?: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  description?: string;
  lastSync?: string;
  error?: string;
  metrics: DataSourceMetrics;
}

// Extended interfaces for specific data source types
export interface LocalFileDataSource extends BaseDataSource {
  type: 'local-files';
  metadata: LocalFileMetadata & {
    records: number;
    syncRate: number;
    avgSyncTime: string;
  };
}

export interface SnowflakeDataSource extends BaseDataSource {
  type: 'snowflake';
  metadata: {
    snowflake_account: string;
    snowflake_username: string;
    snowflake_password?: string; // Should be stored securely
    snowflake_warehouse?: string;
    snowflake_database?: string;
    snowflake_schema?: string;
    snowflake_role?: string;
    records: number;
    syncRate: number;
    avgSyncTime: string;
  };
}

// Union type of all data source types
export type DataSource = 
  | LocalFileDataSource 
  | SnowflakeDataSource
  | (BaseDataSource & { metadata?: Record<string, any> }); // For other types

// Type guard functions to check specific data source types
export function isLocalFileDataSource(dataSource: DataSource): dataSource is LocalFileDataSource {
  return dataSource.type === 'local-files';
}

export function isSnowflakeDataSource(dataSource: DataSource): dataSource is SnowflakeDataSource {
  return dataSource.type === 'snowflake';
}

// Adapter function to ensure metadata has required metrics fields
export function ensureMetricsInMetadata(metadata: any): any {
  if (!metadata) return undefined;
  
  return {
    ...metadata,
    records: metadata.records ?? 0,
    syncRate: metadata.syncRate ?? 100,
    avgSyncTime: metadata.avgSyncTime ?? '0s'
  };
} 