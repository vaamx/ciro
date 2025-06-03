// Authentication types for the customer portal - matching server/dashboard system

/**
 * User interface matching the server's User model and dashboard AuthContext
 * This ensures compatibility with the existing auth system
 */
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  avatar?: string; // Optional user avatar URL
}

/**
 * Login credentials for authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data for new users
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

/**
 * Auth context type matching dashboard AuthContext
 */
export interface AuthContextType {
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

/**
 * API response from login endpoint
 */
export interface LoginResponse {
  accessToken: string;
  token: string; // Alternative property name for compatibility
  user: User;
}

/**
 * Password reset request
 */
export interface RequestPasswordResetDto {
  email: string;
}

/**
 * Password reset with token
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

/**
 * Change password request
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// Legacy types for backward compatibility (will be removed after cleanup)
export interface Customer {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: CustomerRole;
  permissions: string[];
  isActive: boolean;
}

export type CustomerRole = 'customer' | 'customer_admin' | 'customer_viewer';

export interface CustomerAuthState {
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  organizationId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface CustomerSession {
  customer: Customer;
  tokens: AuthTokens;
  expiresAt: number;
} 