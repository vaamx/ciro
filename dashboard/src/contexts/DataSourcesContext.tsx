import { useCallback, useContext, useEffect, useRef, useState, createContext } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOrganization } from './OrganizationContext';
import { useNotification } from './NotificationContext';
import { 
  DataSource
} from '../types/shared-types';
import { refreshKnowledgeBase } from '../refresh-knowledge-base';
// Import our API configuration
import { API_URL, SOCKET_URL } from '../api-config';

// Use the imported API URL instead of the environment variable
const API_BASE_URL = API_URL;

// Increase polling interval to reduce refresh frequency
const POLLING_INTERVAL = 15000; // 15 seconds instead of 5

// Helper function to normalize IDs for comparison (handles both UUID and numeric IDs)
const normalizeId = (id: string | number | undefined): string => 
  id !== undefined ? String(id).trim() : '';

// Define the context type
interface DataSourcesContextType {
  dataSources: DataSource[];
  isLoading: boolean;
  error: string | null;
  refreshDataSources: () => Promise<void>;
  addDataSource: (dataSource: Partial<DataSource>) => Promise<DataSource>;
  updateDataSource: (id: string, updates: Partial<DataSource>) => Promise<DataSource>;
  deleteDataSource: (id: string) => Promise<void>;
  getDataSourceById: (id: string) => DataSource | undefined;
  showSnowflakeForm: boolean;
  setShowSnowflakeForm: (show: boolean) => void;
  isPaused: boolean;
  setPausePolling: (paused: boolean) => void;
}

// Create the context
const DataSourcesContext = createContext<DataSourcesContextType | undefined>(undefined);

