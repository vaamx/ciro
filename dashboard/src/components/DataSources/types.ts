export type DataSourceType = 'database' | 'crm' | 'storage' | 'analytics' | 'sap' | 'local-files' | 'custom' | 'crm-hubspot' | 'warehouse' | 'snowflake';
export type DataSourceStatus = 'connected' | 'disconnected' | 'processing' | 'error' | 'syncing' | 'ready' | 'completed';

export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  lastError?: string | { phase: string; message: string; timestamp: string };
}

export interface HubSpotContactProperties {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  company?: string;
  jobtitle?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  lifecyclestage?: string;
  lastmodifieddate?: string;
  createdate?: string;
  associatedcompanyid?: string;
  [key: string]: string | undefined;
}

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
}

export interface HubSpotCompany {
  id: string;
  properties: {
    domain?: string;
    name?: string;
    hubspot_owner_id?: string;
    industry?: string;
    type?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    timezone?: string;
    description?: string;
    linkedin_company_page?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: any;
  };
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    lastmodifieddate?: string;
    hubspot_owner_id?: string;
    associated_company?: string;
    associated_vids?: string[];
    [key: string]: any;
  };
}

export interface HubSpotActivity {
  id: string;
  type: string;
  timestamp: string;
  properties: Record<string, string | number | boolean | null>;
}

export interface HubSpotData {
  contacts: {
    total: number;
    synced: number;
    lastSync: string;
    records: HubSpotContact[];
  };
  companies: {
    total: number;
    synced: number;
    lastSync: string;
    records: HubSpotCompany[];
  };
  deals: {
    total: number;
    synced: number;
    lastSync: string;
    records: HubSpotDeal[];
  };
  activities?: {
    total: number;
    synced: number;
    lastSync: string;
    records: HubSpotActivity[];
  };
}

export type LocalFileType = 'csv' | 'json' | 'xlsx' | 'pdf' | 'docx';

export interface FileChunk {
  index: number;
  total: number;
  data: Uint8Array;
}

export interface LocalFileMetadata {
  id: string;
  filename: string;
  originalFilename?: string;
  fileType: LocalFileType;
  size: number;
  uploadedAt: Date;
  lastModified: Date;
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

export interface LocalFileData {
  metadata: LocalFileMetadata;
  content: any[] | string;
  preview: string;
}

export interface DataSource {
  id?: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  description?: string;
  lastSync?: string;
  error?: string;
  metrics: {
    records: number;
    syncRate: number;
    avgSyncTime: string;
    lastError?: string;
  };
  metadata?: LocalFileMetadata & {
    records: number;
    syncRate: number;
    avgSyncTime: string;
  };
  data?: HubSpotData;
} 