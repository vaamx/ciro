import { useCallback, useContext, useEffect, useRef, useState, createContext } from 'react';
// Remove the Socket import - it's no longer needed
import { useOrganization } from './OrganizationContext';
import { useNotification } from './NotificationContext';
import { 
  DataSource
} from '../types/shared-types';
import { refreshKnowledgeBase } from '../refresh-knowledge-base';
// Import our API configuration
import { API_URL } from '../api-config';

// Use the imported API URL instead of the environment variable
const API_BASE_URL = API_URL;

// Increase polling interval to reduce refresh frequency, but use dynamic polling for processing items
const POLLING_INTERVAL = 30000; // 30 seconds for normal polling (reduced from 15)
const PROCESSING_POLLING_INTERVAL = 10000; // 10 seconds when items are processing (reduced from 5)
const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches (increased from 2)

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
      generateVisualization: (dataSourceId: string) => Promise<any>;
}

// Create the context
const DataSourcesContext = createContext<DataSourcesContextType | undefined>(undefined);

export const DataSourcesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSnowflakeForm, setShowSnowflakeForm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Add a ref to track the last fetch time and prevent overlapping fetches
  const lastFetchTimeRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Add a ref to store the last data hash to detect actual changes
  const lastDataHashRef = useRef<string>('');
  
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
    return JSON.stringify(data.map((ds: DataSource) => ({
      id: ds.id,
      status: ds.status, // Include status in hash
      lastSync: ds.lastSync,
      metrics: ds.metrics // Include metrics for progress updates
    })));
  }, []);

  // Fetch data sources from API
  const fetchDataSources = useCallback(async (forceRefresh = false, isInitialLoad = false): Promise<void> => {
    if (!currentOrganization) {
      setIsLoading(false);
      return;
    }

    // Prevent overlapping fetches
    if (isFetchingRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    // Skip fetching if polling is paused (unless force refresh)
    if (isPaused && !forceRefresh) {
      console.log('Polling paused, skipping fetch...');
      return;
    }

    // Skip if we fetched too recently (debounce) unless forced
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      console.log(`Fetch debounced: ${now - lastFetchTimeRef.current}ms since last fetch`);
      return;
    }
    
    console.log('Starting data source fetch...');
    lastFetchTimeRef.current = now;
    isFetchingRef.current = true;

    try {
      setError(null);
      if (forceRefresh || isInitialLoad) {
      setIsLoading(true);
      }

      const response = await fetch(`${API_BASE_URL}/api/data-sources?organization_id=${currentOrganization.id}`, {
          headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data sources: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data) {
        // Always update state on initial load, or if data actually changed
        const currentHash = generateDataHash(data);
        const hashChanged = currentHash !== lastDataHashRef.current;
        
        if (hashChanged || forceRefresh || isInitialLoad) {
          console.log('Data sources updated:', data);
          setDataSources(data);
          lastDataHashRef.current = currentHash;
          
          // CRITICAL FIX: Only dispatch knowledgeBaseUpdate for MANUAL refreshes
          // NOT for initial loads or regular polling
          if (forceRefresh && !isInitialLoad) {
            console.log('Preparing knowledgeBaseUpdate event to refresh Knowledge Base');
            window.dispatchEvent(new CustomEvent('knowledgeBaseUpdate', { 
              detail: { 
                type: 'sources_updated', 
                sources: data,
                timestamp: Date.now()
              } 
            }));
          }
        } else {
          console.log('No data source changes detected, skipping update');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching data sources:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
      console.log('Data source fetch completed');
    }
  }, [currentOrganization, generateDataHash, isPaused]);

  // Set up polling for data source updates with dynamic intervals
  useEffect(() => {
    if (!currentOrganization || isPaused) {
      setIsLoading(false);
      return;
    }
    
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Initial load - do NOT trigger knowledgeBaseUpdate
    fetchDataSources(false, true); // isInitialLoad = true
    
    // Determine polling interval based on processing items
    const hasProcessingItems = dataSources.some((ds: DataSource) => 
      ['processing', 'syncing', 'uploading'].includes(ds.status)
    );
    
    const currentInterval = hasProcessingItems ? PROCESSING_POLLING_INTERVAL : POLLING_INTERVAL;
    
    console.log(`Setting up data source polling (${currentInterval/1000} second interval, processing items: ${hasProcessingItems})`);
    
    // Set up polling with dynamic interval - regular polling, NOT manual refresh
    pollingIntervalRef.current = setInterval(() => {
      if (!isPaused) {
        fetchDataSources(false, false); // forceRefresh = false, isInitialLoad = false
      }
    }, currentInterval);
    
    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
      console.log('Data source polling stopped');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentOrganization, isPaused, fetchDataSources, dataSources]);

  // Add a method to create a placeholder data source while file is processing
  const addPlaceholderDataSource = (fileInfo: { id: string; name: string; type: string; size: number }): DataSource => {
    const placeholderSource: DataSource = {
      id: fileInfo.id,
      name: fileInfo.name,
      // Cast as any to bypass type restriction
      type: `local-files-${fileInfo.type.toLowerCase()}` as any,
      status: 'processing',
      description: `Uploading and processing ${fileInfo.name}`,
      metrics: {
        records: 0,
        syncRate: 0,
        avgSyncTime: '0s',
        // Add progress info as part of metadata instead of metrics
        lastError: undefined
      },
      metadata: {
        id: fileInfo.id,
        fileType: fileInfo.type,
        filename: fileInfo.name,
        size: fileInfo.size,
        originalFilename: fileInfo.name,
        processing_stage: 'uploading',
        progress: 0,
        processedChunks: 0,
        totalChunks: 100,
        // Include progress info in metadata
        progress_info: {
          totalChunks: 100,
          processedChunks: 0,
          currentPhase: 'uploading',
          startTime: new Date().toISOString(),
          warnings: []
        }
      } as Record<string, any> // Cast to Record to allow any properties
    };

    // Add to state immediately
    setDataSources(prev => [placeholderSource, ...prev]);
    
    return placeholderSource;
  };

  // Update the addDataSource method to handle files with immediate feedback
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

      // For file uploads that already have a dataSourceId (created during upload), 
      // just refresh the data sources list instead of creating a duplicate
      if (dataSource.type?.startsWith('local-files') && dataSource.metadata) {
        const metadata = dataSource.metadata as Record<string, any>;
        
        // If the file already has a dataSourceId, it was created during upload
        if (metadata.dataSourceId) {
          console.log('File upload completed with existing dataSourceId:', metadata.dataSourceId, 'triggering refresh');
          
          // Force refresh the data sources to show the newly uploaded file
          await fetchDataSources(true, false);
          
          // Try to find the data source that was just created
          const existingDataSource = dataSources.find(ds => 
            normalizeId(ds.id) === normalizeId(metadata.dataSourceId)
          );
          
          if (existingDataSource) {
            showNotification({ 
              type: 'success', 
              message: `Successfully added ${metadata.filename || 'file'}` 
            });
            
            // Refresh the knowledge base
            setTimeout(() => {
              refreshKnowledgeBase(false);
            }, 0);
            
            return existingDataSource;
          } else {
            // If we can't find it immediately, create a placeholder and let polling pick it up
            console.log('Data source not found immediately after refresh, creating placeholder');
            const fileInfo = {
              id: metadata.dataSourceId,
              name: metadata.filename as string,
              type: dataSource.type.replace('local-files-', '') || 'file',
              size: Number(metadata.size) || 0
            };
            
            const placeholder = addPlaceholderDataSource(fileInfo);
            
            showNotification({ 
              type: 'success', 
              message: `Processing ${metadata.filename || 'file'}...` 
            });
            
            return placeholder;
          }
        }
        
        // If no dataSourceId, create a placeholder and make API call
        if (metadata.filename) {
          console.log('Creating placeholder for file upload:', metadata.filename);
          const fileInfo = {
            id: metadata.id || `temp-${Date.now()}`,
            name: metadata.filename as string,
            type: dataSource.type.replace('local-files-', '') || 'file',
            size: Number(metadata.size) || 0
          };
          
          // Create and display placeholder immediately
          const placeholder = addPlaceholderDataSource(fileInfo);
          
          // Continue with the actual API call in the background
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
            
            // Update placeholder to error state
            setDataSources(prev => prev.map(ds => 
              ds.id === placeholder.id 
                ? { ...ds, status: 'error', metrics: { ...ds.metrics, lastError: errorData.message || 'Failed to create data source' }}
                : ds
            ));
            
            throw new Error(errorData.message || 'Failed to create data source');
          }

          const newDataSource = await response.json();
          
          // Update the placeholder with the actual data from API
          setDataSources(prev => prev.map(ds => 
            ds.id === placeholder.id ? { ...newDataSource, id: ds.id } : ds
          ));
          
          showNotification({ 
            type: 'success', 
            message: `Successfully added ${metadata.filename || 'file'}` 
          });
          
          // Refresh the knowledge base
          setTimeout(() => {
            refreshKnowledgeBase(false);
          }, 0);
          
          return newDataSource;
        }
      }

      // For non-file sources, proceed as before
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
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/data-sources/${id}?organization_id=${currentOrganization.id}`, {
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
    if (!currentOrganization) {
      throw new Error('No organization selected');
    }

    try {
      console.log(`Deleting data source ${id} for organization ${currentOrganization.id}`);
      
      const response = await fetch(`${API_BASE_URL}/api/data-sources/${id}?organization_id=${currentOrganization.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete data source');
      }

      console.log(`Successfully deleted data source ${id} from backend`);

      // Helper function to normalize IDs for comparison
      const normalizedId = normalizeId(id);
      
      // Immediately update local state
      setDataSources(prev => {
        const newDataSources = prev.filter(ds => normalizeId(ds.id) !== normalizedId);
        console.log(`Updated local state: removed data source ${id}, ${newDataSources.length} remaining`);
        return newDataSources;
      });
      
      showNotification({ 
        type: 'success', 
        message: 'Data source deleted successfully' 
      });
      
      // Force an immediate refresh to sync with backend (but don't trigger knowledgeBaseUpdate)
      console.log('Forcing immediate data sources refresh after deletion');
      try {
        await fetchDataSources(false, false); // Just sync state, don't trigger events
        console.log('Successfully refreshed data sources after deletion');
      } catch (refreshError) {
        console.error('Error refreshing data sources after deletion:', refreshError);
      }
      
      // Trigger knowledge base update specifically for deletions
      console.log('Triggering knowledge base refresh after data source deletion');
      window.dispatchEvent(new CustomEvent('knowledgeBaseUpdate', { 
        detail: { 
          type: 'source_deleted', 
          sourceId: id,
          timestamp: Date.now()
        } 
      }));
      
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
    console.log('Manual refresh triggered by user');
    return fetchDataSources(true, false); // forceRefresh = true, isInitialLoad = false
  }, [fetchDataSources]);

  // Generate visualization from data source
  const generateVisualization = async (dataSourceId: string): Promise<any> => {
    try {
      console.log(`Generating visualization for data source: ${dataSourceId}`);
      
      // Find the data source
      const dataSource = getDataSourceById(dataSourceId);
      if (!dataSource) {
        throw new Error(`Data source with ID ${dataSourceId} not found`);
      }
      
      // Make API request to the backend
      const token = localStorage.getItem('auth_token');
      console.log(`Making API request to: ${API_BASE_URL}/api/visualizations/generate/${dataSourceId}`);
      
      const response = await fetch(`${API_BASE_URL}/api/visualizations/generate/${dataSourceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`Response status: ${response.status}`);

      // For non-JSON responses, provide clearer error
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`Received non-JSON response: ${contentType}`);
        throw new Error(`Server returned non-JSON response (${response.status}): ${await response.text().catch(() => 'Unable to read response')}`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(err => ({ error: `Failed to parse error response: ${err.message}` }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log(`Visualization data received with title: ${data.title}`);
      return data;
    } catch (err: any) {
      console.error('Error generating visualization:', err);
      
      // For development purposes only: return mock data when API fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using fallback visualization data for development');
        return createFallbackVisualization(dataSourceId);
      }
      
      showNotification({ 
        type: 'error', 
        message: err.message || 'Failed to generate visualization' 
      });
      throw err;
    }
  };

  // Helper to create fallback visualization when API fails
  const createFallbackVisualization = (dataSourceId: string) => {
    const dataSource = getDataSourceById(dataSourceId);
    const title = dataSource ? `${dataSource.name} Analysis` : `Data Analysis for Source ${dataSourceId}`;
    
    return {
      dataSourceId,
      title,
      description: 'Analysis of key metrics over time',
      chartType: 'enhanced-bar-chart',
      config: {
        xAxis: { title: 'Month' },
        yAxis: { title: 'Value (in millions)' },
        colors: ['#4C78DB', '#F58518', '#54A24B']
      },
      data: [
        { month: "Jan", value: 65, prevValue: 20 },
        { month: "Feb", value: 93, prevValue: 20 },
        { month: "Mar", value: 76, prevValue: 22 },
        { month: "Apr", value: 44, prevValue: 30 },
        { month: "May", value: 4, prevValue: 28 },
        { month: "Jun", value: 16, prevValue: 25 },
        { month: "Jul", value: 93, prevValue: 30 },
        { month: "Aug", value: 98, prevValue: 28 },
        { month: "Sep", value: 50, prevValue: 29 }
      ],
      transformations: []
    };
  };

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
    setPausePolling,
    generateVisualization
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