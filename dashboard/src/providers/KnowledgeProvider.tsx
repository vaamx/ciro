import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DataSource as KnowledgeDataSource, KnowledgeItem, SearchFilters, UserKnowledgePreferences } from '../types/knowledge';
import { DataSource as AppDataSource } from '../types/data-source';
import { useOrganization } from '../contexts/OrganizationContext';
import { getAuthToken } from '../utils/authToken';

const DEFAULT_USER_PREFERENCES: UserKnowledgePreferences = {
  pinnedSources: [],
  pinnedItems: [],
  defaultView: 'list',
  favoriteTopics: [],
};

// Use consistent API URL across the application
const API_BASE_URL = 'http://localhost:3001';

// Mock data for fallback when server is unavailable
const MOCK_DATA_SOURCES: AppDataSource[] = [
  {
    id: 'mock-1',
    name: 'Mock Data Source',
    type: 'local-files',
    status: 'ready',
    lastSync: new Date().toISOString(),
    metrics: {
      records: 0,
      syncRate: 0,
      avgSyncTime: '0s'
    }
  }
];

interface KnowledgeContextType {
  sources: KnowledgeDataSource[];
  activeSource: KnowledgeDataSource | null;
  pinnedItems: KnowledgeItem[];
  recentItems: KnowledgeItem[];
  userPreferences: UserKnowledgePreferences;
  isLoading: boolean;
  error: string | null;
  setActiveSource: (source: KnowledgeDataSource | null) => void;
  searchItems: (filters: SearchFilters) => Promise<KnowledgeItem[]>;
  pinItem: (item: KnowledgeItem) => void;
  unpinItem: (itemId: string) => void;
  addRecentItem: (item: KnowledgeItem) => void;
  updateUserPreferences: (preferences: Partial<UserKnowledgePreferences>) => void;
  removeSource: (sourceId: string) => void;
  addSource: (source: KnowledgeDataSource) => void;
  refreshSources: () => Promise<void>;
}

const KnowledgeContext = createContext<KnowledgeContextType | null>(null);

export const useKnowledge = () => {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
};

interface KnowledgeProviderProps {
  children: React.ReactNode;
}

