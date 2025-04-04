/**
 * Types for data sources
 * This file re-exports and combines data source types from other modules
 */

// Re-export the DataSourceType enum from the processing module
import { DataSourceType } from './document/processing';

// Re-export other relevant types
import { 
  DataSource, 
  DataSourceConfig, 
  DataSourceStatus, 
  DataSourceRecord 
} from './utils/data-source';

export {
  DataSourceType,
  DataSource,
  DataSourceConfig,
  DataSourceStatus,
  DataSourceRecord
}; 