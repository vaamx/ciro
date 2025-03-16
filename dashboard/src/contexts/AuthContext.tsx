import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Use environment variable or fallback to relative path
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Base URL without '/api' suffix for constructing API endpoints
export const BASE_URL = API_URL.endsWith('/api') 
  ? API_URL.slice(0, -4)  // Remove '/api' if it exists
  : API_URL;

// Path prefix for API endpoints - don't add /api if it's already included
export const API_PATH = import.meta.env.VITE_API_PATH || '/api';

/**
 * Helper function to build API URLs correctly by ensuring we don't have
 * multiple /api prefixes in the path
 * @param endpoint API endpoint path (without leading slash)
 * @returns Fully qualified URL with proper API path prefix
 */
export function buildApiUrl(endpoint: string): string {
  // Remove any leading slash from the endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // If the endpoint already starts with 'api/', don't add the API_PATH
  if (cleanEndpoint.startsWith('api/')) {
    return `${API_URL}/${cleanEndpoint}`;
  }
  
  // Otherwise add the API_PATH
  const path = API_PATH.endsWith('/') ? API_PATH : `${API_PATH}/`;
  return `${API_URL}${path}${cleanEndpoint}`;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ message: string; user: User }>;
  logout: () => Promise<void>;
  clearError: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    console.log('Attempting login with:', {
      email,
      apiUrl: API_URL,
      endpoint: buildApiUrl('auth/login')
    });

    try {
      const response = await fetch(buildApiUrl('auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      console.log('Login response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const data = await response.json();
        console.log('Login error response:', data);
        throw new Error(data.error || data.message || 'Failed to login');
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No authentication token received');
      }

      // Save the auth token
      localStorage.setItem('auth_token', data.token);
      console.log('Token saved to localStorage:', data.token.substring(0, 10) + '...');
      
      if (!data.user) {
        throw new Error('No user data received');
      }

      setUser(data.user);
      console.log('User set in AuthContext:', data.user);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
      localStorage.removeItem('auth_token');
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let intervalId: number;
    let retryCount = 0;
    const maxRetries = 3;
    
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token && mounted) {
          setUser(null);
          return;
        }

        const response = await fetch(buildApiUrl('auth/me'), {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401 && retryCount < maxRetries) {
            retryCount++;
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return restoreSession();
          }
          throw new Error('Session expired');
        }

        const data = await response.json();
        
        if (!data || !data.id) {
          throw new Error('Invalid user data received');
        }

        // Update token if a new one was provided in the Authorization header
        const newToken = response.headers.get('Authorization')?.split(' ')[1];
        if (newToken && mounted) {
          localStorage.setItem('auth_token', newToken);
        }

        if (mounted) {
          setUser(data);
          retryCount = 0; // Reset retry count on success
        }
      } catch (error) {
        console.error('Session restoration failed:', error);
        if (mounted) {
          if (retryCount >= maxRetries) {
            localStorage.removeItem('auth_token');
            setUser(null);
          }
        }
      }
    };

    // Initial session restore
    restoreSession();

    // Set up periodic session verification (every 4 minutes)
    intervalId = window.setInterval(() => {
      restoreSession();
    }, 4 * 60 * 1000);

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl('auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to register');
      }

      // Don't set user until email is verified
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetch(buildApiUrl('auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl('auth/request-password-reset'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during password reset request');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl('auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during password reset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = {
    user,
    setUser,
    isLoading,
    error,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    clearError,
    requestPasswordReset,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 