export const DataSourcesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSnowflakeForm, setShowSnowflakeForm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Add a ref to track the last fetch time to prevent too frequent refreshes
  const lastFetchTimeRef = useRef<number>(0);
  // Add a ref to store the last data hash to detect actual changes
  const lastDataHashRef = useRef<string>('');
  // Socket.io connection reference
  const socketRef = useRef<Socket | null>(null);
  
  const { currentOrganization } = useOrganization();
  const { showNotification } = useNotification();

  // Function to pause/resume polling
  const setPausePolling = useCallback((paused: boolean) => {
    setIsPaused(paused);
    // Reduce logging
    if (paused) {
      console.log('Data source polling paused');
    }
  }, []);

  // Helper function to generate a simple hash of the data sources
  const generateDataHash = useCallback((data: DataSource[]): string => {
    return JSON.stringify(data.map(ds => ({
      id: ds.id,
      lastSync: ds.lastSync // Use lastSync which is guaranteed to exist
    })));
  }, []);

  // Fetch data sources
  const fetchDataSources = useCallback(async (force = false) => {
    if (!currentOrganization) {
      setIsLoading(false);
      return;
    }

    // Skip if we fetched too recently (debounce) unless forced
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 2000) { // 2 second debounce
      return;
    }
    
    lastFetchTimeRef.current = now;

    try {
      setIsLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/data-sources?organization_id=${currentOrganization.id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data sources: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if data has actually changed
      const newDataHash = generateDataHash(data);
      if (newDataHash !== lastDataHashRef.current) {
        lastDataHashRef.current = newDataHash;
        setDataSources(data);
        
        // Only refresh knowledge base if data actually changed
        setTimeout(() => {
          refreshKnowledgeBase(false);
        }, 0);
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching data sources:', err);
      setError(err.message || 'Failed to load data sources');
      showNotification({ 
        type: 'error', 
        message: 'Failed to load data sources' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization, showNotification, generateDataHash]);

  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    // Only set up socket if we have an organization
    if (!currentOrganization) return;

    // Create socket connection
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Store socket reference
    socketRef.current = socket;

    // Set up event listeners
    socket.on('connect', () => {
      console.log('WebSocket connected for data source updates');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected from data source updates');
    });

    // Listen for data source updates
    socket.on('dataSourceUpdate', (data) => {
      console.log('Received data source update via WebSocket:', data);
      
      if (data && data.id && data.status) {
        // Update the data source in our state
        setDataSources(prevSources => {
          // Helper function to normalize IDs for comparison (handles both UUID and numeric IDs)
          const normalizedUpdateId = normalizeId(data.id);
          
          // Find the data source to update - check both direct match and normalized match
          const existingSourceIndex = prevSources.findIndex(source => 
            normalizeId(source.id) === normalizedUpdateId
          );
          
          if (existingSourceIndex >= 0) {
            // Update existing data source
            const updatedSources = [...prevSources];
            
            // Map 'completed' status to 'ready' if needed for UI compatibility
            let uiStatus = data.status;
            if (data.status === 'completed') {
              console.log(`Mapping 'completed' status to 'ready' for UI compatibility`);
              uiStatus = 'ready';
            }
            
            updatedSources[existingSourceIndex] = {
              ...updatedSources[existingSourceIndex],
              status: uiStatus,
              lastSync: data.timestamp || new Date().toISOString(),
              // Update any other properties that might have changed
              ...(data.name && { name: data.name }),
              ...(data.metadata && { metadata: {
                ...updatedSources[existingSourceIndex].metadata,
                ...data.metadata,
              }}),
            };
            
            console.log(`Updated data source ${updatedSources[existingSourceIndex].id} (${normalizedUpdateId}) with status: ${uiStatus} (original: ${data.status})`);
            
            // If data has changed, refresh the knowledge base
            const newDataHash = generateDataHash(updatedSources);
            if (newDataHash !== lastDataHashRef.current) {
              lastDataHashRef.current = newDataHash;
              // Refresh the knowledge base asynchronously to prevent React state updates during rendering
              setTimeout(() => {
                refreshKnowledgeBase(false);
              }, 0);
            }
            
            return updatedSources;
          } else {
            console.log(`Data source with ID ${normalizedUpdateId} not found in current state, fetching all data sources`);
            // If the data source doesn't exist in our state, fetch all data sources
            // This ensures we have the complete and up-to-date list
            setTimeout(() => fetchDataSources(true), 100);
            return prevSources;
          }
        });
        
        // If the status is 'completed', show a notification
        if (data.status === 'completed') {
          showNotification({
            type: 'success',
            message: `Data source ${data.name || data.id} processing completed`
          });
        }
      }
    });

    // Listen for knowledge base updates
    socket.on('knowledgeBaseUpdated', (data) => {
      console.log('Received knowledge base update via WebSocket:', data);
      
      // Refresh data sources if we get a knowledge base update
      if (data && data.timestamp) {
        fetchDataSources(true);
      }
    });

    // Clean up on unmount
    return () => {
      console.log('Cleaning up WebSocket connection');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentOrganization, fetchDataSources, generateDataHash, showNotification]);

  // Initial load and polling setup
  useEffect(() => {
    fetchDataSources(true); // Force initial load
    
    // Set up polling with increased interval
    console.log(`Setting up data source polling (${POLLING_INTERVAL/1000} second interval)`);
    const pollingInterval = setInterval(() => {
      // Skip polling if paused
      if (isPaused) {
        // Reduce logging - don't log every skipped poll
        return;
      }
      
      // Skip polling if there are no data sources - no need to keep checking
      if (dataSources.length === 0) {
        return;
      }
      
      // Reduce logging - don't log every poll attempt
      fetchDataSources().catch(err => {
        console.error('Error during data source polling:', err);
      });
    }, POLLING_INTERVAL);
    
    // Cleanup function
    return () => {
      clearInterval(pollingInterval);
      console.log('Data source polling stopped');
    };
  }, [fetchDataSources, isPaused, dataSources.length]);

  // Add a new data source
  const addDataSource = async (dataSource: Partial<DataSource>): Promise<DataSource> => {
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    try {
      // Handle Snowflake data source type - show the form
      if (dataSource.type === 'snowflake') {
        console.log('Snowflake data source requested, showing form');
        setShowSnowflakeForm(true);
        // The actual addition will happen directly through the form submission
        return {} as DataSource; // Placeholder return
      }

      const response = await fetch(`${API_BASE_URL}/api/data-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...dataSource,
          organization_id: currentOrganization.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create data source');
      }

      const newDataSource = await response.json();
      setDataSources(prev => [newDataSource, ...prev]);
      showNotification({ 
        type: 'success', 
        message: `Successfully added ${dataSource.name}` 
      });
      
      // Refresh the knowledge base when a new data source is added
      setTimeout(() => {
        refreshKnowledgeBase(false);
      }, 0);
      
      return newDataSource;
    } catch (err: any) {
      console.error('Error adding data source:', err);
      showNotification({ 
        type: 'error', 
        message: err.message || 'Failed to add data source' 
      });
      throw err;
    }
  };

  // Update an existing data source
  const updateDataSource = async (id: string, updates: Partial<DataSource>): Promise<DataSource> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data-sources/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update data source');
      }

      const updatedDataSource = await response.json();
      
      // Helper function to normalize IDs for comparison
      const normalizedId = normalizeId(id);
      
      setDataSources(prev => 
        prev.map(ds => normalizeId(ds.id) === normalizedId ? updatedDataSource : ds)
      );
      
      showNotification({ 
        type: 'success', 
        message: `Successfully updated ${updatedDataSource.name}` 
      });
      
      // Refresh the knowledge base when a data source is updated
      setTimeout(() => {
        refreshKnowledgeBase(false);
      }, 0);
      
      return updatedDataSource;
    } catch (err: any) {
      console.error('Error updating data source:', err);
      showNotification({ 
        type: 'error', 
        message: err.message || 'Failed to update data source' 
      });
      throw err;
    }
  };

  // Delete a data source
  const deleteDataSource = async (id: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data-sources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete data source');
      }

      // Helper function to normalize IDs for comparison
      const normalizedId = normalizeId(id);
      
      setDataSources(prev => prev.filter(ds => normalizeId(ds.id) !== normalizedId));
      
      showNotification({ 
        type: 'success', 
        message: 'Data source deleted successfully' 
      });
      
      // Refresh the knowledge base when a data source is deleted
      setTimeout(() => {
        refreshKnowledgeBase(false);
      }, 0);
    } catch (err: any) {
      console.error('Error deleting data source:', err);
      showNotification({ 
        type: 'error', 
        message: err.message || 'Failed to delete data source' 
      });
      throw err;
    }
  };

  // Get a data source by ID
  const getDataSourceById = (id: string): DataSource | undefined => {
    // Helper function to normalize IDs for comparison (handles both UUID and numeric IDs)
    const normalizedSearchId = normalizeId(id);
    
    return dataSources.find(ds => normalizeId(ds.id) === normalizedSearchId);
  };

  // Add a function to force refresh (for when we know data has changed)
  const forceRefresh = useCallback(() => {
    return fetchDataSources(true);
  }, [fetchDataSources]);

  // Public context value
  const contextValue: DataSourcesContextType = {
    dataSources,
    isLoading,
    error,
    refreshDataSources: forceRefresh, // Use the force refresh function
    addDataSource,
    updateDataSource,
    deleteDataSource,
    getDataSourceById,
    showSnowflakeForm,
    setShowSnowflakeForm,
    isPaused,
    setPausePolling
  };

  return (
    <DataSourcesContext.Provider value={contextValue}>
      {children}
    </DataSourcesContext.Provider>
  );
};

export const useDataSources = (): DataSourcesContextType => {
  const context = useContext(DataSourcesContext);
  if (context === undefined) {
    throw new Error('useDataSources must be used within a DataSourcesProvider');
  }
  return context;
};

export default DataSourcesContext; 