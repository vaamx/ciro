import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Use relative path since we're using Vite's proxy
export const API_URL = '';

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

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.message || 'Failed to login');
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No authentication token received');
      }

      // Save the auth token
      localStorage.setItem('auth_token', data.token);
      
      if (!data.user) {
        throw new Error('No user data received');
      }

      setUser(data.user);
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

        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include'
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
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
        credentials: 'include'
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
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
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
      const response = await fetch(`${API_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
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
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
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