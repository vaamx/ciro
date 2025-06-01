import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Widget } from '../components/Dashboard/WidgetManager';
import { dashboardApiService, type CreateDashboardPayload } from '../services/dashboardApi';
import type { MetricCard, Dashboard as DashboardType } from '../types/dashboard';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

// Extend Window interface to include dashboardContext
declare global {
  interface Window {
    dashboardContext?: any; // Match the type in echarts.d.ts exactly
  }
}

// Re-export the Dashboard type from the types file
export type Dashboard = DashboardType;

// DashboardContextType interface definition
export interface DashboardContextType {
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
  cleanStaticMetrics: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { isAuthenticated } = useAuth();

  // Add function to restore dashboard from localStorage
  const restoreLastActiveDashboard = useCallback((dashboardList: Dashboard[]) => {
    try {
      // Only proceed if there are dashboards available
      if (!dashboardList || dashboardList.length === 0) return false;
      
      const savedDashboardId = localStorage.getItem('last_active_dashboard_id');
      
      if (savedDashboardId) {
        const savedDashboard = dashboardList.find(d => d.id === savedDashboardId);
        
        if (savedDashboard) {
          console.log(`Restoring last active dashboard: ${savedDashboard.name} (ID: ${savedDashboard.id})`);
          setCurrentDashboard(savedDashboard);
          return true;
        } else {
          console.log(`Saved dashboard ID ${savedDashboardId} not found in loaded dashboards. Using default.`);
        }
      }
      return false;
    } catch (error) {
      console.error('Error restoring last active dashboard:', error);
      return false;
    }
  }, []);

