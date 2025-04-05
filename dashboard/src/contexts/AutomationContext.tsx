import { createOrganizationScopedContext } from './OrganizationScopedContext';
import { buildApiUrl } from './AuthContext';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger: {
    type: string;
    configuration: Record<string, any>;
  };
  actions: Array<{
    type: string;
    configuration: Record<string, any>;
  }>;
  status: 'active' | 'inactive' | 'error';
  organization_id: number;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  error?: string;
}

class AutomationApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = buildApiUrl('automations');
  }

  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getItems(organizationId: number): Promise<Automation[]> {
    const response = await fetch(`${this.baseUrl}?organization_id=${organizationId}`, {
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch automations');
    }

    return response.json();
  }

  async createItem(automation: Partial<Automation>): Promise<Automation> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(automation)
    });

    if (!response.ok) {
      throw new Error('Failed to create automation');
    }

    return response.json();
  }

  async updateItem(id: string, automation: Partial<Automation>): Promise<Automation> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(automation)
    });

    if (!response.ok) {
      throw new Error('Failed to update automation');
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
      throw new Error('Failed to delete automation');
    }
  }

  // Additional automation specific methods
  async toggleStatus(id: string, active: boolean): Promise<Automation> {
    const response = await fetch(`${this.baseUrl}/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ active })
    });

    if (!response.ok) {
      throw new Error('Failed to toggle automation status');
    }

    return response.json();
  }

  async runNow(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${this.baseUrl}/${id}/run`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    return response.json();
  }
}

const automationApiService = new AutomationApiService();
const { Provider: AutomationProvider, useContext: useAutomation } = createOrganizationScopedContext<Automation>(
  automationApiService,
  'Automation'
);

export { AutomationProvider, useAutomation }; 