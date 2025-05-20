/**
 * Core type definitions for data sources that can be used across the application
 */

// Base types for all data sources
export type DataSourceType = 
  | 'local-files'   // Existing file data sources
  | 'crm-hubspot'   // Existing HubSpot integration
  | 'snowflake'     // New Snowflake integration
  | 'kafka'         // Future Kafka integration
  | 'database'      // Generic database connections
  | 'warehouse'     // Generic data warehouse
  | 'api'           // External API data sources
  | 'custom';       // Custom data sources

export type DataSourceStatus = 
  | 'connected'     // Successfully connected to data source
  | 'disconnected'  // Not currently connected
  | 'processing'    // Processing/ingesting data 
  | 'error'         // Error state
  | 'syncing'       // Syncing with remote source
  | 'ready'         // Ready for queries
  | 'completed';    // Processing completed

// Standardized error information format
export interface ErrorInfo {
  message: string;
  phase?: string;
  timestamp?: string;
  code?: string;
  details?: Record<string, any>;
}

// Common metrics for all data sources
export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  lastSync?: string; 
  lastError?: string | ErrorInfo;
  queryCount?: number;
  averageQueryTime?: string;
  totalQueries?: number;
}

// Base interface for all data sources
export interface BaseDataSource {
  id?: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  description?: string;
  lastSync?: string;
  organizationId?: number | string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  metrics: DataSourceMetrics;
  // Extended with embeddings-related properties
  embeddingsEnabled?: boolean;
  embeddingsModel?: string;
  embeddingsCount?: number;
}

// Processing progress interface used by multiple data source types
export interface ProcessingProgress {
  totalChunks: number;
  processedChunks: number;
  currentPhase: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  error?: string;
  warnings: string[];
  fileInfo?: {
    size: number;
    type: string;
    name: string;
  };
}

// Extended data source metrics with processing information
export interface DataSourceMetricsWithProgress extends DataSourceMetrics {
  progress?: ProcessingProgress;
}

// Type guard for checking if metrics include progress information
export function hasProgressInfo(metrics: DataSourceMetrics): metrics is DataSourceMetricsWithProgress {
  return 'progress' in metrics && !!(metrics as DataSourceMetricsWithProgress).progress;
}

// Type guard for error info
export function isErrorInfo(error: string | ErrorInfo | undefined): error is ErrorInfo {
  return typeof error === 'object' && error !== null && 'message' in error;
}

// Helper function to format error information consistently
export function formatErrorMessage(error: string | ErrorInfo | undefined): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message;
} 