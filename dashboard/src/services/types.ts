import { DataSource } from '../components/DataSources/types';

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

export interface DataSourceServiceInterface {
  getDataSources(): Promise<DataSource[]>;
  executeQuery(
    dataSourceId: string,
    sql: string,
    parameters?: Record<string, any>,
    options?: {
      maxRows?: number;
      timeout?: number;
      includeMetadata?: boolean;
    }
  ): Promise<any>;
} 