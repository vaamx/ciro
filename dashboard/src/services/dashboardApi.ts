import type { Widget } from '../components/Dashboard/WidgetManager';
import type { MetricCard } from '../components/Dashboard/StaticMetricsCards';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  team?: string;
  category?: string;
  widgets: Widget[];
  metrics: MetricCard[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  organization_id: number;
}

class DashboardApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/dashboards';
  }

  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': window.location.origin
    };
  }

  async getDashboards(organizationId: number): Promise<Dashboard[]> {
    const response = await fetch(`${this.baseUrl}?organization_id=${organizationId}`, {
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboards');
    }

    return response.json();
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const { createdBy, ...rest } = dashboard;
    const payload = {
      ...rest,
      created_by: Number(createdBy), // Convert to number since users table uses integer IDs
    };

    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create dashboard');
    }

    const data = await response.json();
    return {
      ...data,
      createdBy: Number(data.created_by), // Convert to number when receiving from API
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dashboard)
    });

    if (!response.ok) {
      throw new Error('Failed to update dashboard');
    }

    return response.json();
  }

  async deleteDashboard(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete dashboard');
    }
  }

  async updateDashboardWidgets(dashboardId: string, widgets: Widget[]): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/${dashboardId}/widgets`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ widgets })
    });

    if (!response.ok) {
      throw new Error('Failed to update dashboard widgets');
    }

    return response.json();
  }

  async updateDashboardMetrics(dashboardId: string, metrics: MetricCard[]): Promise<Dashboard> {
    const response = await fetch(`${this.baseUrl}/${dashboardId}/metrics`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ metrics })
    });

    if (!response.ok) {
      throw new Error('Failed to update dashboard metrics');
    }

    return response.json();
  }
}

export const dashboardApiService = new DashboardApiService(); 