// Export all TypeScript types and interfaces from this directory
// This file provides a central export point for all type definitions

// Authentication types - matching server/dashboard system
export type { 
  User, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthContextType, 
  LoginResponse,
  RequestPasswordResetDto,
  ResetPasswordDto,
  ChangePasswordDto
} from './auth';

// Legacy customer types (will be removed after cleanup)
export type { Customer, CustomerRole, CustomerAuthState, AuthTokens, CustomerSession } from './auth';

// Route types  
export type { RouteConfig, NestedRouteConfig, RoutePermission, ProtectedRouteProps } from './routes';

// Example exports (to be added as types are created):
// export type { User, UserRole, UserPermission } from './auth-types';
// export type { Customer, CustomerStatus } from './customer-types';
// export type { Invoice, Payment, BillingCycle } from './billing-types';
// export type { Organization, Tenant } from './organization-types';
// export type { ApiResponse, ApiError, PaginatedResponse } from './api-types';

export {}; 