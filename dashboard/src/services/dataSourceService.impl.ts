import axios from 'axios';
import { getAuthorizationHeader } from '../utils/authToken';
import { DataSource } from '../components/DataSources/types';
import { DataSourceServiceInterface } from './types';

class DataSourceService implements DataSourceServiceInterface {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async getDataSources(): Promise<DataSource[]> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/data-sources`, {
        headers: { Authorization: getAuthorizationHeader() }
      });
      
      console.log('Fetched data sources from API:', response.data);

      // Map response data to DataSource objects
      return response.data.map((source: any) => {
        // Parse metadata if it's a string
        if (typeof source.metadata === 'string') {
          try {
            source.metadata = JSON.parse(source.metadata);
          } catch (e) {
            console.error('Error parsing metadata:', e);
          }
        }
        
        // For file-based sources, add additional logging
        if (source.type === 'local-files' || source.metadata?.fileType) {
          console.log('Found file-based source:', source.name, 'Metadata:', source.metadata);
        }
        
        return this.mapResponseToDataSource(source);
      });
    } catch (error) {
      console.error('Error fetching data sources:', error);
      throw error;
    }
  }

  async executeQuery(
    dataSourceId: string,
    sql: string,
    parameters?: Record<string, any>,
    options?: {
      maxRows?: number;
      timeout?: number;
      includeMetadata?: boolean;
    }
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/api/query`,
        {
          dataSourceId,
          sql,
          parameters,
          options
        },
        {
          headers: {
            Authorization: getAuthorizationHeader(),
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error;
    }
  }

  private mapResponseToDataSource(source: any): DataSource {
    // Implement the actual mapping logic here
    return source as DataSource;
  }
}

export { DataSourceService }; 