import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DataSource as KnowledgeDataSource, KnowledgeItem, SearchFilters, UserKnowledgePreferences } from '../types/knowledge';
import { DataSource as AppDataSource } from '../types/data-source';
import { useOrganization } from '../contexts/OrganizationContext';
import { getAuthToken } from '../utils/authToken';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

// Component name for logging
const COMPONENT_NAME = 'KnowledgeProvider';

const DEFAULT_USER_PREFERENCES: UserKnowledgePreferences = {
  pinnedSources: [],
  pinnedItems: [],
  defaultView: 'list',
  favoriteTopics: [],
};

// Use consistent API URL and Socket URL across the application
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

// Extended search filters interface for API parameters
interface ExtendedSearchFilters extends SearchFilters {
  sourceId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

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
  fetchDataSources: () => Promise<void>;
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

export function KnowledgeProvider({ children }: KnowledgeProviderProps) {
  const [sources, setSources] = useState<KnowledgeDataSource[]>([]);
  const [activeSource, setActiveSource] = useState<KnowledgeDataSource | null>(null);
  const [pinnedItems, setPinnedItems] = useState<KnowledgeItem[]>([]);
  const [recentItems, setRecentItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserKnowledgePreferences>(DEFAULT_USER_PREFERENCES);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryTime, setLastRetryTime] = useState(0);
  const [lastLoadTime, setLastLoadTime] = useState(0);
  const [sourceCache, _setSourceCache] = useState<Record<string, KnowledgeDataSource[]>>({});
  const [itemCache, _setItemCache] = useState<Record<string, KnowledgeItem[]>>({});
  const [cacheTimestamp, setCacheTimestamp] = useState<Record<string, number>>({});
  
  // Cache expiration time - 5 minutes
  const CACHE_EXPIRATION = 5 * 60 * 1000;
  // Minimum time between data source loads - 10 seconds
  const MIN_LOAD_INTERVAL = 10000;
  // Maximum retry count before giving up
  const MAX_RETRY_COUNT = 5;
  
  const { isAuthenticated, user } = useAuth();
  const { currentOrganization } = useOrganization();
  
  // Function to check if cache is valid
  const isCacheValid = (key: string): boolean => {
    const timestamp = cacheTimestamp[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_EXPIRATION;
  };
  
  // Function to update cache
  const updateCache = <T extends any>(
    key: string, 
    data: T, 
    timestamp: number
  ) => {
    // Store data in appropriate cache based on key prefix
    if (key.startsWith('sources_')) {
      _setSourceCache(prev => ({ ...prev, [key]: data as KnowledgeDataSource[] }));
    } else if (key.startsWith('search_')) {
      _setItemCache(prev => ({ ...prev, [key]: data as KnowledgeItem[] }));
    }
    
    // Update timestamp
    setCacheTimestamp(prev => ({ ...prev, [key]: timestamp }));
  };
  
  // Function to get from cache
  const getFromCache = <T extends any>(key: string, cache: Record<string, T>): T | null => {
    if (!isCacheValid(key)) return null;
    return cache[key] || null;
  };
  
  // Function to clear cache for a specific organization - unused but kept for future reference
  // const clearCache = useCallback((organizationId: string | number) => {
  //   const cacheKey = `sources_${organizationId}`;
  //   logger.info(COMPONENT_NAME, `Clearing cache for organization ${organizationId}`);
  //   
  //   // Remove from cache
  //   _setSourceCache(prev => {
  //     const newCache = { ...prev };
  //     delete newCache[cacheKey];
  //     return newCache;
  //   });
  //   
  //   // Remove from timestamp cache
  //   setCacheTimestamp(prev => {
  //     const newTimestamps = { ...prev };
  //     delete newTimestamps[cacheKey];
  //     return newTimestamps;
  //   });
  //   
  //   logger.info(COMPONENT_NAME, `Cache cleared for organization ${organizationId}`);
  // }, []);
  
  // Fetch data sources from the server
  const fetchDataSources = useCallback(async () => {
    // Skip if not authenticated or no organization selected
    if (!isAuthenticated || !user || !currentOrganization?.id) {
      logger.warn(COMPONENT_NAME, 'Skipping data source fetch - user not authenticated or no organization selected');
      return;
    }
    
    logger.info(COMPONENT_NAME, `Attempting to fetch data sources for organization ${currentOrganization.id}`);
    
    // Check if we're in a rate-limited state
    const now = Date.now();
    const timeSinceLastRetry = now - lastRetryTime;
    const backoffTime = Math.min(30000, 1000 * Math.pow(2, retryCount));
    
    if (retryCount > 0 && timeSinceLastRetry < backoffTime) {
      logger.warn(COMPONENT_NAME, `Skipping data source fetch - in backoff period. Waiting ${(backoffTime - timeSinceLastRetry) / 1000}s`);
      return;
    }
    
    // Debounce: prevent loading too frequently
    const timeSinceLastLoad = now - lastLoadTime;
    if (timeSinceLastLoad < MIN_LOAD_INTERVAL) {
      logger.warn(COMPONENT_NAME, `Debouncing data source fetch - last load was ${timeSinceLastLoad / 1000}s ago`);
      return;
    }
    
    // Update last load time
    setLastLoadTime(now);
    
    // Prepare cache key
    const cacheKey = `sources_${currentOrganization.id}`;
    const cachedSources = getFromCache(cacheKey, sourceCache);
    
    if (cachedSources) {
      logger.info(COMPONENT_NAME, `Using cached data sources from ${(now - cacheTimestamp[cacheKey]) / 1000}s ago. Found ${cachedSources.length} sources.`);
      setSources(cachedSources);
      return;
    }
    
    logger.info(COMPONENT_NAME, 'No valid cache found, fetching fresh data sources from server');
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const apiUrl = `${API_BASE_URL}/api/data-sources?organization_id=${currentOrganization.id}`;
      logger.info(COMPONENT_NAME, `Fetching data sources from: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 429) {
        logger.warn(COMPONENT_NAME, 'Server returned 429 when fetching knowledge sources');
        logger.warn(COMPONENT_NAME, 'Rate limiting detected for knowledge sources');
        
        // Increment retry count and set last retry time
        setRetryCount(prev => Math.min(MAX_RETRY_COUNT, prev + 1));
        setLastRetryTime(now);
        
        throw new Error('Failed to fetch data sources: 429');
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data sources: ${response.status}`);
      }
      
      const data = await response.json();
      logger.info(COMPONENT_NAME, `Fetched ${data.length} data sources from server`);
      
      // Reset retry count on success
      if (retryCount > 0) {
        setRetryCount(0);
        setLastRetryTime(0);
      }
      
      // Transform API data sources to knowledge data sources
      const knowledgeSources: KnowledgeDataSource[] = data.map((source: AppDataSource) => ({
        id: source.id,
        name: source.name,
        icon: source.metadata?.icon || 'database',
        type: (source.type as any) || 'internal',
        description: source.description,
        isActive: source.status === 'ready' || source.status === 'connected' || source.status === 'completed',
        lastSynced: source.lastSync ? new Date(source.lastSync) : undefined
      }));
      
      logger.info(COMPONENT_NAME, `Transformed ${knowledgeSources.length} data sources, with ${knowledgeSources.filter(s => s.isActive).length} active sources`);
      
      // Update cache
      updateCache(cacheKey, knowledgeSources, now);
      logger.info(COMPONENT_NAME, `Updated cache for key: ${cacheKey}`);
      
      // Update state
      setSources(knowledgeSources);
      
      // If we have user preferences with pinned sources, set the first one as active
      if (userPreferences.pinnedSources.length > 0) {
        const pinnedSource = knowledgeSources.find(s => s.id === userPreferences.pinnedSources[0]);
        if (pinnedSource) {
          logger.info(COMPONENT_NAME, `Setting pinned source as active: ${pinnedSource.id} - ${pinnedSource.name}`);
          setActiveSource(pinnedSource);
        }
      } else if (knowledgeSources.length > 0 && !activeSource) {
        // Otherwise set the first source as active
        logger.info(COMPONENT_NAME, `Setting first source as active: ${knowledgeSources[0].id} - ${knowledgeSources[0].name}`);
        setActiveSource(knowledgeSources[0]);
      }
      
      // Save to localStorage for future fallback
      try {
        localStorage.setItem('knowledge_sources', JSON.stringify(knowledgeSources));
        logger.debug(COMPONENT_NAME, 'Saved sources to localStorage for fallback');
      } catch (e) {
        logger.error(COMPONENT_NAME, 'Failed to cache sources in localStorage:', e);
      }
    } catch (error) {
      logger.error(COMPONENT_NAME, 'Error fetching data sources:', error);
      
      // Try to load from localStorage as fallback
      try {
        const storedSources = localStorage.getItem('knowledge_sources');
        if (storedSources) {
          const parsedSources = JSON.parse(storedSources) as KnowledgeDataSource[];
          logger.info(COMPONENT_NAME, `Loaded ${parsedSources.length} sources from localStorage fallback`);
          setSources(parsedSources);
          
          if (parsedSources.length > 0 && !activeSource) {
            logger.info(COMPONENT_NAME, `Setting first fallback source as active: ${parsedSources[0].id} - ${parsedSources[0].name}`);
            setActiveSource(parsedSources[0]);
          }
        }
      } catch (localStorageError) {
        logger.error(COMPONENT_NAME, 'Error loading sources from localStorage:', localStorageError);
      }
      
      setError('Failed to load knowledge sources. Please try again later.');
    } finally {
      setIsLoading(false);
      logger.info(COMPONENT_NAME, 'Completed data source fetch operation');
    }
  }, [
    isAuthenticated,
    user,
    currentOrganization?.id,
    retryCount,
    lastRetryTime,
    lastLoadTime,
    activeSource,
    userPreferences.pinnedSources,
    sourceCache,
    cacheTimestamp,
    getFromCache,
    updateCache
  ]);
  
