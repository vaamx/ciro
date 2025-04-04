import { BaseDataSource } from '../core/data-source-types';

/**
 * Types for Snowflake data sources, designed to work with embeddings and NL queries
 */

// Snowflake connection credentials
export interface SnowflakeCredentials {
  account: string;        // account identifier (e.g., xy12345.us-east-1)
  username: string;       // login name for the user
  password?: string;      // password for the user (not stored client-side)
  database?: string;      // default database to use
  schema?: string;        // default schema to use
  warehouse?: string;     // default warehouse to use
  role?: string;          // default role to use
  // Connection options
  connectionTimeout?: number;
  requestTimeout?: number;
  keepAlive?: boolean;
}

// Database schema structure
export interface DatabaseSchema {
  name: string;
  tables: DatabaseTable[];
}

// Table structure
export interface DatabaseTable {
  name: string;
  schema: string;
  database: string;
  columns: DatabaseColumn[];
  rowCount?: number;
  description?: string;
  lastUpdated?: string;
  hasEmbeddings?: boolean;
  sampleData?: any[][];
}

// Column structure
export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
  description?: string;
  sampleValues?: any[];
  statistics?: {
    min?: any;
    max?: any;
    avg?: any;
    distinctCount?: number;
    nullCount?: number;
  };
}

// Query history item
export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  executionTime: number;
  rowCount: number;
  status: 'success' | 'error';
  errorMessage?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  user?: string;
}

// Snowflake query result
export interface SnowflakeQueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
  status: 'success' | 'error';
  metadata?: any;
  message?: string;
}

// Metadata for Snowflake
export interface SnowflakeMetadata {
  credentials: Omit<SnowflakeCredentials, 'password'>;
  availableDatabases?: string[];
  selectedDatabase?: string;
  availableSchemas?: string[];
  selectedSchema?: string;
  availableTables?: { database: string; schema: string; name: string }[];
  selectedTables?: string[];
  recentQueries?: QueryHistoryItem[];
  
  // Embedding-related metadata
  embeddingsEnabled: boolean;
  embeddingsModel?: string;
  embeddedTables?: {
    database: string;
    schema: string;
    table: string;
    columnCount: number;
    embeddedColumnCount: number;
    rowCount: number;
    embeddingCount: number;
    lastEmbeddingUpdate: string;
  }[];
  
  // Stats required by the DataSource interface
  records: number;
  syncRate: number;
  avgSyncTime: string;
}

// Snowflake data source
export interface SnowflakeDataSource extends BaseDataSource {
  type: 'snowflake';
  metadata: SnowflakeMetadata;
  
  // Extensions for natural language querying
  nlQueryEnabled?: boolean;
  nlQueryModel?: string;
  defaultPromptTemplate?: string;
  
  // Stream support for Kafka integration
  streamingEnabled?: boolean;
  streamConfig?: {
    topicName: string;
    updateInterval: number;
    batchSize: number;
  };
}

// Type guard to check if a data source is a Snowflake data source
export function isSnowflakeDataSource(source: BaseDataSource): source is SnowflakeDataSource {
  return source.type === 'snowflake';
}

// Helper function to get a list of all tables from a Snowflake data source
export function getAllTables(source: SnowflakeDataSource): DatabaseTable[] {
  if (!source.metadata.embeddedTables) return [];
  
  // This would be replaced with actual implementation that retrieves tables
  return source.metadata.embeddedTables.map(table => ({
    name: table.table,
    schema: table.schema,
    database: table.database,
    columns: [],
    rowCount: table.rowCount,
    hasEmbeddings: table.embeddingCount > 0
  }));
} 