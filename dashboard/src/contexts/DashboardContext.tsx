import React, { createContext, useContext, useState, useEffect } from 'react';
import { Widget } from '../components/Dashboard/WidgetManager';
import { dashboardApiService } from '../services/dashboardApi';
import type { MetricCard } from '../components/Dashboard/StaticMetricsCards';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

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
}

interface Dashboard {
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

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  // Reset state when organization changes
  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboards = async () => {
      try {
        // Only fetch if user is authenticated and organization is selected
        if (!user || !currentOrganization) {
          setDashboards([]);
          setCurrentDashboard(null);
          setIsLoading(false);
          return;
        }

        // Start loading
        setIsLoading(true);
        setError(null);

        // Fetch dashboards with a shorter timeout (5 seconds)
        const fetchPromise = dashboardApiService.getDashboards(currentOrganization.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        const fetchedDashboards = await Promise.race([fetchPromise, timeoutPromise]) as Dashboard[];
        
        if (!isMounted) return;

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
        if (!isMounted) return;
        
        console.error('Error fetching dashboards:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
        // Don't reset dashboards on error if we already have data
        if (dashboards.length === 0) {
          setDashboards([]);
          setCurrentDashboard(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Don't reset state immediately when switching organizations
    if (!currentOrganization) {
      setDashboards([]);
      setCurrentDashboard(null);
      setError(null);
    }

    // Fetch immediately without delay
    fetchDashboards();

    return () => {
      isMounted = false;
    };
  }, [user, currentOrganization?.id]);

  const addDashboard = async (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    try {
      setError(null);
      const newDashboard = await dashboardApiService.createDashboard({
        ...dashboard,
        organization_id: currentOrganization.id,
        createdBy: user?.id || 0,
        widgets: [],
        metrics: []
      });
      
      // Only add the dashboard if it belongs to the current organization
      if (newDashboard.organization_id === currentOrganization.id) {
        setDashboards([...dashboards, newDashboard]);
        setCurrentDashboard(newDashboard);
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
      setCurrentDashboard(dashboard);
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

  return (
    <DashboardContext.Provider value={{
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
    }}>
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