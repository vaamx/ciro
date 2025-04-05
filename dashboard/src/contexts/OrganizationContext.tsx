import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, buildApiUrl } from './AuthContext';

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
  const { user, isAuthenticated } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false); // Track team loading state
  const [teamLoadHistory, setTeamLoadHistory] = useState<Record<number, number>>({}); // Track when teams were last loaded by org ID

  // Add function to restore organization from localStorage
  const restoreLastActiveOrganization = useCallback(async (orgList: Organization[]) => {
    try {
      const savedOrgId = localStorage.getItem('active_organization_id');
      
      if (savedOrgId && orgList.length > 0) {
        const orgId = parseInt(savedOrgId, 10);
        const savedOrg = orgList.find(org => org.id === orgId);
        
        if (savedOrg) {
          console.log(`Restoring active organization: ${savedOrg.name} (ID: ${savedOrg.id})`);
          setCurrentOrganization(savedOrg);
          
          // Also load teams for this organization
          await loadTeams(savedOrg.id);
          return true;
        } else {
          console.log(`Saved organization ID ${orgId} not found in loaded organizations. Using default.`);
        }
      }
      return false;
    } catch (error) {
      console.error('Error restoring active organization:', error);
      return false;
    }
  }, []);

  // Modify the existing loadOrganizations function to use our restore function
  const loadOrganizations = async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(buildApiUrl('organizations'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          setOrganizations([]);
          setCurrentOrganization(null);
          return;
        }
        throw new Error('Failed to load organizations');
      }

      const data = await response.json();
      setOrganizations(data);
      
      // Try to restore last active organization
      const restored = await restoreLastActiveOrganization(data);
      
      // If not restored and we have organizations, set the first one as current
      if (!restored && data.length > 0 && !currentOrganization) {
        setCurrentOrganization(data[0]);
        await loadTeams(data[0].id);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Use useCallback for the loadTeams function to avoid dependency cycles
  const loadTeams = useCallback(async (organizationId: number) => {
    // Early return if we're already loading teams for this organization
    if (isLoadingTeams) {
      console.log(`Already loading teams for organization, skipping duplicate request`);
      return;
    }

    // Check if we've loaded teams for this org recently (in the last 10 seconds)
    const now = Date.now();
    const lastLoadTime = teamLoadHistory[organizationId] || 0;
    if (now - lastLoadTime < 10000) { // 10 seconds
      console.log(`Teams for org ${organizationId} were loaded ${now - lastLoadTime}ms ago, using cached data`);
      return;
    }

    setIsLoadingTeams(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(buildApiUrl(`organizations/${organizationId}/teams`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          setTeams([]);
          setCurrentTeam(null);
          return;
        }
        throw new Error('Failed to load teams');
      }
      
      const data = await response.json();
      setTeams(data);
      
      // Update the load history for this organization
      setTeamLoadHistory(prev => ({
        ...prev,
        [organizationId]: now
      }));
      
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
    } finally {
      setIsLoadingTeams(false);
    }
  }, [isLoadingTeams, teamLoadHistory, teams.length]);

  // Load organizations when user is authenticated
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: number;

    const initialize = async () => {
      try {
        if (isAuthenticated && user) {
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
  }, [isAuthenticated, user]);

  // Load teams whenever the current organization changes
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: number;
    let abortController: AbortController;
    let lastLoadTime = 0;
    const throttleTime = 5000; // 5 seconds between team loading attempts

    const loadTeamsWithRetry = async (attempt = 1, maxAttempts = 3) => {
      if (!currentOrganization || !isAuthenticated) return;
      
      // Check if we should skip loading because another load is in progress
      if (isLoadingTeams) {
        console.log('Skipping team load request, another load is in progress');
        return;
      }
      
      if (attempt > maxAttempts) {
        console.warn(`Max retry attempts (${maxAttempts}) reached for loading teams.`);
        return;
      }

      // Add throttling to prevent excessive calls
      const now = Date.now();
      if (now - lastLoadTime < throttleTime) {
        console.log(`Throttling team loading - last attempt was ${now - lastLoadTime}ms ago`);
        return;
      }
      lastLoadTime = now;

      // Check load history to avoid duplicate requests
      const lastOrgLoadTime = teamLoadHistory[currentOrganization.id] || 0;
      if (now - lastOrgLoadTime < 10000) { // 10 seconds
        console.log(`Teams for organization ${currentOrganization.id} were loaded ${now - lastOrgLoadTime}ms ago, using cached data`);
        return;
      }

      // Cancel any existing request
      if (abortController) {
        abortController.abort();
      }
      
      // Create new controller for this request
      abortController = new AbortController();

      try {
        console.log(`Loading teams for organization ${currentOrganization.id} (attempt ${attempt}/${maxAttempts})`);
        await loadTeams(currentOrganization.id);
      } catch (error) {
        if (!isMounted) return;
        
        console.error(`Error loading teams (attempt ${attempt}/${maxAttempts}):`, error);
        
        // Only retry if it's not an abort error or a network error
        const shouldRetry = !(error instanceof Error && 
          (error.name === 'AbortError' || error.message.includes('network')));
        
        if (shouldRetry && attempt < maxAttempts) {
          const delay = Math.min(2000 * Math.pow(1.5, attempt - 1), 10000); // Exponential backoff with max
          console.log(`Retrying in ${delay}ms...`);
          
          retryTimeout = window.setTimeout(() => {
            if (isMounted) {
              loadTeamsWithRetry(attempt + 1, maxAttempts);
            }
          }, delay);
        }
      }
    };

    // Don't immediately load teams if we already have data for this org
    if (currentOrganization && teamLoadHistory[currentOrganization.id]) {
      const now = Date.now();
      const lastLoadTime = teamLoadHistory[currentOrganization.id] || 0;
      if (now - lastLoadTime < 30000) { // 30 seconds
        console.log(`Using cached team data for organization ${currentOrganization.id}`);
        return;
      }
    }

    loadTeamsWithRetry();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (abortController) {
        abortController.abort('Component unmounted');
      }
    };
  }, [currentOrganization, isAuthenticated, loadTeams, isLoadingTeams, teamLoadHistory]);

  // Update localStorage when current organization changes
  useEffect(() => {
    if (currentOrganization) {
      localStorage.setItem('active_organization_id', currentOrganization.id.toString());
    }
  }, [currentOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        setCurrentOrganization,
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