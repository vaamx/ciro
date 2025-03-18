import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Widget } from '../components/Dashboard/WidgetManager';
import { dashboardApiService } from '../services/dashboardApi';
import type { MetricCard } from '../components/Dashboard/StaticMetricsCards';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

// Extend Window interface to include dashboardContext
declare global {
  interface Window {
    dashboardContext?: DashboardContextType;
  }
}

interface DashboardContextType {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  addDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  switchDashboard: (dashboardId: string) => void;
  updateDashboard: (dashboard: Dashboard) => Promise<void>;
  deleteDashboard: (dashboardId: string) => Promise<void>;
  updateWidgets: (widgets: Widget[]) => Promise<void>;
  updateMetrics: (metrics: MetricCard[]) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refreshDashboards: () => Promise<void>;
}

interface Dashboard {
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

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  // Function to fetch dashboards that can be called from outside
  const fetchDashboards = async () => {
    try {
      // Only fetch if user is authenticated and organization is selected
      if (!user || !currentOrganization) {
        console.log('Not fetching dashboards - missing user or organization:', {
          hasUser: !!user,
          hasOrganization: !!currentOrganization
        });
        setDashboards([]);
        setCurrentDashboard(null);
        setIsLoading(false);
        return;
      }

      // Start loading
      setIsLoading(true);
      setError(null);

      // Check if auth token exists
      const token = localStorage.getItem('auth_token');
      console.log('Fetching dashboards with auth token?', !!token, 'for organization:', currentOrganization.id);

      try {
        // Fetch dashboards with a shorter timeout (5 seconds)
        const fetchPromise = dashboardApiService.getDashboards(currentOrganization.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        const fetchedDashboards = await Promise.race([fetchPromise, timeoutPromise]) as Dashboard[];
        
        console.log('Successfully fetched dashboards:', fetchedDashboards?.length || 0);

        // Filter dashboards to only include those belonging to the current organization
        const orgDashboards = fetchedDashboards.filter(
          dashboard => dashboard.organization_id === currentOrganization.id
        );
        
        setDashboards(orgDashboards);
        
        // Only set current dashboard if none is selected or current one doesn't exist
        if (!currentDashboard || !orgDashboards.find(d => d.id === currentDashboard.id)) {
          setCurrentDashboard(orgDashboards.length > 0 ? orgDashboards[0] : null);
        }
      } catch (err) {
        console.error('Error fetching dashboards:', err);
        
        // Log detailed error information
        if (err instanceof Error) {
          console.error('Error details:', {
            message: err.message,
            name: err.name,
            stack: err.stack,
            cause: (err as any).cause
          });
        }

        // Try to determine if it's an auth issue
        if (err instanceof Error && 
            (err.message.includes('authentication') || 
             err.message.includes('401') || 
             err.message.includes('unauthorized'))) {
          console.error('Authentication error detected - clearing token');
          localStorage.removeItem('auth_token');
          
          // Trigger auth error event if it exists
          if (window.emitAuthError) {
            window.emitAuthError('Your session has expired. Please log in again.');
          }
        }
        
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
        
        // Don't reset dashboards on error if we already have data
        if (dashboards.length === 0) {
          setDashboards([]);
          setCurrentDashboard(null);
        }
      } finally {
        setIsLoading(false);
      }
    } catch (outerError) {
      console.error('Unexpected error in fetchDashboards:', outerError);
      setError(outerError instanceof Error ? outerError.message : 'Unexpected error occurred');
      setIsLoading(false);
    }
  };

  // Reset state when organization changes
  useEffect(() => {
    // Don't reset state immediately when switching organizations
    if (!currentOrganization) {
      setDashboards([]);
      setCurrentDashboard(null);
      setError(null);
    }

    // Fetch immediately without delay
    fetchDashboards();

    // Empty cleanup function
    return () => {
      // Component cleanup
    };
  }, [user, currentOrganization?.id]);

  const addDashboard = async (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentOrganization) {
      console.error('Cannot create dashboard: No organization selected');
      setError('Please select an organization before creating a dashboard');
      throw new Error('No organization selected');
    }
    
    if (!currentOrganization.id) {
      console.error('Cannot create dashboard: Organization ID is missing');
      setError('Invalid organization: Missing organization ID');
      throw new Error('Organization ID is missing');
    }

    // Check for userId in JWT token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('Cannot create dashboard: No authentication token');
      setError('Authentication required to create dashboards');
      throw new Error('Authentication required');
    }

