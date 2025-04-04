import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DataSourceServiceInterface } from './types';
import { DataSource as AppDataSource } from '../components/DataSources/types';
import { DataSourceService } from './dataSourceService.impl';

// Get API base URL from the environment or use default
const API_BASE_URL = typeof window !== 'undefined' && (window as any).ENV?.API_BASE_URL 
  ? (window as any).ENV.API_BASE_URL 
  : 'http://localhost:3001';

// Create a data source service instance
const dataSourceServiceInstance: DataSourceServiceInterface = new DataSourceService(API_BASE_URL);

// Data source interface
export interface DataSource {
  id: string;
  name: string;
  type: 'database' | 'api' | 'csv' | 'json' | 'bigquery' | 'snowflake' | 'redshift';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

// Query result interface
export interface QueryResult {
  columns: {
    name: string;
    type: string;
  }[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTime: number;
  truncated: boolean;
  totalRowCount?: number;
  warning?: string;
  metadata?: any;
}

// Error classes
export class DataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataSourceError';
  }
}

export class ConnectionError extends DataSourceError {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class QueryError extends DataSourceError {
  constructor(message: string, public query?: string, public details?: any) {
    super(message);
    this.name = 'QueryError';
  }
}

/**
 * Get data sources from the DataSourcesContext or API - no mock data
 */
export const getDataSources = async (): Promise<DataSource[]> => {
  // First, try to use window.__DATA_SOURCES__ if available (global variable set by DataSourcesContext)
  // This will contain current data sources from the DataSourcesContext when available
  if (typeof window !== 'undefined' && (window as any).__DATA_SOURCES__) {
    const contextSources = (window as any).__DATA_SOURCES__;
    console.log('Using data sources from context:', contextSources.length);
    
    // Map to our DataSource format
    return contextSources.map((source: any) => ({
      id: source.id || uuidv4(),
      name: source.name,
      type: mapDataSourceType(source.type),
      status: mapDataSourceStatus(source.status),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsed: source.lastSync ? new Date(source.lastSync) : undefined
    }));
  }
  
  try {
    // If context sources not available, try the API
    console.log('Fetching data sources from API');
    const sources = await dataSourceServiceInstance.getDataSources();
    return sources.map(mapAppDataSourceToDataSource);
  } catch (error) {
    console.error('Error fetching data sources:', error);
    
    // No fallback to mock data - instead throw the error
    throw new ConnectionError('Failed to fetch data sources. Please check your connection and try again.');
  }
};

/**
 * Get a specific data source by ID
 */
export const getDataSource = async (id: string): Promise<DataSource> => {
  // Try to get from context first
  if (typeof window !== 'undefined' && (window as any).__DATA_SOURCES__) {
    const contextSources = (window as any).__DATA_SOURCES__;
    const contextSource = contextSources.find((s: any) => s.id === id);
    
    if (contextSource) {
      console.log(`Found data source ${id} in context`);
      return {
        id: contextSource.id,
        name: contextSource.name,
        type: mapDataSourceType(contextSource.type),
        status: mapDataSourceStatus(contextSource.status),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: contextSource.lastSync ? new Date(contextSource.lastSync) : undefined
      };
    }
  }
  
  try {
    // If not in context, try the API
    const sources = await dataSourceServiceInstance.getDataSources();
    const source = sources.find((s: AppDataSource) => s.id === id);
    if (!source) {
      throw new DataSourceError(`Data source with ID ${id} not found`);
    }
    return mapAppDataSourceToDataSource(source);
  } catch (error) {
    console.error(`Error fetching data source ${id}:`, error);
    
    // No fallback to mock data - instead throw the error
    throw new DataSourceError(`Could not retrieve data source ${id}. Please check your connection and try again.`);
  }
};

/**
 * Execute a SQL query against a data source
 */
export const executeQuery = async (
  dataSourceId: string, 
  sql: string, 
  parameters?: Record<string, any>,
  options?: {
    maxRows?: number;
    timeout?: number;
    includeMetadata?: boolean;
  }
): Promise<QueryResult> => {
  // Try to use the AppCore query executor if available (global function set by Studio)
  if (typeof window !== 'undefined' && (window as any).__EXECUTE_QUERY__) {
    try {
      console.log(`Executing query via AppCore for ${dataSourceId}`);
      const result = await (window as any).__EXECUTE_QUERY__(dataSourceId, sql, parameters, options);
      console.log('Query result from AppCore:', result);
      return result;
    } catch (appCoreError) {
      console.error('Error executing query via AppCore:', appCoreError);
      // Fall through to try the data source service
    }
  }
  
  try {
    // Use the dataSourceService instance to execute the query
    console.log(`Executing query via DataSourceService for ${dataSourceId}`);
    const result = await dataSourceServiceInstance.executeQuery(
      dataSourceId,
      sql,
      parameters,
      options
    );
    
    return result;
  } catch (error) {
    console.error('Error executing query:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      throw new QueryError(
        error.response.data?.message || 'Query execution failed',
        sql,
        error.response.data
      );
    }
    
    // No fallback to mock data - instead throw the error
    throw new QueryError(
      'Failed to execute query. Please check your connection and try again.',
      sql
    );
  }
};

/**
 * Map AppDataSource to DataSource
 */
function mapAppDataSourceToDataSource(source: AppDataSource): DataSource {
  return {
    id: source.id || uuidv4(),
    name: source.name,
    type: mapDataSourceType(source.type),
    status: mapDataSourceStatus(source.status),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsed: source.lastSync ? new Date(source.lastSync) : undefined
  };
}

/**
 * Map AppDataSource type to DataSource type
 */
function mapDataSourceType(type: string): DataSource['type'] {
  // Map from app's data source types to our type
  const typeMap: Record<string, DataSource['type']> = {
    'database': 'database',
    'warehouse': 'database',
    'snowflake': 'snowflake',
    'csv': 'csv',
    'json': 'json',
    'local-files': 'csv',
    'crm': 'api',
    'crm-hubspot': 'api',
    'analytics': 'api',
    'storage': 'api'
  };
  
  return typeMap[type] || 'database';
}

/**
 * Map AppDataSource status to DataSource status
 */
function mapDataSourceStatus(status: string): DataSource['status'] {
  // Map from app's status to our status
  const statusMap: Record<string, DataSource['status']> = {
    'connected': 'connected',
    'disconnected': 'disconnected',
    'error': 'error',
    'processing': 'pending',
    'syncing': 'pending',
    'ready': 'connected',
    'completed': 'connected'
  };
  
  return statusMap[status] || 'disconnected';
} 