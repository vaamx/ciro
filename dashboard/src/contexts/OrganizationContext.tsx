import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { buildApiUrl } from '../api-config';

// Add declaration for window.disableLoginPrompt
declare global {
  interface Window {
    disableLoginPrompt?: (seconds?: number) => void;
  }
}

// Add a constant for the localStorage key
const CURRENT_ORG_STORAGE_KEY = 'currentOrganizationId';

interface Organization {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
}

interface Team {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  organizations: Organization[];
  teams: Team[];
  loadOrganizations: () => Promise<void>;
  loadTeams: (organizationId: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, emitAuthError, disableLoginPrompt } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create a wrapped version of setCurrentOrganization that also saves to localStorage
  const setCurrentOrganizationWithStorage = (org: Organization | null) => {
    setCurrentOrganization(org);
    // If org is null, remove from localStorage, otherwise save the ID
    if (org === null) {
      localStorage.removeItem(CURRENT_ORG_STORAGE_KEY);
    } else {
      localStorage.setItem(CURRENT_ORG_STORAGE_KEY, org.id.toString());
      // Also save with consistent key name for API service
      localStorage.setItem('current_organization_id', org.id.toString());
    }
  };

  const loadOrganizations = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      // Temporarily disable login prompt during the initial load
      // to prevent immediate login popup when the page loads
      if (window.disableLoginPrompt) {
        window.disableLoginPrompt(5); // Disable for 5 seconds during load
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Use buildApiUrl to get the correct URL for the current environment
      const apiUrl = buildApiUrl('/api/organizations');
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check content type to see if we received HTML instead of JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.warn('Received HTML response for JSON endpoint - likely an authentication issue', {
          status: response.status,
          url: response.url
        });
        
        // If we're getting HTML when expecting JSON, it's likely an auth issue
        localStorage.removeItem('auth_token');
        
        // Trigger auth error event
        emitAuthError('Authentication required. Please log in.');
        
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Received 401 Unauthorized - clearing auth token');
          localStorage.removeItem('auth_token');
          
          // Trigger auth error event
          emitAuthError('Your session has expired. Please log in again.');
          
          setOrganizations([]);
          setCurrentOrganization(null);
          return;
        }
        throw new Error('Failed to load organizations');
      }

      // Try parsing the response and check if it's actually HTML
      let data;
      const text = await response.text();
      
      try {
        // Check if the response looks like HTML before trying to parse
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          console.warn('Response looks like HTML even though status was OK');
          localStorage.removeItem('auth_token');
          emitAuthError('Authentication required. Please log in.');
          setOrganizations([]);
          setCurrentOrganization(null);
          return;
        }
        
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.log('Response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        
        // If parsing fails, it's likely an auth issue (HTML login page)
        localStorage.removeItem('auth_token');
        emitAuthError('Authentication required. Please log in.');
        
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }
      
      setOrganizations(data);
      
      // Get the saved organization ID from localStorage
      const savedOrgId = localStorage.getItem(CURRENT_ORG_STORAGE_KEY);
      
      if (savedOrgId && data.length > 0) {
        // Find the organization with the saved ID
        const savedOrg = data.find((org: Organization) => org.id.toString() === savedOrgId);
        if (savedOrg) {
          setCurrentOrganization(savedOrg);
          return;
        }
      }
      
      // If there's no saved organization or it wasn't found, and we have organizations,
      // select the first one by default
      if (!currentOrganization && data.length > 0) {
        setCurrentOrganization(data[0]);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load organizations');
      }
      // Don't clear organizations if we already have data
      if (organizations.length === 0) {
        setOrganizations([]);
        setCurrentOrganization(null);
      }
    }
  };

  const loadTeams = async (organizationId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      // Use buildApiUrl to get the correct URL for the current environment
      const apiUrl = buildApiUrl(`/api/organizations/${organizationId}/teams`);
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check content type to see if we received HTML instead of JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.warn('Received HTML response for teams endpoint - likely an authentication issue', {
          status: response.status,
          url: response.url
        });
        
        // If we're getting HTML when expecting JSON, it's likely an auth issue
        localStorage.removeItem('auth_token');
        
        // Trigger auth error event
        emitAuthError('Authentication required. Please log in.');
        
        setTeams([]);
        setCurrentTeam(null);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Teams request: Received 401 Unauthorized - clearing auth token');
          localStorage.removeItem('auth_token');
          
          // Trigger auth error event
          emitAuthError('Your session has expired. Please log in again.');
          
          setTeams([]);
          setCurrentTeam(null);
          return;
        }
        throw new Error('Failed to load teams');
      }
      
      // Try parsing the response and check if it's actually HTML
      let data;
      const text = await response.text();
      
      try {
        // Check if the response looks like HTML before trying to parse
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
          console.warn('Teams response looks like HTML even though status was OK');
          localStorage.removeItem('auth_token');
          emitAuthError('Authentication required. Please log in.');
          setTeams([]);
          setCurrentTeam(null);
          return;
        }
        
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse teams response as JSON:', parseError);
        console.log('Teams response text:', text.substring(0, 200) + '...'); // Log first 200 chars
        
        // If parsing fails, it's likely an auth issue (HTML login page)
        localStorage.removeItem('auth_token');
        emitAuthError('Authentication required. Please log in.');
        
        setTeams([]);
        setCurrentTeam(null);
        return;
      }
      
      setTeams(data);
      
      // Reset current team when changing organizations
      setCurrentTeam(null);
    } catch (error) {
      console.error('Error loading teams:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load teams');
      }
      // Don't clear teams if we already have data
      if (teams.length === 0) {
        setTeams([]);
      }
    }
  };

  // Load organizations when user is authenticated
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: number;

    const initialize = async () => {
      try {
        if (isAuthenticated && user) {
          // Disable login prompt during initial load
          if (disableLoginPrompt) {
            disableLoginPrompt(10); // Disable for 10 seconds during initialization
          }
          
          setIsLoading(true);
          await loadOrganizations();
        } else {
          // Reset state when user is not authenticated
          setOrganizations([]);
          setCurrentOrganization(null);
          setTeams([]);
          setCurrentTeam(null);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error initializing organizations:', error);
          // Retry after 2 seconds if it's not an abort error
          if (!(error instanceof Error && error.name === 'AbortError')) {
            retryTimeout = window.setTimeout(initialize, 2000);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [isAuthenticated, user, disableLoginPrompt]);

  // Load teams whenever the current organization changes
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: number;

    const loadTeamsWithRetry = async () => {
      if (currentOrganization && isAuthenticated) {
        try {
          await loadTeams(currentOrganization.id);
        } catch (error) {
          if (isMounted) {
            console.error('Error loading teams:', error);
            // Retry after 2 seconds if it's not an abort error
            if (!(error instanceof Error && error.name === 'AbortError')) {
              retryTimeout = window.setTimeout(() => loadTeamsWithRetry(), 2000);
            }
          }
        }
      }
    };

    loadTeamsWithRetry();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [currentOrganization, isAuthenticated]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        setCurrentOrganization: setCurrentOrganizationWithStorage,
        currentTeam,
        setCurrentTeam,
        organizations,
        teams,
        loadOrganizations,
        loadTeams,
        isLoading,
        error
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
} 