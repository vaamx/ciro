import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNotification } from './NotificationContext';
import { API_BASE_URL } from '../config';

/**
 * Workspace interface
 */
export interface Workspace {
  id: string;
  title: string;
  description?: string;
  user_id: string;
  organization_id?: number;
  dashboard_id?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Chart interface
 */
export interface WorkspaceChart {
  id: string;
  workspace_id: string;
  title?: string;
  chart_type: string;
  data_source_id?: string;
  config: any;
  position?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Complete workspace with charts
 */
export interface WorkspaceWithCharts {
  workspace: Workspace;
  charts: WorkspaceChart[];
}

/**
 * Workspaces context type
 */
interface WorkspacesContextType {
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  currentWorkspace: WorkspaceWithCharts | null;
  refreshWorkspaces: () => Promise<void>;
  getWorkspaceById: (id: string, forceRefresh?: boolean) => Promise<WorkspaceWithCharts | null>;
  createWorkspace: (workspace: Partial<Workspace>) => Promise<Workspace | null>;
  updateWorkspace: (id: string, workspace: Partial<Workspace>) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  addChart: (workspaceId: string, chart: Partial<WorkspaceChart>) => Promise<WorkspaceChart | null>;
  updateChart: (workspaceId: string, chartId: string, chart: Partial<WorkspaceChart>) => Promise<WorkspaceChart | null>;
  deleteChart: (workspaceId: string, chartId: string) => Promise<boolean>;
}

// Create the context
const WorkspacesContext = createContext<WorkspacesContextType | undefined>(undefined);

/**
 * Workspaces context provider component
 */
export const WorkspacesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithCharts | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { showNotification } = useNotification();

  /**
   * Fetch workspaces from API
   */
  const fetchWorkspaces = useCallback(async (organizationId?: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      
      // If there's no token, don't try to fetch workspaces
      if (!token) {
        console.log('No auth token available, skipping workspaces fetch');
        setWorkspaces([]);
        return [];
      }
      
      let url = `${API_BASE_URL}/api/workspaces`;
      
      if (organizationId) {
        url += `?organization_id=${organizationId}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching workspaces: ${response.status}`);
      }
      
      const data = await response.json();
      setWorkspaces(data);
      return data;
    } catch (err: any) {
      console.error('Error fetching workspaces:', err);
      setError(err.message || 'Failed to fetch workspaces');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Force refresh workspaces
   */
  const refreshWorkspaces = useCallback(async () => {
    return fetchWorkspaces();
  }, [fetchWorkspaces]);

  /**
   * Get workspace by ID with charts
   */
  const getWorkspaceById = useCallback(async (id: string, forceRefresh: boolean = true): Promise<WorkspaceWithCharts | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Getting workspace with ID: ${id}, forceRefresh: ${forceRefresh}`);
      
      // If we already have the workspace loaded and forceRefresh is false, use it
      if (!forceRefresh && currentWorkspace && currentWorkspace.workspace.id === id) {
        console.log('Using cached workspace data for ID:', id);
        return currentWorkspace;
      }
      
      // CRITICAL FIX: Check if this is a real UUID - if not, log and return null early
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isValidUuid) {
        console.error(`Invalid workspace ID format: ${id} - must be a valid UUID`);
        return null;
      }
      
      // Check localStorage for the most recent created workspace ID to handle recovery
      const mostRecentWorkspaceId = localStorage.getItem('most_recent_created_workspace_id');
      
      console.log('Fetching workspace from API with ID:', id);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.error('No authentication token available, cannot fetch workspace');
        return null;
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
        
        console.log(`Workspace API response status: ${response.status}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            console.error(`Workspace not found with ID: ${id}`);
            
            // CRITICAL FIX: If we have a recent workspace ID and it's different, suggest using it instead
            if (mostRecentWorkspaceId && mostRecentWorkspaceId !== id) {
              console.warn(`Most recent workspace ID (${mostRecentWorkspaceId}) differs from requested ID (${id})`);
              console.warn('This may indicate a stale workspace ID in the URL or localStorage');
              
              // Store this error to allow the UI to handle it
              setError(`Workspace with ID ${id} not found. You may want to try using your most recently created workspace instead.`);
            }
            
            return null;
          }
          throw new Error(`Error fetching workspace: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Workspace API response:', data.workspace?.title, 'Charts:', data.charts?.length);
        setCurrentWorkspace(data);
        return data;
      } catch (networkError: any) {
        // Specific handling for network or API errors
        console.error(`Network or API error fetching workspace ${id}:`, networkError);
        
        // CRITICAL FIX: Special recovery handling for 500 errors (which might be 404s)
        if (networkError.message && networkError.message.includes('500')) {
          console.warn('Server returned 500 error - this might be a mishandled 404 Not Found');
          
          // If we have a recent workspace ID and it's different, suggest using it
          if (mostRecentWorkspaceId && mostRecentWorkspaceId !== id) {
            console.warn(`Recovery suggestion: Try workspace ID ${mostRecentWorkspaceId} instead`);
            setError(`Server error (500) loading workspace. You may want to try your most recent workspace instead.`);
          }
        }
        
        throw new Error(`Error fetching workspace: ${networkError.message}`);
      }
    } catch (err: any) {
      console.error(`Error fetching workspace ${id}:`, err);
      setError(err.message || 'Failed to fetch workspace');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  /**
   * Create a new workspace
   */
  const createWorkspace = useCallback(async (workspace: Partial<Workspace>): Promise<Workspace | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workspace)
      });
      
      if (!response.ok) {
        throw new Error(`Error creating workspace: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update workspaces list
      setWorkspaces(prevWorkspaces => [...prevWorkspaces, data]);
      
      showNotification({
        type: 'success',
        message: `Workspace "${data.title}" created successfully`
      });
      
      return data;
    } catch (err: any) {
      console.error('Error creating workspace:', err);
      setError(err.message || 'Failed to create workspace');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to create workspace'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  /**
   * Update a workspace
   */
  const updateWorkspace = useCallback(async (id: string, workspace: Partial<Workspace>): Promise<Workspace | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workspace)
      });
      
