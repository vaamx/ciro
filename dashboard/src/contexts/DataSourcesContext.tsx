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
  
  // Add a ref to track the last fetch time
  const lastFetchTimeRef = useRef<number>(0);
  // Add a ref to store the last data hash to detect actual changes
  const lastDataHashRef = useRef<string>('');
  // Socket.io connection reference - commented out as unused
  // const socketRef = useRef<Socket | null>(null);
  
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

  // Set up WebSocket connection or polling for data source updates
  useEffect(() => {
    console.log('Setting up data source polling and WebSocket connection');
    
    if (!currentOrganization) {
      console.log('No current organization, skipping WebSocket setup');
      return;
    }
    
    // Set up polling interval for data sources (15 second interval)
    console.log('Setting up data source polling (15 second interval)');
    const pollingInterval = setInterval(() => {
      fetchDataSources().catch(console.error);
    }, 15000);
    
    // Clean up on component unmount
    return () => {
      console.log('Data source polling stopped');
      clearInterval(pollingInterval);
    };
  }, [currentOrganization]);

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

      // For file uploads, create a placeholder immediately if we have file info
      if (dataSource.type?.startsWith('local-files') && dataSource.metadata) {
        const metadata = dataSource.metadata as Record<string, any>;
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