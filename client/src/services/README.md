# Services Directory

This directory contains API service modules that handle external service integrations and data fetching logic.

## Purpose

Services provide:
- Centralized API communication logic
- Consistent error handling patterns
- Type-safe API responses
- Request/response data transformation
- Authentication and authorization handling

## Service Organization

### Core Services
- `api-client` - Base HTTP client configuration with interceptors
- `auth-service` - Authentication and authorization API calls
- `storage-service` - Local storage and session management

### Feature Services
- `customer-service` - Customer management API calls
- `billing-service` - Billing and invoice API calls
- `admin-service` - Administrative API calls
- `meter-service` - Energy meter reading API calls

## Import Usage

```typescript
import { apiClient, authService, customerService } from '@/services';

// Usage in component or hook
async function fetchCustomers() {
  try {
    const response = await customerService.getCustomers();
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }
}
```

## Service Guidelines

- Use consistent naming patterns (service suffix)
- Include proper TypeScript types for requests/responses
- Handle errors gracefully with meaningful messages
- Use the base API client for consistent configuration
- Include request/response logging for debugging
- Implement retry logic for critical operations 