      if (!response.ok) {
        throw new Error(`Error updating workspace: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update workspaces list
      setWorkspaces(prevWorkspaces => 
        prevWorkspaces.map(ws => ws.id === id ? data : ws)
      );
      
      // Update current workspace if it's the one being updated
      if (currentWorkspace && currentWorkspace.workspace.id === id) {
        setCurrentWorkspace({
          ...currentWorkspace,
          workspace: data
        });
      }
      
      showNotification({
        type: 'success',
        message: `Workspace "${data.title}" updated successfully`
      });
      
      return data;
    } catch (err: any) {
      console.error(`Error updating workspace ${id}:`, err);
      setError(err.message || 'Failed to update workspace');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to update workspace'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, showNotification]);

  /**
   * Delete a workspace
   */
  const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting workspace: ${response.status}`);
      }
      
      // Update workspaces list
      setWorkspaces(prevWorkspaces => 
        prevWorkspaces.filter(ws => ws.id !== id)
      );
      
      // Clear current workspace if it's the one being deleted
      if (currentWorkspace && currentWorkspace.workspace.id === id) {
        setCurrentWorkspace(null);
      }
      
      showNotification({
        type: 'success',
        message: 'Workspace deleted successfully'
      });
      
      return true;
    } catch (err: any) {
      console.error(`Error deleting workspace ${id}:`, err);
      setError(err.message || 'Failed to delete workspace');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to delete workspace'
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, showNotification]);

  /**
   * Add a chart to a workspace
   */
  const addChart = useCallback(async (workspaceId: string, chart: Partial<WorkspaceChart>): Promise<WorkspaceChart | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/charts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chart)
      });
      
      if (!response.ok) {
        throw new Error(`Error adding chart: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update current workspace if this chart belongs to it
      if (currentWorkspace && currentWorkspace.workspace.id === workspaceId) {
        setCurrentWorkspace({
          ...currentWorkspace,
          charts: [...currentWorkspace.charts, data]
        });
      }
      
      showNotification({
        type: 'success',
        message: 'Chart added successfully'
      });
      
      return data;
    } catch (err: any) {
      console.error(`Error adding chart to workspace ${workspaceId}:`, err);
      setError(err.message || 'Failed to add chart');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to add chart'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, showNotification]);

  /**
   * Update a chart
   */
  const updateChart = useCallback(async (workspaceId: string, chartId: string, chart: Partial<WorkspaceChart>): Promise<WorkspaceChart | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/charts/${chartId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chart)
      });
      
      if (!response.ok) {
        throw new Error(`Error updating chart: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update current workspace if this chart belongs to it
      if (currentWorkspace && currentWorkspace.workspace.id === workspaceId) {
        setCurrentWorkspace({
          ...currentWorkspace,
          charts: currentWorkspace.charts.map(c => c.id === chartId ? data : c)
        });
      }
      
      showNotification({
        type: 'success',
        message: 'Chart updated successfully'
      });
      
      return data;
    } catch (err: any) {
      console.error(`Error updating chart ${chartId}:`, err);
      setError(err.message || 'Failed to update chart');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to update chart'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, showNotification]);

  /**
   * Delete a chart
   */
  const deleteChart = useCallback(async (workspaceId: string, chartId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/charts/${chartId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting chart: ${response.status}`);
      }
      
      // Update current workspace if this chart belongs to it
      if (currentWorkspace && currentWorkspace.workspace.id === workspaceId) {
        setCurrentWorkspace({
          ...currentWorkspace,
          charts: currentWorkspace.charts.filter(c => c.id !== chartId)
        });
      }
      
      showNotification({
        type: 'success',
        message: 'Chart deleted successfully'
      });
      
      return true;
    } catch (err: any) {
      console.error(`Error deleting chart ${chartId}:`, err);
      setError(err.message || 'Failed to delete chart');
      
      showNotification({
        type: 'error',
        message: err.message || 'Failed to delete chart'
      });
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, showNotification]);

  // Load workspaces on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchWorkspaces();
    }
  }, [fetchWorkspaces]);

  // Create context value
  const contextValue: WorkspacesContextType = {
    workspaces,
    isLoading,
    error,
    currentWorkspace,
    refreshWorkspaces,
    getWorkspaceById,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addChart,
    updateChart,
    deleteChart
  };

  return (
    <WorkspacesContext.Provider value={contextValue}>
      {children}
    </WorkspacesContext.Provider>
  );
};

/**
 * Hook to use workspaces context
 */
export const useWorkspaces = (): WorkspacesContextType => {
  const context = useContext(WorkspacesContext);
  if (context === undefined) {
    throw new Error('useWorkspaces must be used within a WorkspacesProvider');
  }
  return context;
};

export default WorkspacesContext; 