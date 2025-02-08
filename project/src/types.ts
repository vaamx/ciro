export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  lastError?: string;
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

export interface DataSource {
  id: number;
  name: string;
  type: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync: string;
  metrics: DataSourceMetrics;
  data?: HubSpotData;
} 