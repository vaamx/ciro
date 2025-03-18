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
  emitAuthError: (message: string) => void;
  disableLoginPrompt: (seconds?: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptDisabled, setLoginPromptDisabled] = useState(false);

  // Add use effect to check if login is needed on auth errors
  useEffect(() => {
    // Listen for auth errors from anywhere in the app
    const handleAuthError = (event: CustomEvent) => {
      console.log('Auth error detected:', event.detail);
      
      // Only show the login prompt if it's not disabled
      if (!loginPromptDisabled) {
        // Check the current path - only show login for sensitive areas
        const path = window.location.pathname.toLowerCase();
        // List of paths that require authentication
        const authRequiredPaths = [
          '/dashboards',
          '/organizations',
          '/settings',
          '/analytics',
          '/admin'
        ];
        
        // Check if we're on a path that requires authentication
        const requiresAuth = authRequiredPaths.some(authPath => 
          path.includes(authPath) || path === '/'
        );
        
        if (requiresAuth) {
          setShowLoginPrompt(true);
        } else {
          // For non-critical paths, just log the error without showing the prompt
          console.warn('Authentication issue on non-critical path. Login prompt suppressed.');
        }
      } else {
        console.log('Login prompt disabled, suppressing auth error UI');
      }
    };

    // Create custom event listener
    window.addEventListener('auth:error' as any, handleAuthError);

    return () => {
      window.removeEventListener('auth:error' as any, handleAuthError);
    };
  }, [loginPromptDisabled]);

  // Add a function to emit auth errors from anywhere
  const emitAuthError = useCallback((message: string) => {
    const event = new CustomEvent('auth:error', { 
      detail: { message } 
    });
    window.dispatchEvent(event);
  }, []);

  // Add a function to temporarily disable the login prompt
  const disableLoginPrompt = useCallback((seconds: number = 60) => {
    setLoginPromptDisabled(true);
    // Re-enable after specified seconds
    setTimeout(() => {
      setLoginPromptDisabled(false);
    }, seconds * 1000);
  }, []);

  // Expose the emitAuthError function
  useEffect(() => {
    (window as any).emitAuthError = emitAuthError;
    // Also expose the disable function
    (window as any).disableLoginPrompt = disableLoginPrompt;
  }, [emitAuthError, disableLoginPrompt]);

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

      // Save the auth token in both localStorage and sessionStorage for redundancy
      localStorage.setItem('auth_token', data.token);
      // Also store in sessionStorage as a backup
      try {
        sessionStorage.setItem('auth_token', data.token);
      } catch (e) {
        console.warn('Could not save token to sessionStorage:', e);
      }
      
      // Store the login timestamp
      localStorage.setItem('auth_timestamp', Date.now().toString());
      
      console.log('Token saved to storage:', data.token.substring(0, 10) + '...');
      
      if (!data.user) {
        throw new Error('No user data received');
      }

      setUser(data.user);
      console.log('User set in AuthContext:', data.user);
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during login');
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
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
        // Check localStorage first
        let token = localStorage.getItem('auth_token');
        
        // If token not in localStorage, try sessionStorage as backup
        if (!token) {
          const sessionToken = sessionStorage.getItem('auth_token');
          if (sessionToken) {
            console.log('Restoring token from sessionStorage');
            token = sessionToken;
            // Sync back to localStorage
            localStorage.setItem('auth_token', sessionToken);
          }
        }
        
        if (!token && mounted) {
          console.log('No token found in storage, user is not authenticated');
          setUser(null);
          return;
        }
        
        // Check token age - if over 23 hours, force a refresh
        const tokenTimestamp = localStorage.getItem('auth_timestamp');
        const tokenAge = tokenTimestamp ? Date.now() - parseInt(tokenTimestamp) : 0;
        const maxTokenAge = 23 * 60 * 60 * 1000; // 23 hours in milliseconds
        
        if (tokenAge > maxTokenAge) {
          console.log('Token is aging (over 23 hours old), requesting fresh token');
        }

        console.log('Attempting to restore session with token:', token?.substring(0, 10) + '...');
        const response = await fetch(buildApiUrl('auth/me'), {
          method: 'GET',
          credentials: 'include', // This ensures cookies are sent
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          // Handle specific status codes
          console.warn(`Session restoration returned status: ${response.status}`);
          
          if (response.status === 401 && retryCount < maxRetries) {
            retryCount++;
            // Wait before retrying (exponential backoff)
            const backoffTime = 1000 * Math.pow(2, retryCount);
            console.log(`Auth token verification failed, retrying in ${backoffTime}ms (attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return restoreSession();
          }
          
          // If we got here, we've exhausted retries or got a non-401 error
          if (retryCount >= maxRetries) {
            console.error(`Failed to restore session after ${maxRetries} attempts`);
          } else {
            console.error(`Session restoration failed with status ${response.status}`);
          }
          
          throw new Error('Session expired');
        }

        const data = await response.json();
        
        if (!data || !data.id) {
          console.error('Invalid user data received:', data);
          throw new Error('Invalid user data received');
        }

        // Update token if a new one was provided in the Authorization header
        const newToken = response.headers.get('Authorization')?.split(' ')[1];
        if (newToken && mounted) {
          console.log('Received new token from server, updating storage');
          localStorage.setItem('auth_token', newToken);
          localStorage.setItem('auth_timestamp', Date.now().toString());
          
          // Keep sessionStorage in sync
          try {
            sessionStorage.setItem('auth_token', newToken);
          } catch (e) {
            console.warn('Could not update sessionStorage with new token:', e);
          }
        }

        if (mounted) {
          console.log('Session restored successfully, user data:', data.id);
          setUser(data);
          retryCount = 0; // Reset retry count on success
        }
      } catch (error) {
        console.error('Session restoration failed:', error);
        if (mounted) {
          if (retryCount >= maxRetries) {
            console.log('Max retries exceeded, clearing authentication');
            localStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_token');
            localStorage.removeItem('auth_timestamp');
            setUser(null);
          }
        }
      }
    };

    // Initial session restore
    restoreSession();

    // Set up periodic session verification (every 5 minutes)
    intervalId = window.setInterval(() => {
      restoreSession();
    }, 5 * 60 * 1000);

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
      // Log the fact that we're logging out
      console.log('Logging out user...');
      
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
      // Clear token from all storages
      console.log('Clearing authentication tokens');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_timestamp');
      sessionStorage.removeItem('auth_token');
      
      // Clear user state
      setUser(null);
      
      // Clear cookies (as a fallback in case server response doesn't)
      document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Reload the application to clear all states
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        console.log('Redirecting to home page after logout');
        window.location.href = '/';
      }
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

  // Create a LoginPrompt component
  const LoginPrompt = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setLoginError(null);

      try {
        await login(email, password);
        setShowLoginPrompt(false);
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setIsSubmitting(false);
      }
    };

    return showLoginPrompt ? (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h2 style={{ marginTop: 0 }}>Authentication Required</h2>
          <p>Please log in to continue using the application.</p>
          
          {loginError && (
            <div style={{ color: 'red', marginBottom: '1rem' }}>
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                style={{ width: '100%', padding: '0.5rem' }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.5rem' }}
                required
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                type="button" 
                onClick={() => setShowLoginPrompt(false)}
                style={{ padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;
  };

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
    resetPassword,
    emitAuthError,
    disableLoginPrompt
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showLoginPrompt && !loginPromptDisabled && <LoginPrompt />}
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