    try {
      // Decode token to check organizationId
      const tokenParts = token.split('.');
      if (tokenParts.length < 2) {
        console.error('Invalid token format');
        throw new Error('Invalid authentication token');
      }
      
      const tokenData = JSON.parse(atob(tokenParts[1]));
      console.log('JWT token data during dashboard creation:', tokenData);
      
      if (tokenData.organizationId === null) {
        console.warn('JWT token has null organizationId - this may cause issues on the server');
        
        // Instead of proceeding with null organizationId which will cause server errors,
        // display a helpful message to the user
        const errorMessage = 'Your account is not properly linked to an organization. Please contact support or try logging out and back in.';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      setError(null);
      console.log('Creating dashboard for organization:', currentOrganization.id);
      
      // Check if user and user.id exist before proceeding
      if (!user || !user.id) {
        console.error('User not found or missing ID');
        setError('User information is missing. Please try logging out and back in.');
        throw new Error('Missing user ID');
      }
      
      // FIXED: Use the UUID string directly instead of converting to numeric ID
      // The database expects a UUID for created_by field
      const userId = user.id.toString();
      
      console.log('Using user ID:', userId);
      
      // Ensure organization_id is explicitly set from currentOrganization
      const dashboardWithOrgId = {
        ...dashboard,
        organization_id: currentOrganization.id,
        createdBy: userId,
        widgets: [],
        metrics: []
      };
      
      console.log('Sending dashboard creation request with data:', {
        ...dashboardWithOrgId,
        organizationId: currentOrganization.id,
        userId
      });
      
      const newDashboard = await dashboardApiService.createDashboard(dashboardWithOrgId);
      
      console.log('Dashboard created successfully:', newDashboard.id);
      
      // Only add the dashboard if it belongs to the current organization
      if (newDashboard.organization_id === currentOrganization.id) {
        setDashboards([...dashboards, newDashboard]);
        setCurrentDashboard(newDashboard);
      } else {
        console.warn('Created dashboard has different organization_id:', newDashboard.organization_id);
      }
    } catch (err) {
      console.error('Error creating dashboard:', err);
      
      // Log detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Handle specific errors with user-friendly messages
        if (err.message.includes('invalid input syntax for type uuid')) {
          setError('Unable to create dashboard due to invalid user ID. Please contact support.');
        } else if (err.message.includes('null organizationId')) {
          setError('Your account is not linked to an organization. Please contact support.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create dashboard');
      }
      
      throw err;
    }
  };

  const switchDashboard = useCallback((dashboardId: string) => {
    // Find dashboard in dashboards array
    const dashboard = dashboards.find(d => d.id === dashboardId);
    
    if (dashboard) {
      // Verify the dashboard belongs to the current organization
      if (dashboard.organization_id === currentOrganization?.id) {
        console.log(`Switching to dashboard "${dashboard.name}" (${dashboard.id})`);
        setCurrentDashboard(dashboard);
        // Save to localStorage for persistence
        localStorage.setItem('current_dashboard_id', dashboard.id);
      } else {
        console.error(`Cannot switch to dashboard ${dashboardId} from organization ${dashboard.organization_id} while in organization ${currentOrganization?.id}`);
      }
    } else {
      console.error(`Dashboard with ID ${dashboardId} not found`);
    }
  }, [dashboards, currentOrganization]);

  const updateDashboard = async (updatedDashboard: Dashboard) => {
    if (!currentOrganization || updatedDashboard.organization_id !== currentOrganization.id) {
      throw new Error('Cannot update dashboard from different organization');
    }

    try {
      setError(null);
      const dashboard = await dashboardApiService.updateDashboard(updatedDashboard.id, updatedDashboard);
      
      // Only update if the dashboard belongs to the current organization
      if (dashboard.organization_id === currentOrganization.id) {
        setDashboards(dashboards.map(d => d.id === dashboard.id ? dashboard : d));
        if (currentDashboard?.id === dashboard.id) {
          setCurrentDashboard(dashboard);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dashboard');
      throw err;
    }
  };

  const deleteDashboard = async (dashboardId: string) => {
    const dashboardToDelete = dashboards.find(d => d.id === dashboardId);
    if (!dashboardToDelete || dashboardToDelete.organization_id !== currentOrganization?.id) {
      throw new Error('Cannot delete dashboard from different organization');
    }

    try {
      setError(null);
      await dashboardApiService.deleteDashboard(dashboardId);
      setDashboards(dashboards.filter(d => d.id !== dashboardId));
      if (currentDashboard?.id === dashboardId) {
        setCurrentDashboard(dashboards.find(d => d.id !== dashboardId) || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard');
      throw err;
    }
  };

  const updateWidgets = async (widgets: Widget[]) => {
    if (!currentDashboard || currentDashboard.organization_id !== currentOrganization?.id) {
      throw new Error('Cannot update widgets for dashboard from different organization');
    }

    try {
      setError(null);
      const updatedDashboard = await dashboardApiService.updateDashboardWidgets(currentDashboard.id, widgets);
      
      // Only update if the dashboard belongs to the current organization
      if (updatedDashboard.organization_id === currentOrganization.id) {
        setDashboards(dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d));
        setCurrentDashboard(updatedDashboard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update widgets');
      throw err;
    }
  };

  const updateMetrics = async (metrics: MetricCard[]) => {
    if (!currentDashboard || currentDashboard.organization_id !== currentOrganization?.id) {
      throw new Error('Cannot update metrics for dashboard from different organization');
    }

    try {
      setError(null);
      const updatedDashboard = await dashboardApiService.updateDashboardMetrics(currentDashboard.id, metrics);
      
      // Only update if the dashboard belongs to the current organization
      if (updatedDashboard.organization_id === currentOrganization.id) {
        setDashboards(dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d));
        setCurrentDashboard(updatedDashboard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update metrics');
      throw err;
    }
  };

  // Create the context value object
  const contextValue: DashboardContextType = {
    dashboards,
    currentDashboard,
    addDashboard,
    switchDashboard,
    updateDashboard,
    deleteDashboard,
    updateWidgets,
    updateMetrics,
    isLoading,
    error,
    refreshDashboards: fetchDashboards
  };

  // Make dashboardContext available globally for debugging
  if (typeof window !== 'undefined') {
    window.dashboardContext = contextValue;
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}; 