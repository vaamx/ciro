import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import type { User, LoginCredentials, RegisterCredentials } from '../types/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials | string, password?: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<{ message: string; user: User }>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Clear error function
  const clearError = () => {
    setError(null);
  };

  // Login function - support both signatures
  const login = async (credentials: LoginCredentials | string, password?: string) => {
    try {
      setError(null);
      
      // Handle both calling patterns
      let loginCredentials: LoginCredentials;
      if (typeof credentials === 'string') {
        loginCredentials = { email: credentials, password: password! };
      } else {
        loginCredentials = credentials;
      }

      const response = await authAPI.login(loginCredentials);
      
      // Store the access token
      localStorage.setItem('accessToken', response.accessToken);
      
      // Set user data
      setUser(response.user);
    } catch (error: any) {
      // Clear any existing token on login failure
      localStorage.removeItem('accessToken');
      const errorMessage = error.response?.data?.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Signup function
  const signup = async (email: string, password: string, name: string) => {
    try {
      setError(null);
      
      const credentials: RegisterCredentials = {
        email,
        password,
        name
      };
      
      const response = await authAPI.signup(credentials);
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Even if logout fails, we should clear local state
      console.error('Logout error:', error);
    } finally {
      // Always clear local state and token
      localStorage.removeItem('accessToken');
      setUser(null);
      setError(null);
    }
  };

  // Check authentication status on mount and token changes
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authAPI.getMe();
        setUser(userData);
      } catch (error) {
        // Token is invalid, remove it
        localStorage.removeItem('accessToken');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Cross-tab session synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        if (!e.newValue) {
          // Token was removed in another tab
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = {
    user,
    isLoading,
    error,
    login,
    signup,
    logout,
    clearError,
    isAuthenticated,
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