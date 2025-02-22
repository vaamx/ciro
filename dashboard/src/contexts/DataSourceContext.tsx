import { createOrganizationScopedContext } from './OrganizationScopedContext';

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
    const response = await fetch(`${this.baseUrl}?organization_id=${organizationId}`, {
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data sources');
    }

    return response.json();
  }

  async createItem(dataSource: Partial<DataSource>): Promise<DataSource> {
    const response = await fetch(this.baseUrl, {
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
    const response = await fetch(`${this.baseUrl}/${id}`, {
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
    const response = await fetch(`${this.baseUrl}/${id}`, {
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
    const response = await fetch(`${this.baseUrl}/${id}/test`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return response.json();
  }

  async syncData(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${this.baseUrl}/${id}/sync`, {
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