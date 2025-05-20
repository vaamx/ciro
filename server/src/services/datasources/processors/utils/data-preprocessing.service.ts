import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../../../common/utils/logger-factory';

// Define DataSourceType enum locally or import if available globally
// Copied from DataAnalysisOrchestratorService for now
export enum DataSourceType {
  CSV = 'csv',
  JSON = 'json',
  TEXT = 'text',
  TABLE = 'table', // Represents array of objects
  UNKNOWN = 'unknown'
}

@Injectable()
export class DataPreprocessingService {
  private readonly logger = createServiceLogger('DataPreprocessingService');

  constructor() {
    this.logger.info('DataPreprocessingService initialized');
  }

  /**
   * Detect the type of data
   * @param data The data to analyze
   * @returns The detected data source type
   */
  public detectDataType(data: any): DataSourceType {
    if (typeof data === 'string') {
      // Check for CSV
      if (data.includes(',') && data.split('\n').length > 1) {
        return DataSourceType.CSV;
      }
      
      // Check for JSON
      if ((data.startsWith('{') && data.endsWith('}')) || 
          (data.startsWith('[') && data.endsWith(']'))) {
        try {
          JSON.parse(data);
          return DataSourceType.JSON;
        } catch {
          // Not valid JSON
        }
      }
      
      return DataSourceType.TEXT;
    }
    
    if (Array.isArray(data)) {
      // Check if it's tabular data
      if (data.length > 0 && typeof data[0] === 'object') {
        return DataSourceType.TABLE;
      }
      return DataSourceType.JSON;
    }
    
    if (typeof data === 'object' && data !== null) {
      return DataSourceType.JSON;
    }
    
    return DataSourceType.UNKNOWN;
  }

  /**
   * Preprocess data for analysis
   * @param data The raw data
   * @param dataSourceType The type of data source
   * @returns Processed data as a string
   */
  public preprocessData(data: any, dataSourceType: DataSourceType): string {
    try {
      // Convert data to appropriate format based on type
      if (typeof data === 'string') {
        return data; // Already a string
      }
      
      if (Array.isArray(data)) {
        if (dataSourceType === DataSourceType.TABLE || 
            dataSourceType === DataSourceType.CSV /* || 
            dataSourceType === DataSourceType.EXCEL */) { // EXCEL type doesn't exist here
          // Format as a table
          if (data.length > 0 && typeof data[0] === 'object') {
            const headers = Object.keys(data[0]).join(',');
            const rows = data.map(row => 
              Object.values(row).map(val => 
                typeof val === 'string' ? `"${val}"` : val
              ).join(',')
            ).join('\n');
            return `${headers}\n${rows}`;
          }
        }
        
        // Default array formatting
        return JSON.stringify(data, null, 2);
      }
      
      if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data, null, 2);
      }
      
      return String(data);
    } catch (error) {
      this.logger.error('Error preprocessing data:', error);
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
  }
} 