import { Client as HubSpotClient } from '@hubspot/api-client';
import { PostgresConnector } from './***REMOVED***';

// Base interface for all data source connectors
export interface DataSourceConnector {
  connect(): Promise<void>;
  query(query: string): Promise<any>;
  disconnect(): Promise<void>;
}

// HubSpot connector implementation
class HubSpotConnector implements DataSourceConnector {
  private client: HubSpotClient;

  constructor() {
    this.client = new HubSpotClient({ accessToken: process.env.VITE_HUBSPOT_ACCESS_TOKEN });
  }

  async connect(): Promise<void> {
    // Verify connection by making a test API call
    try {
      await this.client.crm.contacts.basicApi.getPage();
    } catch (error) {
      throw new Error('Failed to connect to HubSpot');
    }
  }

  async query(query: string): Promise<any> {
    // Parse the natural language query and map to HubSpot API calls
    if (query.toLowerCase().includes('contacts')) {
      return this.client.crm.contacts.basicApi.getPage();
    }
    if (query.toLowerCase().includes('deals')) {
      return this.client.crm.deals.basicApi.getPage();
    }
    throw new Error('Unsupported query type');
  }

  async disconnect(): Promise<void> {
    // No explicit disconnect needed for REST API
  }
}

// Factory function to create appropriate connector
export function createConnector(type: string): DataSourceConnector {
  switch (type.toLowerCase()) {
    case 'hubspot':
      return new HubSpotConnector();
    case '***REMOVED***':
      return new PostgresConnector();
    // Add more data sources here as they're implemented
    // case 'bigquery':
    //   return new BigQueryConnector();
    // case 'snowflake':
    //   return new SnowflakeConnector();
    default:
      throw new Error(`Unsupported data source type: ${type}`);
  }
}

// Utility function to execute queries with proper error handling
export async function executeQuery(
  connectorType: string,
  query: string
): Promise<{ data: any; error?: string }> {
  const connector = createConnector(connectorType);
  
  try {
    await connector.connect();
    const data = await connector.query(query);
    return { data };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  } finally {
    await connector.disconnect();
  }
}

// Export connector types for type safety
export const DATA_SOURCE_TYPES = {
  HUBSPOT: 'hubspot',
  POSTGRES: '***REMOVED***',
  // Add more as they're implemented
  // BIGQUERY: 'bigquery',
  // SNOWFLAKE: 'snowflake',
} as const;

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES]; 