  // Search for knowledge items
  const searchItems = useCallback(async (filters: SearchFilters): Promise<KnowledgeItem[]> => {
    if (!activeSource) {
      logger.warn(COMPONENT_NAME, 'Search attempted without an active data source');
      return [];
    }
    
    // Log the search request
    logger.info(COMPONENT_NAME, `Searching knowledge items with filters:`, filters);
    logger.info(COMPONENT_NAME, `Active data source:`, {
      id: activeSource.id,
      name: activeSource.name,
      type: activeSource.dataSourceType || activeSource.type || 'unknown'
    });
    
    // Prepare cache key
    const cacheKey = `search_${activeSource.id}_${JSON.stringify(filters)}`;
    const cachedItems = getFromCache(cacheKey, itemCache);
    
    if (cachedItems) {
      logger.debug(COMPONENT_NAME, `Using cached search results from ${(Date.now() - cacheTimestamp[cacheKey]) / 1000}s ago`);
      return cachedItems;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        const errorMsg = 'Authentication token not found';
        logger.error(COMPONENT_NAME, errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.query) queryParams.append('query', filters.query);
      
      // Convert sources array to source_id if present
      if (filters.sources && filters.sources.length > 0) {
        queryParams.append('source_id', filters.sources[0]);
      } else {
        // If no source is specified in filters, use the active source
        queryParams.append('source_id', activeSource.id);
      }
      
      // Add data source type if available
      if (activeSource.dataSourceType) {
        queryParams.append('data_source_type', activeSource.dataSourceType);
      }
      
      // Add extended filters if present (casting to access potential extended properties)
      const extendedFilters = filters as ExtendedSearchFilters;
      if (extendedFilters.limit) queryParams.append('limit', extendedFilters.limit.toString());
      if (extendedFilters.offset) queryParams.append('offset', extendedFilters.offset.toString());
      if (extendedFilters.sortBy) queryParams.append('sort_by', extendedFilters.sortBy);
      if (extendedFilters.sortDirection) queryParams.append('sort_direction', extendedFilters.sortDirection);
      
      if (currentOrganization?.id) queryParams.append('organization_id', currentOrganization.id.toString());
      
      // Log the API request
      const requestUrl = `${API_BASE_URL}/api/ext/knowledge/search?${queryParams.toString()}`;
      logger.info(COMPONENT_NAME, `Sending search request to: ${requestUrl}`);
      
      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorMsg = `Failed to search knowledge items: ${response.status} ${response.statusText}`;
        logger.error(COMPONENT_NAME, errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      
      // Handle both formats: direct array or {items: [...]}
      const items = Array.isArray(data) ? data : (data.items || []);
      
      // Enhance items with data source type if not already present
      const enhancedItems = items.map((item: any) => ({
        ...item,
        dataSourceType: item.dataSourceType || activeSource.dataSourceType || activeSource.type || 'unknown'
      }));
      
      // Log the search results
      logger.info(COMPONENT_NAME, `Search returned ${enhancedItems.length} results`);
      logger.debug(COMPONENT_NAME, 'Search results:', enhancedItems);
      
      // Update cache
      updateCache(cacheKey, enhancedItems, Date.now());
      
      return enhancedItems;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during search';
      logger.error(COMPONENT_NAME, 'Error searching knowledge items:', error);
      setError(`Failed to search knowledge items: ${errorMsg}. Please try again later.`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, currentOrganization?.id, itemCache, cacheTimestamp, getAuthToken]);
  
  // Effect to fetch data sources when the organization changes or auth status changes
  useEffect(() => {
    if (isAuthenticated && user && currentOrganization?.id) {
      fetchDataSources();
    }
  }, [isAuthenticated, user, currentOrganization?.id]);
  
  // Effect to load user preferences from localStorage
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        const storedPreferences = localStorage.getItem(`knowledge_preferences_${user.id}`);
        if (storedPreferences) {
          const parsedPreferences = JSON.parse(storedPreferences) as UserKnowledgePreferences;
          setUserPreferences(parsedPreferences);
        }
      } catch (e) {
        logger.error(COMPONENT_NAME, 'Error loading user preferences:', e);
      }
    }
  }, [isAuthenticated, user]);
  
  // Function to update user preferences
  const updateUserPreferences = useCallback((preferences: Partial<UserKnowledgePreferences>) => {
    setUserPreferences(prev => {
      const updated = { ...prev, ...preferences };
      
      // Save to localStorage
      if (user) {
        try {
          localStorage.setItem(`knowledge_preferences_${user.id}`, JSON.stringify(updated));
        } catch (e) {
          logger.error(COMPONENT_NAME, 'Error saving user preferences:', e);
        }
      }
      
      return updated;
    });
  }, [user]);
  
  // Function to pin an item
  const pinItem = useCallback((item: KnowledgeItem) => {
    setPinnedItems(prev => {
      // Check if already pinned
      if (prev.some(i => i.id === item.id)) {
        return prev;
      }
      
      const updated = [...prev, item];
      
      // Update user preferences
      updateUserPreferences({
        pinnedItems: updated.map(i => i.id)
      });
      
      return updated;
    });
  }, [updateUserPreferences]);
  
  // Function to unpin an item
  const unpinItem = useCallback((itemId: string) => {
    setPinnedItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      
      // Update user preferences
      updateUserPreferences({
        pinnedItems: updated.map(i => i.id)
      });
      
      return updated;
    });
  }, [updateUserPreferences]);
  
  // Function to add a recent item
  const addRecentItem = useCallback((item: KnowledgeItem) => {
    setRecentItems(prev => {
      // Remove if already exists
      const filtered = prev.filter(i => i.id !== item.id);
      
      // Add to beginning of array
      const updated = [item, ...filtered].slice(0, 10); // Keep only 10 most recent
      
      return updated;
    });
  }, []);
  
  // Function to remove a data source
  const removeSource = useCallback((sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    
    // If active source is removed, set to null
    if (activeSource?.id === sourceId) {
      setActiveSource(null);
    }
    
    // Update user preferences
    updateUserPreferences({
      pinnedSources: userPreferences.pinnedSources.filter(id => id !== sourceId)
    });
  }, [activeSource, updateUserPreferences, userPreferences.pinnedSources]);
  
  // Function to add a data source
  const addSource = useCallback((source: KnowledgeDataSource) => {
    setSources(prev => [...prev, source]);
  }, []);
  
  // Retry loading data sources
  const retryLoad = useCallback(() => {
    return fetchDataSources();
  }, [fetchDataSources]);
  
  // Enhance setActiveSource function to connect to the correct Qdrant collection
  const handleActiveSourceChange = useCallback((source: KnowledgeDataSource | null) => {
    // Check if we're just reselecting the same source - no need to do anything
    if (source?.id === activeSource?.id) {
      logger.debug(COMPONENT_NAME, `Selected the same source: ${source?.id}, skipping update`);
      return;
    }
    
    // Record the time of this change to help prevent unnecessary chat recovery
    localStorage.setItem('last_data_source_change', Date.now().toString());
    
    // Set the active source in state
    setActiveSource(source);
    
    if (source) {
      logger.info(COMPONENT_NAME, `Setting active source: ${source.id} - ${source.name}`);
      
      // Store the selected data source ID in localStorage for persistence
      localStorage.setItem('selectedDataSource', JSON.stringify({
        id: source.id,
        name: source.name,
        type: source.type
      }));
      
      // Connect to the correct Qdrant collection
      const collectionName = `datasource_${source.id}`;
      logger.info(COMPONENT_NAME, `Connecting to Qdrant collection: ${collectionName}`);
      
      // You could potentially trigger a test query here to ensure the collection is accessible
      
      // Clear any previous errors
      setError(null);
    } else {
      // Clear the selected data source from localStorage
      localStorage.removeItem('selectedDataSource');
      logger.info(COMPONENT_NAME, 'Cleared active source');
    }
  }, [activeSource]);

  // Try to restore active source from localStorage on init
  useEffect(() => {
    if (isAuthenticated && sources.length > 0) {
      try {
        const savedSource = localStorage.getItem('selectedDataSource');
        if (savedSource) {
          const parsedSource = JSON.parse(savedSource);
          const matchingSource = sources.find(s => s.id === parsedSource.id);
          
          if (matchingSource) {
            logger.info(COMPONENT_NAME, `Restoring active source: ${matchingSource.id} - ${matchingSource.name}`);
            setActiveSource(matchingSource);
          }
        }
      } catch (e) {
        logger.error(COMPONENT_NAME, 'Error restoring active source:', e);
      }
    }
  }, [isAuthenticated, sources]);
  
  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    if (isAuthenticated && currentOrganization?.id) {
      logger.info(COMPONENT_NAME, 'Setting up knowledge base connection');
      
      // Set up polling interval instead
      const pollingInterval = setInterval(() => {
        fetchLatestKnowledgeData();
      }, 15000); // Poll every 15 seconds

      return () => {
        clearInterval(pollingInterval);
      };
    }
  }, [isAuthenticated, currentOrganization?.id]);

  // Set up event listener for knowledge base refresh events
  useEffect(() => {
    const handleKnowledgeBaseUpdate = (event: CustomEvent) => {
      logger.info(COMPONENT_NAME, 'Received knowledgeBaseUpdate event', event.detail);
      
      // Force refresh the data sources
      if (isAuthenticated && currentOrganization?.id) {
        logger.info(COMPONENT_NAME, 'Refreshing knowledge base data sources after update event');
        
        // Clear cache for this organization to force fresh data
        const cacheKey = `sources_${currentOrganization.id}`;
        setCacheTimestamp(prev => {
          const newTimestamps = { ...prev };
          delete newTimestamps[cacheKey];
          return newTimestamps;
        });
        
        // Fetch fresh data
        fetchDataSources().catch(error => {
          logger.error(COMPONENT_NAME, 'Error refreshing data sources after update event:', error);
        });
      }
    };

    // Add event listener
    window.addEventListener('knowledgeBaseUpdate', handleKnowledgeBaseUpdate as EventListener);
    logger.info(COMPONENT_NAME, 'Added knowledgeBaseUpdate event listener');

    // Cleanup
    return () => {
      window.removeEventListener('knowledgeBaseUpdate', handleKnowledgeBaseUpdate as EventListener);
      logger.info(COMPONENT_NAME, 'Removed knowledgeBaseUpdate event listener');
    };
  }, [isAuthenticated, currentOrganization?.id, fetchDataSources]);

  // New function to fetch latest knowledge data via REST API
  const fetchLatestKnowledgeData = async () => {
    try {
      if (!currentOrganization?.id) return;
      
      const response = await fetch(`${SOCKET_URL}/api/data-sources?organization_id=${currentOrganization.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Process the data as a direct data sources update
        if (data && Array.isArray(data)) {
          setSources(data);
          // Also update the cache
          if (currentOrganization?.id) {
            updateCache(String(currentOrganization.id), data, Date.now());
          }
        }
      }
    } catch (error) {
      logger.error(COMPONENT_NAME, 'Error fetching knowledge data:', error);
    }
  };
  
  const value = {
    sources,
    activeSource,
    pinnedItems,
    recentItems,
    userPreferences,
    isLoading,
    error,
    setActiveSource: handleActiveSourceChange, // Use the enhanced function
    searchItems,
    pinItem,
    unpinItem,
    addRecentItem,
    updateUserPreferences,
    removeSource,
    addSource,
    fetchDataSources,
    retryLoad
  };
  
  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
} 