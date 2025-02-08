export type DataSourceType = 'hubspot' | 'database' | 'file' | 'api' | 'warehouse' | 'crm' | 'crm-hubspot';
export type DataSourceStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

export interface DataSourceMetrics {
  records: number;
  syncRate: number;
  avgSyncTime: string;
  lastError?: string;
}

export interface HubSpotContact {
  id: string;
  properties: {
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
    [key: string]: any;
  };
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
  properties: {
    [key: string]: any;
  };
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

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  status: DataSourceStatus;
  description?: string;
  lastSync?: string | Date;
  error?: string;
  metrics: DataSourceMetrics;
  data?: HubSpotData;
} 