import { DataSource } from './types';

export const mockDataSources: DataSource[] = [
  {
    id: '1',
    name: 'Customer Database',
    description: 'Primary PostgreSQL database for customer data',
    type: 'database',
    status: 'connected',
    lastSync: '5 mins ago',
    metrics: {
      records: 1250000,
      syncRate: 98,
      avgSyncTime: '45s'
    }
  },
  {
    id: '2',
    name: 'Sales Analytics',
    description: 'BigQuery data warehouse for sales analytics',
    type: 'warehouse',
    status: 'syncing',
    lastSync: 'In progress',
    metrics: {
      records: 5000000,
      syncRate: 95,
      avgSyncTime: '2m'
    }
  },
  {
    id: '3',
    name: 'Marketing CRM',
    description: 'HubSpot CRM integration for marketing data',
    type: 'crm-hubspot',
    status: 'error',
    lastSync: '1 hour ago',
    metrics: {
      records: 750000,
      syncRate: 85,
      avgSyncTime: '1.5m',
      lastError: 'API rate limit exceeded'
    }
  }
]; 