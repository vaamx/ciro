import { BaseDataSource } from '../core/data-source-types';
import { LocalFileDataSource, isLocalFileDataSource } from './local-files';
import { SnowflakeDataSource, isSnowflakeDataSource } from './snowflake';

// Re-export all relevant types
export * from '../core/data-source-types';
export * from './local-files';
export * from './snowflake';

// Unified DataSource type that includes all possible data sources
export type DataSource = 
  | LocalFileDataSource 
  | SnowflakeDataSource
  // Future data source types would be added here
  | (BaseDataSource & { metadata?: Record<string, any> }); // Fallback for custom types

/**
 * Type adapter functions to help migrate between different type systems
 */

// Import legacy types
import { 
  DataSource as LegacyDataSource,
  DataSourceMetrics as LegacyMetrics
} from '../../components/DataSources/types';

/**
 * Convert a legacy data source to the new unified type
 */
export function convertFromLegacyDataSource(source: LegacyDataSource): DataSource {
  // Convert metrics
  const metrics = {
    records: source.metrics.records || 0,
    syncRate: source.metrics.syncRate || 0,
    avgSyncTime: source.metrics.avgSyncTime || '0s',
    lastError: source.metrics.lastError,
    // Add any new fields with defaults
    queryCount: 0,
    averageQueryTime: '0s',
    totalQueries: 0
  };

  // Handle local file data source
  if (source.type === 'local-files' && source.metadata) {
    return {
      ...source,
      metadata: {
        ...source.metadata,
        records: source.metrics.records || 0,
        syncRate: source.metrics.syncRate || 0,
        avgSyncTime: source.metrics.avgSyncTime || '0s'
      },
      metrics,
      // Add new fields with defaults
      embeddingsEnabled: false,
      embeddingsModel: 'text-embedding-ada-002'
    } as LocalFileDataSource;
  }

  // Handle Snowflake data source
  if (source.type === 'snowflake') {
    return {
      ...source,
      metadata: source.metadata ? {
        credentials: {
          account: (source.metadata as any).account || '',
          username: (source.metadata as any).username || ''
        },
        records: source.metrics.records || 0,
        syncRate: source.metrics.syncRate || 0,
        avgSyncTime: source.metrics.avgSyncTime || '0s',
        embeddingsEnabled: false
      } : {
        credentials: {
          account: '',
          username: ''
        },
        records: source.metrics.records || 0,
        syncRate: source.metrics.syncRate || 0,
        avgSyncTime: source.metrics.avgSyncTime || '0s',
        embeddingsEnabled: false
      },
      metrics,
      // Add new fields with defaults
      embeddingsEnabled: false,
      nlQueryEnabled: false
    } as unknown as SnowflakeDataSource;
  }

  // Generic conversion for other types
  return {
    ...source,
    metrics,
    // Add new fields with defaults
    embeddingsEnabled: false
  } as DataSource;
}

/**
 * Convert a unified data source to legacy format
 */
export function convertToLegacyDataSource(source: DataSource): LegacyDataSource {
  // Extract legacy metrics
  const metrics: LegacyMetrics = {
    records: source.metrics.records,
    syncRate: source.metrics.syncRate,
    avgSyncTime: source.metrics.avgSyncTime,
    lastError: typeof source.metrics.lastError === 'object' 
      ? source.metrics.lastError.message 
      : source.metrics.lastError
  };

  // Handle different types if needed
  if (isLocalFileDataSource(source)) {
    return {
      ...source,
      metrics
    } as LegacyDataSource;
  }

  if (isSnowflakeDataSource(source)) {
    // Need to cast through unknown to avoid type incompatibility with metadata
    return {
      ...source,
      metrics
    } as unknown as LegacyDataSource;
  }

  // Generic conversion
  return {
    ...source,
    metrics
  } as LegacyDataSource;
}

/**
 * Type guard to check if a data source supports embeddings
 */
export function supportsEmbeddings(source: DataSource): boolean {
  if (!source.embeddingsEnabled) return false;
  
  // Check specific data source types
  if (isLocalFileDataSource(source)) {
    // Check if file type supports embeddings
    const fileType = source.fileType || (source.metadata?.fileType);
    if (!fileType) return false;
    
    // All text-based file types support embeddings
    return ['csv', 'json', 'pdf', 'docx'].includes(fileType);
  }
  
  if (isSnowflakeDataSource(source)) {
    // Snowflake supports embeddings if enabled and there are selected tables
    return Boolean(source.metadata.embeddingsEnabled && 
      source.metadata.selectedTables?.length);
  }
  
  // Default for unknown types
  return false;
}

/**
 * Type guard to check if a data source supports natural language queries
 */
export function supportsNaturalLanguageQueries(source: DataSource): boolean {
  // All sources with embeddings support natural language queries
  if (!supportsEmbeddings(source)) return false;
  
  // Additional check for Snowflake
  if (isSnowflakeDataSource(source)) {
    return Boolean(source.nlQueryEnabled);
  }
  
  // Default behavior for other sources
  return true;
} 