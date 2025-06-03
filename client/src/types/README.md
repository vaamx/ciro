# Types Directory

This directory contains TypeScript type definitions and interfaces that are shared across the application.

## Purpose

Centralized types provide:
- Consistent data structures across the application
- Type safety for API responses and requests
- Shared interfaces for component props
- Domain-specific type definitions
- Utility types for common patterns

## Type Categories

### API Types
- `api-types` - Generic API response/request types, pagination, errors
- `auth-types` - User, authentication, and authorization types
- `customer-types` - Customer management related types
- `billing-types` - Billing, invoice, and payment types
- `organization-types` - Organization and tenant types

### UI Types
- `component-types` - Common component prop interfaces
- `form-types` - Form validation and submission types
- `table-types` - Data table and grid types

### Utility Types
- `common-types` - Shared utility types and helpers
- `enum-types` - Application-wide enumerations

## Type Organization

```typescript
// Example API types
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Example domain types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  organizationId: string;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}
```

## Import Usage

```typescript
import type { User, UserRole, ApiResponse } from '@/types';
import type { Customer, CustomerStatus } from '@/types/customer-types';

// Usage in components
interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
}

// Usage in API services
async function getUsers(): Promise<ApiResponse<User[]>> {
  // API call implementation
}
```

## Type Guidelines

- Use `interface` for object shapes that might be extended
- Use `type` for unions, primitives, and computed types
- Export types with explicit `type` keyword for clarity
- Include JSDoc comments for complex types
- Group related types in the same file
- Use generic types for reusable patterns
- Follow consistent naming conventions (PascalCase) 