export type DataSourceType = 'local-files' | 'crm-hubspot' | 'snowflake';
export type DataSourceStatus = 'connected' | 'disconnected' | 'processing' | 'error' | 'syncing' | 'ready' | 'completed';

export interface ProcessingProgress {
  totalChunks: number;
  processedChunks: number;
  currentPhase: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  error?: string;
  warnings: string[];
  fileInfo: {
    size: number;
    type: string;
    name: string;
  };
}

export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  progress?: ProcessingProgress;
  lastError?: string | {
    message: string;
    phase: string;
  };
}

export interface HubSpotObjectData {
  total: number;
  synced: number;
  lastSync: string;
  records: Array<{
    id: string;
    properties: {
      [key: string]: string | undefined;
    };
  }>;
}

export interface HubSpotData {
  contacts: HubSpotObjectData;
  companies: HubSpotObjectData;
  deals: HubSpotObjectData;
}

export interface DataSourceMetadata {
  preview?: string;
  content?: any[];
  fileType?: string;
  [key: string]: any;
}

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  description?: string;
  lastSync?: string;
  metadata?: Record<string, any>;
  metrics: DataSourceMetrics;
  dataSourceType?: string;
} 