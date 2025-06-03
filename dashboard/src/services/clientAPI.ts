import { apiClient } from './api';

export interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  serviceType: 'residential' | 'commercial' | 'industrial';
  status: 'active' | 'inactive' | 'pending';
  customerCount: number;
  monthlyRevenue: number;
  dateJoined: string;
  lastActivity: string;
  organizationId?: string;
  settings?: ClientSettings;
  billingInfo?: BillingInfo;
  contactPerson?: ContactPerson;
}

export interface ClientSettings {
  allowDataExport: boolean;
  enableNotifications: boolean;
  dataRetentionDays: number;
  autoGenerateReports: boolean;
  reportFrequency: 'daily' | 'weekly' | 'monthly';
  customBranding: boolean;
  apiAccess: boolean;
  maxUsers: number;
}

export interface BillingInfo {
  billingEmail: string;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'invoice';
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  pricePerCustomer: number;
  minimumFee: number;
  taxRate: number;
  currency: string;
}

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
  title: string;
  department: string;
}

export interface CreateClientRequest {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  serviceType: 'residential' | 'commercial' | 'industrial';
  contactPerson?: Partial<ContactPerson>;
  settings?: Partial<ClientSettings>;
  billingInfo?: Partial<BillingInfo>;
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {
  id: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface ClientFilters {
  status?: 'all' | 'active' | 'inactive' | 'pending';
  serviceType?: 'all' | 'residential' | 'commercial' | 'industrial';
  search?: string;
  sortBy?: 'name' | 'dateJoined' | 'customerCount' | 'monthlyRevenue';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientStats {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  totalCustomers: number;
  totalRevenue: number;
  averageCustomersPerClient: number;
  averageRevenuePerClient: number;
  growthRate: number;
}

class ClientAPIService {
  /**
   * Get all clients with optional filtering and pagination
   */
  async getClients(filters: ClientFilters = {}): Promise<ClientListResponse> {
    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'all') {
          params.append(key, value.toString());
        }
      });

      const response = await apiClient.get(`/admin/clients?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw new Error('Failed to fetch clients');
    }
  }

  /**
   * Get a specific client by ID
   */
  async getClient(id: string): Promise<Client> {
    try {
      const response = await apiClient.get(`/admin/clients/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching client ${id}:`, error);
      throw new Error('Failed to fetch client details');
    }
  }

  /**
   * Create a new client
   */
  async createClient(clientData: CreateClientRequest): Promise<Client> {
    try {
      const response = await apiClient.post('/admin/clients', clientData);
      return response.data;
    } catch (error) {
      console.error('Error creating client:', error);
      throw new Error('Failed to create client');
    }
  }

  /**
   * Update an existing client
   */
  async updateClient(clientData: UpdateClientRequest): Promise<Client> {
    try {
      const { id, ...updateData } = clientData;
      const response = await apiClient.patch(`/admin/clients/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error(`Error updating client ${clientData.id}:`, error);
      throw new Error('Failed to update client');
    }
  }

  /**
   * Delete a client
   */
  async deleteClient(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/clients/${id}`);
    } catch (error) {
      console.error(`Error deleting client ${id}:`, error);
      throw new Error('Failed to delete client');
    }
  }

  /**
   * Update client status
   */
  async updateClientStatus(id: string, status: 'active' | 'inactive' | 'pending'): Promise<Client> {
    try {
      const response = await apiClient.patch(`/admin/clients/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error(`Error updating client status ${id}:`, error);
      throw new Error('Failed to update client status');
    }
  }

  /**
   * Get client statistics for dashboard
   */
  async getClientStats(): Promise<ClientStats> {
    try {
      const response = await apiClient.get('/admin/clients/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching client stats:', error);
      throw new Error('Failed to fetch client statistics');
    }
  }

  /**
   * Get client customers/users
   */
  async getClientCustomers(clientId: string, filters: any = {}): Promise<any> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await apiClient.get(`/admin/clients/${clientId}/customers?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching customers for client ${clientId}:`, error);
      throw new Error('Failed to fetch client customers');
    }
  }

  /**
   * Get client billing information
   */
  async getClientBilling(clientId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/admin/clients/${clientId}/billing`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching billing for client ${clientId}:`, error);
      throw new Error('Failed to fetch client billing information');
    }
  }

  /**
   * Update client billing information
   */
  async updateClientBilling(clientId: string, billingData: Partial<BillingInfo>): Promise<any> {
    try {
      const response = await apiClient.patch(`/admin/clients/${clientId}/billing`, billingData);
      return response.data;
    } catch (error) {
      console.error(`Error updating billing for client ${clientId}:`, error);
      throw new Error('Failed to update client billing information');
    }
  }

  /**
   * Get client usage metrics
   */
  async getClientUsage(clientId: string, timeRange: string = '30d'): Promise<any> {
    try {
      const response = await apiClient.get(`/admin/clients/${clientId}/usage?range=${timeRange}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching usage for client ${clientId}:`, error);
      throw new Error('Failed to fetch client usage metrics');
    }
  }

  /**
   * Generate client report
   */
  async generateClientReport(clientId: string, reportType: string): Promise<any> {
    try {
      const response = await apiClient.post(`/admin/clients/${clientId}/reports`, { 
        type: reportType,
        format: 'pdf'
      });
      return response.data;
    } catch (error) {
      console.error(`Error generating report for client ${clientId}:`, error);
      throw new Error('Failed to generate client report');
    }
  }

  /**
   * Bulk update clients
   */
  async bulkUpdateClients(clientIds: string[], updateData: Partial<Client>): Promise<void> {
    try {
      await apiClient.patch('/admin/clients/bulk', {
        clientIds,
        updateData
      });
    } catch (error) {
      console.error('Error performing bulk update:', error);
      throw new Error('Failed to perform bulk update');
    }
  }

  /**
   * Search clients by various criteria
   */
  async searchClients(query: string, filters: ClientFilters = {}): Promise<ClientListResponse> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== 'all') {
          params.append(key, value.toString());
        }
      });

      const response = await apiClient.get(`/admin/clients/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error searching clients:', error);
      throw new Error('Failed to search clients');
    }
  }
}

export const clientAPI = new ClientAPIService(); 