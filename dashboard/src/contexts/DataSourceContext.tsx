import { createOrganizationScopedContext } from './OrganizationScopedContext';
import { buildApiUrl } from '../api-config';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  description?: string;
  configuration: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  organization_id: number;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
  error?: string;
}

class DataSourceApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/data-sources';
  }

  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getItems(organizationId: number): Promise<DataSource[]> {
    const apiUrl = buildApiUrl(`${this.baseUrl}?organization_id=${organizationId}`);
    const response = await fetch(apiUrl, {
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data sources');
    }

    return response.json();
  }

  async createItem(dataSource: Partial<DataSource>): Promise<DataSource> {
    const apiUrl = buildApiUrl(this.baseUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dataSource)
    });

    if (!response.ok) {
      throw new Error('Failed to create data source');
    }

    return response.json();
  }

  async updateItem(id: string, dataSource: Partial<DataSource>): Promise<DataSource> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dataSource)
    });

    if (!response.ok) {
      throw new Error('Failed to update data source');
    }

    return response.json();
  }

  async deleteItem(id: string): Promise<void> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete data source');
    }
  }

  // Additional data source specific methods
  async testConnection(id: string): Promise<{ success: boolean; error?: string }> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}/test`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return response.json();
  }

  async syncData(id: string): Promise<{ success: boolean; error?: string }> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}/sync`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return response.json();
  }
}

const dataSourceApiService = new DataSourceApiService();
const { Provider: DataSourceProvider, useContext: useDataSource } = createOrganizationScopedContext<DataSource>(
  dataSourceApiService,
  'DataSource'
);

export { DataSourceProvider, useDataSource }; 