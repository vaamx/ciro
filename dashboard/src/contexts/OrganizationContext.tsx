import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

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

  const loadOrganizations = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/organizations', {
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
      
      // If there's no current organization selected and we have organizations,
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

      const response = await fetch(`/api/organizations/${organizationId}/teams`, {
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