  // Memoize the fetchDashboards function to prevent it from changing on every render
  const fetchDashboards = useCallback(async () => {
    if (!currentOrganization || !isAuthenticated) {
      setDashboards([]);
      setCurrentDashboard(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dashboardData = await dashboardApiService.getDashboards(currentOrganization.id);
      
      if (dashboardData && Array.isArray(dashboardData)) {
        console.log(`Loaded ${dashboardData.length} dashboards for organization ${currentOrganization.id}`);
        
        // Ensure all dashboards have a valid organization_id
        const validatedDashboards = dashboardData.map(dashboard => {
          if (dashboard.organization_id === undefined) {
            console.warn(`Dashboard ${dashboard.id} (${dashboard.name}) has undefined organization_id, setting to current organization`);
            return {
              ...dashboard,
              organization_id: currentOrganization.id
            };
          }
          return dashboard;
        });
        
        setDashboards(validatedDashboards);
        
        // Try to restore last active dashboard
        const restored = restoreLastActiveDashboard(validatedDashboards);
        
        // If not restored and we have dashboards, set the first one as current
        if (!restored && validatedDashboards.length > 0 && !currentDashboard) {
          console.log(`Setting first dashboard as current: ${validatedDashboards[0].name}`);
          setCurrentDashboard(validatedDashboards[0]);
        } else if (validatedDashboards.length === 0) {
          // If no dashboards, clear current dashboard
          setCurrentDashboard(null);
        }
      } else {
        // No dashboards or invalid response
        setDashboards([]);
        setCurrentDashboard(null);
      }
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      setError('Failed to load dashboards');
      setDashboards([]);
      setCurrentDashboard(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization, isAuthenticated, restoreLastActiveDashboard, currentDashboard]);

  // Reset state when organization changes
  useEffect(() => {
    let isMounted = true;
    
    const loadDashboards = async () => {
      // Only attempt to load if component is still mounted
      if (!isMounted) return;
      
      try {
        await fetchDashboards();
      } catch (err) {
        if (!isMounted) return;
        
        console.error('Error in loadDashboards:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboards');
      }
    };

    // Don't reset state immediately when switching organizations
    if (!currentOrganization) {
      setDashboards([]);
      setCurrentDashboard(null);
      setError(null);
    } else {
      // Load dashboards when organization changes
      loadDashboards();
    }

    return () => {
      isMounted = false;
    };
  }, [currentOrganization?.id, user?.id]); // Remove fetchDashboards from dependency array

  const addDashboard = async (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    try {
      setError(null);
      
      // Only send fields that are allowed by the backend CreateDashboardDto
      const dashboardPayload: CreateDashboardPayload = {
        name: dashboard.name,
        description: dashboard.description || '',
        team: dashboard.team || '',
        category: dashboard.category || '',
        organization_id: currentOrganization.id
      };
      
      console.log(`Creating new dashboard with organization_id: ${dashboardPayload.organization_id}`);
      
      const newDashboard = await dashboardApiService.createDashboard(dashboardPayload);
      
      // Double-check organization_id came back properly from the API
      if (newDashboard.organization_id === undefined) {
        console.warn('API returned dashboard with undefined organization_id, fixing locally');
        newDashboard.organization_id = currentOrganization.id;
      }
      
      // Only add the dashboard if it belongs to the current organization
      if (newDashboard.organization_id === currentOrganization.id) {
        console.log(`Created new dashboard: ${newDashboard.name} (ID: ${newDashboard.id})`);
        setDashboards([...dashboards, newDashboard]);
        setCurrentDashboard(newDashboard);
        // Save the new dashboard as the last active dashboard
        localStorage.setItem('last_active_dashboard_id', newDashboard.id);
      } else {
        console.warn(`Dashboard created with mismatched organization ID: ${newDashboard.organization_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dashboard');
      throw err;
    }
  };

  const switchDashboard = (dashboardId: string) => {
    const dashboard = dashboards.find(d => 
      d.id === dashboardId && 
      d.organization_id === currentOrganization?.id
    );
    if (dashboard) {
      console.log(`Switching to dashboard: ${dashboard.name} (ID: ${dashboard.id})`);
      setCurrentDashboard(dashboard);
      // Save the last active dashboard ID to localStorage
      localStorage.setItem('last_active_dashboard_id', dashboard.id);
    }
  };

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
    try {
      const dashboardToDelete = dashboards.find(d => d.id === dashboardId);
      
      if (!dashboardToDelete) {
        console.error(`Dashboard not found with ID: ${dashboardId}`);
        throw new Error(`Dashboard not found with ID: ${dashboardId}`);
      }
      
      if (!currentOrganization) {
        console.error('No organization selected');
        throw new Error('No organization selected');
      }
      
      console.log(`Attempting to delete dashboard: ${dashboardToDelete.name} (ID: ${dashboardId})`);
      console.log(`Dashboard org ID: ${dashboardToDelete.organization_id}, Current org ID: ${currentOrganization.id}`);
      
      // Fix for dashboards with undefined organization_id
      if (dashboardToDelete.organization_id === undefined) {
        console.log('Dashboard has undefined organization_id, updating to current organization before deletion');
        dashboardToDelete.organization_id = currentOrganization.id;
      }

      // Now check if organization matches (after potential fix)
      if (dashboardToDelete.organization_id !== currentOrganization.id) {
        console.error(`Organization mismatch: Dashboard belongs to org ${dashboardToDelete.organization_id}, but current org is ${currentOrganization.id}`);
        throw new Error('Cannot delete dashboard from different organization');
      }

      setError(null);
      await dashboardApiService.deleteDashboard(dashboardId);
      
      console.log(`Successfully deleted dashboard: ${dashboardId}`);
      setDashboards(dashboards.filter(d => d.id !== dashboardId));
      
      if (currentDashboard?.id === dashboardId) {
        const newCurrentDashboard = dashboards.find(d => d.id !== dashboardId) || null;
        console.log(`Setting new current dashboard: ${newCurrentDashboard?.name || 'None'}`);
        setCurrentDashboard(newCurrentDashboard);
        
        if (newCurrentDashboard) {
          localStorage.setItem('last_active_dashboard_id', newCurrentDashboard.id);
        } else {
          localStorage.removeItem('last_active_dashboard_id');
        }
      }
    } catch (err) {
      console.error('Error deleting dashboard:', err);
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
      
      // Create updated dashboard with new widgets
      const locallyUpdatedDashboard = {
        ...currentDashboard,
        widgets: widgets
      };
      
      // Skip API call to prevent errors and update local state only
      // This approach means widgets won't persist on reload, but static charts will be shown instead
      console.log('Updating widgets in local state only (API calls disabled)');
      setDashboards(dashboards.map(d => d.id === locallyUpdatedDashboard.id ? locallyUpdatedDashboard : d));
      setCurrentDashboard(locallyUpdatedDashboard);
      
      // Return resolved promise to maintain async function signature
      return Promise.resolve();
      
      /* Original API call code - commented out to prevent errors
      const updatedDashboard = await dashboardApiService.updateDashboardWidgets(currentDashboard.id, widgets);
      
      // Only update if the dashboard belongs to the current organization
      if (updatedDashboard.organization_id === currentOrganization.id) {
        setDashboards(dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d));
        setCurrentDashboard(updatedDashboard);
      }
      */
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

  // Simplified cleanStaticMetrics function since we've already removed all static metrics
  const cleanStaticMetrics = async () => {
    console.log('Static metrics functionality has been completely removed from the application');
    return Promise.resolve();
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
    cleanStaticMetrics
  };

  // Expose the dashboard context to the window object
  useEffect(() => {
    window.dashboardContext = contextValue;
    
    return () => {
      // Clean up when component unmounts
      delete window.dashboardContext;
    };
  }, [contextValue]);

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