export const KnowledgeProvider: React.FC<KnowledgeProviderProps> = ({
  children,
}) => {
  const { currentOrganization } = useOrganization();
  const [sources, setSources] = useState<KnowledgeDataSource[]>([]);
  const [activeSource, setActiveSource] = useState<KnowledgeDataSource | null>(null);
  const [pinnedItems, setPinnedItems] = useState<KnowledgeItem[]>([]);
  const [recentItems, setRecentItems] = useState<KnowledgeItem[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserKnowledgePreferences>(DEFAULT_USER_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get source icon
  const getSourceIcon = useCallback((type: string): string => {
    switch (type) {
      case 'database':
        return '🗄️';
      case 'crm':
        return '👥';
      case 'storage':
        return '📁';
      case 'analytics':
        return '📊';
      case 'sap':
        return '💼';
      case 'local-files':
        return '📄';
      default:
        return '🔍';
    }
  }, []);

  // Add a direct method to remove a source
  const removeSource = useCallback((sourceId: string) => {
    setSources(prevSources => {
      const updatedSources = prevSources.filter(source => source.id !== sourceId);
      return [...updatedSources];
    });
    setActiveSource(prev => prev?.id === sourceId ? null : prev);
  }, []);

  // Add a method to add a new source
  const addSource = useCallback((newSource: KnowledgeDataSource) => {
    setSources(prevSources => {
      if (prevSources.some(source => source.id === newSource.id)) {
        return prevSources;
      }
      return [...prevSources, newSource];
    });
  }, []);

  // Add a method to refresh sources
  const refreshSources = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Use a timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Get the auth token for the request
      const authToken = getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/api/data-sources?organization_id=${currentOrganization.id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      let dataSources: AppDataSource[] = [];
      
      if (!response.ok) {
        console.warn(`Server returned ${response.status} when fetching knowledge sources`);
        // Use mock data for 500 errors instead of throwing
        if (response.status === 500) {
          console.info('Using mock data sources due to server error');
          dataSources = MOCK_DATA_SOURCES;
        } else {
          throw new Error(`Failed to fetch data sources: ${response.status}`);
        }
      } else {
        dataSources = await response.json();
      }
      
      // Store data sources in localStorage for cross-component access (especially for TextSearch)
      try {
        if (window.localStorage) {
          window.localStorage.setItem('dataSources', JSON.stringify(dataSources));
          console.log('Data sources stored in localStorage for TextSearch access');
        }
      } catch (storageErr) {
        console.warn('Error storing data sources in localStorage:', storageErr);
      }
      
      // Convert data sources to knowledge sources
      const knowledgeSources = dataSources
        // Include connected, processing, ready, and completed sources
        .filter((ds: AppDataSource) => ds.status === 'connected' || ds.status === 'processing' || ds.status === 'ready' || ds.status === 'completed')
        .map((ds: AppDataSource): KnowledgeDataSource => ({
          id: ds.id.toString(),
          name: ds.name,
          type: ds.type as KnowledgeDataSource['type'],
          icon: getSourceIcon(ds.type),
          isActive: true,
          lastSynced: ds.lastSync ? new Date(ds.lastSync) : new Date(),
          originalSource: ds
        }));
      
      setSources(knowledgeSources);
      console.log('Knowledge sources refreshed:', knowledgeSources);
    } catch (err) {
      console.error('Error fetching data sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data sources');
      
      // Set empty sources array on error to prevent UI issues
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization, getSourceIcon]);

  // Fetch data sources when organization changes
  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  // Listen for knowledge base updates
  useEffect(() => {
    const handleKnowledgeBaseUpdate = (event: CustomEvent) => {
      console.log('Knowledge base update event received:', event.detail);
      const { deletedSourceId, addedSource, action, source, timestamp } = event.detail;
      
      if (deletedSourceId) {
        removeSource(deletedSourceId);
      }
      
      if (addedSource) {
        addSource(addedSource);
      }

      // Handle the knowledgeBaseUpdated event format
      if (action === 'add' && source) {
        console.log('Adding source from knowledgeBaseUpdated event:', source);
        // If we only have the ID, we need to fetch the specific source
        if (source.id && (!source.name || source.status === 'processing')) {
          console.log('Only ID provided or processing source, fetching source details:', source.id);
          
          // Fetch the specific source by ID
          if (currentOrganization?.id) {
            // Get the auth token for the request
            const authToken = getAuthToken();
            
            fetch(`${API_BASE_URL}/api/data-sources/${source.id}`, {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? `Bearer ${authToken}` : ''
              }
            })
            .then(response => {
              if (!response.ok) {
                throw new Error(`Failed to fetch source with ID ${source.id}`);
              }
              return response.json();
            })
            .then(dataSource => {
              console.log('Fetched source details:', dataSource);
              
              // Create a knowledge source from the data source
              const fetchedSource: KnowledgeDataSource = {
                id: dataSource.id.toString(),
                name: dataSource.name,
                type: dataSource.type as KnowledgeDataSource['type'],
                icon: getSourceIcon(dataSource.type),
                isActive: true,
                lastSynced: dataSource.lastSync ? new Date(dataSource.lastSync) : new Date(),
                originalSource: dataSource
              };
              
              // Check if the source already exists
              const existingSource = sources.find(s => s.id === fetchedSource.id);
              if (existingSource) {
                console.log('Source already exists, updating it:', fetchedSource);
                // Update the existing source with all fields, prioritizing the new information
                const updatedSource: KnowledgeDataSource = {
                  ...existingSource,
                  name: fetchedSource.name || existingSource.name,
                  type: fetchedSource.type || existingSource.type,
                  icon: (fetchedSource.originalSource?.metadata?.iconType) || existingSource.icon,
                  isActive: fetchedSource.isActive,
                  lastSynced: fetchedSource.lastSynced,
                  // Preserve metadata in originalSource
                  originalSource: {
                    ...existingSource.originalSource,
                    ...fetchedSource.originalSource,
                    metadata: {
                      ...(existingSource.originalSource?.metadata || {}),
                      ...(fetchedSource.originalSource?.metadata || {})
                    }
                  }
                };
                setSources(prevSources => 
                  prevSources.map(s => s.id === fetchedSource.id ? updatedSource : s)
                );
              } else {
                console.log('Adding new source:', fetchedSource);
                addSource(fetchedSource);
              }
            })
            .catch(error => {
              console.error('Error fetching source details:', error);
              // Fallback to refreshing all sources
              refreshSources();
            });
          } else {
            // If no organization ID, refresh all sources
            refreshSources();
          }
        } else {
          // Check if the source already exists
          const existingSource = sources.find(s => s.id === source.id);
          if (existingSource) {
            console.log('Source already exists, updating it:', source);
            // Update the existing source
            const updatedSource: KnowledgeDataSource = {
              ...existingSource,
              name: source.name || existingSource.name,
              type: (source.type as KnowledgeDataSource['type']) || existingSource.type,
              icon: (source.metadata?.iconType) || existingSource.icon,
              isActive: source.isActive ?? existingSource.isActive,
              lastSynced: source.lastSynced ? new Date(source.lastSynced) : existingSource.lastSynced,
              // Store all additional properties in originalSource
              originalSource: {
                ...existingSource.originalSource,
                ...source,
                status: source.status,
                metadata: {
                  ...(existingSource.originalSource?.metadata || {}),
                  ...(source.metadata || {})
                }
              }
            };
            setSources(prevSources => 
              prevSources.map(s => s.id === source.id ? updatedSource : s)
            );
          } else {
            console.log('Adding new source:', source);
            // Create a proper knowledge source object
            const newSource: KnowledgeDataSource = {
              id: source.id.toString(),
              name: source.name,
              type: source.type as KnowledgeDataSource['type'],
              icon: source.metadata?.iconType || getSourceIcon(source.type) || 'database',
              isActive: source.isActive ?? true,
              lastSynced: source.lastSynced ? new Date(source.lastSynced) : new Date(),
              // Store all additional properties in originalSource
              originalSource: {
                ...source,
                description: source.description,
                status: source.status
              }
            };
            addSource(newSource);
          }
        }
      } else if (action === 'delete' && source?.id) {
        removeSource(source.id);
      } else if (action === 'update' && source?.id) {
        // Update the existing source
        setSources(prevSources => 
          prevSources.map(s => s.id === source.id ? source : s)
        );
      }

      // If we received a timestamp, it's a general refresh request
      if (timestamp) {
        console.log('Refreshing sources due to timestamp update:', timestamp);
        refreshSources();
      }
    };

    // Listen for both event types
    window.addEventListener('knowledgeBaseUpdate', handleKnowledgeBaseUpdate as EventListener);
    window.addEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdate as EventListener);
    
    return () => {
      window.removeEventListener('knowledgeBaseUpdate', handleKnowledgeBaseUpdate as EventListener);
      window.removeEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdate as EventListener);
    };
  }, [removeSource, addSource, refreshSources, sources, currentOrganization, getSourceIcon]);

  const searchItems = useCallback(async (searchFilters: SearchFilters): Promise<KnowledgeItem[]> => {
    setIsLoading(true);
    setError(null);
    try {
      if (!currentOrganization?.id) {
        return [];
      }

      const response = await fetch(`/api/knowledge/search?${new URLSearchParams({
        query: searchFilters.query,
        organization_id: currentOrganization.id.toString(),
        ...(searchFilters.sources && { sources: searchFilters.sources.join(',') }),
        ...(searchFilters.types && { types: searchFilters.types.join(',') }),
        ...(searchFilters.tags && { tags: searchFilters.tags.join(',') }),
        ...(searchFilters.author && { author: searchFilters.author }),
        ...(searchFilters.dateRange && {
          start_date: searchFilters.dateRange.start.toISOString(),
          end_date: searchFilters.dateRange.end.toISOString()
        })
      })}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search knowledge items');
      }

      const results = await response.json();
      return results.items || [];
    } catch (err) {
      console.error('Error searching knowledge items:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization]);

  const pinItem = useCallback((item: KnowledgeItem) => {
    setPinnedItems(prev => {
      if (prev.some(i => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });

    // Update user preferences
    setUserPreferences(prev => ({
      ...prev,
      pinnedItems: [...prev.pinnedItems, item.id]
    }));
  }, []);

  const unpinItem = useCallback((itemId: string) => {
    setPinnedItems(prev => prev.filter(item => item.id !== itemId));

    // Update user preferences
    setUserPreferences(prev => ({
      ...prev,
      pinnedItems: prev.pinnedItems.filter(id => id !== itemId)
    }));
  }, []);

  const addRecentItem = useCallback((item: KnowledgeItem) => {
    setRecentItems(prev => {
      // Remove if already exists
      const filtered = prev.filter(i => i.id !== item.id);
      // Add to beginning
      return [item, ...filtered].slice(0, 10); // Keep only 10 most recent
    });
  }, []);

  const updateUserPreferences = useCallback((preferences: Partial<UserKnowledgePreferences>) => {
    setUserPreferences(prev => ({
      ...prev,
      ...preferences
    }));
  }, []);

  return (
    <KnowledgeContext.Provider
      value={{
        sources,
        activeSource,
        pinnedItems,
        recentItems,
        userPreferences,
        isLoading,
        error,
        setActiveSource,
        searchItems,
        pinItem,
        unpinItem,
        addRecentItem,
        updateUserPreferences,
        removeSource,
        addSource,
        refreshSources,
      }}
    >
      {children}
    </KnowledgeContext.Provider>
  );
}; 