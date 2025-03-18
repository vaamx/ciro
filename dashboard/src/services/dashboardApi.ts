import type { Widget } from '../components/Dashboard/WidgetManager';
import type { MetricCard } from '../components/Dashboard/StaticMetricsCards';
import { buildApiUrl } from '../api-config';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  team?: string;
  category?: string;
  widgets: Widget[];
  metrics: MetricCard[];
  createdBy: string;
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
    const apiUrl = buildApiUrl(`${this.baseUrl}?organization_id=${organizationId}`);
    console.log('Fetching dashboards from URL:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        headers: this.getHeaders(),
        credentials: 'include'
      });

      // Check response status
      console.log('Dashboard API response status:', response.status);
      
      // Check content type to catch HTML responses (often auth errors)
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      if (contentType && contentType.includes('text/html')) {
        console.error('Received HTML response for JSON endpoint - likely an authentication issue');
        
        // Try to get the HTML content to see what it contains
        const htmlContent = await response.text();
        console.error('HTML response received:', htmlContent.substring(0, 200) + '...');
        
        // If we're getting HTML when expecting JSON, it's likely an auth issue
        localStorage.removeItem('auth_token');
        
        // Trigger auth error event if it exists
        if (window.emitAuthError) {
          window.emitAuthError('Authentication required. Please log in.');
        }
        
        throw new Error('Authentication error: Please log in');
      }

      if (!response.ok) {
        // Try to parse error response
        try {
          const errorData = await response.json();
          console.error('Dashboard API error response:', errorData);
          throw new Error(errorData.message || errorData.error || `Server error: ${response.status} ${response.statusText}`);
        } catch (parseError) {
          // If JSON parsing fails, get the text content
          const errorText = await response.text();
          console.error('Dashboard API error text:', errorText);
          throw new Error(`Failed to fetch dashboards: ${response.status} ${response.statusText}`);
        }
      }

      // Parse the successful response
      const data = await response.json();
      console.log('Dashboard data received:', {
        count: data.length,
        sample: data.length > 0 ? { id: data[0].id, name: data[0].name } : 'no dashboards'
      });
      return data;
    } catch (error) {
      console.error('Dashboard API request error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    // Validate organization_id exists
    if (!dashboard.organization_id) {
      console.error('Cannot create dashboard: Missing organization_id');
      throw new Error('Organization ID is required to create a dashboard');
    }

    // Use the UUID string directly without converting to a number
    const { createdBy, ...rest } = dashboard;
    const payload = {
      ...rest,
      created_by: createdBy, // Use the UUID string directly
    };

    // Log the payload for debugging
    console.log('Creating dashboard with payload:', JSON.stringify(payload, null, 2));

    const apiUrl = buildApiUrl(this.baseUrl);
    console.log('Dashboard create URL:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      // Check response status
      console.log('Dashboard create API response status:', response.status);
      
      // Check content type to catch HTML responses (often auth errors)
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      if (contentType && contentType.includes('text/html')) {
        console.error('Received HTML response for JSON endpoint - likely an authentication issue');
        
        // Clone the response before reading it
        const responseClone = response.clone();
        
        // Try to get the HTML content to see what it contains
        const htmlContent = await responseClone.text();
        console.error('HTML response received:', htmlContent.substring(0, 200) + '...');
        
        // If we're getting HTML when expecting JSON, it's likely an auth issue
        localStorage.removeItem('auth_token');
        
        // Trigger auth error event if it exists
        if (window.emitAuthError) {
          window.emitAuthError('Authentication required. Please log in.');
        }
        
        throw new Error('Authentication error: Please log in');
      }

      if (!response.ok) {
        // Clone the response before trying to parse it
        const errorResponseClone = response.clone();
        
        // Try to parse error response
        try {
          const errorData = await response.json();
          console.error('Dashboard API error response:', errorData);
          
          if (response.status === 500) {
            console.error('Server error detected. This might be due to missing database tables or invalid data.');
            
            // Check for organization issues in JWT token
            try {
              const token = localStorage.getItem('auth_token');
              if (token) {
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                console.error('JWT token data:', tokenData);
                
                if (tokenData.organizationId === null) {
                  console.error('JWT token has null organizationId. This might be causing the server error.');
                  throw new Error('Your account is not associated with an organization. Please contact support.');
                }
              }
            } catch (e) {
              console.error('Error parsing JWT token:', e);
            }
          }
          
          throw new Error(errorData.message || errorData.error || `Failed to create dashboard: ${response.status}`);
        } catch (parseError) {
          // If JSON parsing fails, use the cloned response to get the text content
          try {
            const errorText = await errorResponseClone.text();
            console.error('Dashboard API error text:', errorText);
            throw new Error(`Failed to create dashboard: ${response.status} ${response.statusText}`);
          } catch (textError) {
            // If both attempts fail, throw a generic error
            console.error('Failed to read error response:', textError);
            throw new Error(`Failed to create dashboard: ${response.status} ${response.statusText}`);
          }
        }
      }

      // Must clone the response before parsing it as JSON
      const responseClone = response.clone();
      
      try {
        const data = await response.json();
        console.log('Dashboard created successfully:', data);
        
        return {
          ...data,
          createdBy: data.created_by, // Keep as string for UUID compatibility
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      } catch (jsonError) {
        // If JSON parsing fails, try to get the text content from the cloned response
        console.error('Failed to parse response as JSON:', jsonError);
        const textContent = await responseClone.text();
        console.error('Response text content:', textContent);
        throw new Error('Failed to parse server response');
      }
    } catch (error) {
      console.error('Dashboard API request error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  async updateDashboard(id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
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
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete dashboard');
    }
  }

  async updateDashboardWidgets(dashboardId: string, widgets: Widget[]): Promise<Dashboard> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${dashboardId}/widgets`);
    const response = await fetch(apiUrl, {
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
    const apiUrl = buildApiUrl(`${this.baseUrl}/${dashboardId}/metrics`);
    const response = await fetch(apiUrl, {
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