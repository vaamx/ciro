# Authentication Decorators Guide

This guide provides comprehensive documentation for the role-based access control (RBAC) decorators implemented in the energy billing system.

## Overview

The authentication system supports a three-tier hierarchy:
- **ENERGY_ADMIN**: Full system access across all organizations
- **CLIENT_ADMIN**: Client-level access within their organization  
- **CUSTOMER_USER**: Customer-level access within their assigned client

## Basic Authentication Decorators

### 1. Core Guards

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// Basic JWT authentication
@UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@Request() req) {
  return req.user;
}
```

### 2. Role-Based Authorization

```typescript
import { RequireAuth } from './guard-helpers';
import { Role } from './role.enum';

// Single role requirement
@RequireAuth(Role.ENERGY_ADMIN)
@Get('admin-only')
async adminEndpoint() {
  return { message: 'Admin access granted' };
}

// Multiple roles (any of these roles)
@RequireAuth(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN)
@Get('client-or-admin')
async clientOrAdminEndpoint() {
  return { message: 'Client admin or above access' };
}
```

### 3. Permission-Based Authorization

```typescript
import { RequireAuthAndPermissions } from './guard-helpers';
import { PERMISSIONS } from './jwt.strategy';

// Single permission requirement
@RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ)
@Get('clients')
async getClients() {
  return { clients: [] };
}

// Multiple permissions (all required)
@RequireAuthAndPermissions(PERMISSIONS.BILLING_READ, PERMISSIONS.INVOICE_READ)
@Get('billing-data')
async getBillingData() {
  return { billingData: [] };
}
```

## Convenience Decorators

### 1. Role-Specific Shortcuts

```typescript
import { RequireEnergyAdmin, RequireClientAdmin, RequireCustomerUser } from './guard-helpers';

// Energy admin only
@RequireEnergyAdmin()
@Post('organizations')
async createOrganization() {
  return { message: 'Organization created' };
}

// Client admin or above
@RequireClientAdmin()
@Post('clients')
async createClient() {
  return { message: 'Client created' };
}

// Any authenticated user with proper hierarchy
@RequireCustomerUser()
@Get('customers')
async getCustomers() {
  return { customers: [] };
}
```

### 2. Permission-Specific Shortcuts

```typescript
import { 
  RequireSystemAccess, 
  RequireClientAccess, 
  RequireCustomerAccess,
  RequireBillingAccess 
} from './guard-helpers';

@RequireSystemAccess()
@Get('system-stats')
async getSystemStats() {
  return { stats: {} };
}

@RequireBillingAccess()
@Get('billing-reports')
async getBillingReports() {
  return { reports: [] };
}
```

## Tenant-Specific Decorators

### 1. Resource-Level Access

```typescript
import { 
  RequireOrganizationAccess,
  RequireClientAccess,
  RequireCustomerAccess 
} from './tenant.decorators';

// Organization-level resources (ENERGY_ADMIN only)
@RequireOrganizationAccess()
@Get('organizations/:organizationId')
async getOrganization(@Param('organizationId') id: string) {
  return { organization: {} };
}

// Client-level resources (CLIENT_ADMIN and above)
@RequireClientAccess()
@Get('clients/:clientId')
async getClient(@Param('clientId') id: string) {
  return { client: {} };
}

// Customer-level resources (CUSTOMER_USER and above)
@RequireCustomerAccess()
@Get('customers/:customerId')
async getCustomer(@Param('customerId') id: string) {
  return { customer: {} };
}
```

### 2. Read/Write Access Patterns

```typescript
import { RequireReadOnlyAccess, RequireAdminAccess } from './tenant.decorators';

// Read-only access to client data
@RequireReadOnlyAccess('client')
@Get('clients/:clientId/summary')
async getClientSummary(@Param('clientId') id: string) {
  return { summary: {} };
}

// Admin access required for modifications
@RequireAdminAccess('client')
@Put('clients/:clientId')
async updateClient(@Param('clientId') id: string, @Body() data: any) {
  return { updated: true };
}
```

## Energy Billing Specific Decorators

### 1. Billing Management

```typescript
import { 
  RequireBillingAccess,
  RequireMeterAccess,
  RequireTariffAccess 
} from './tenant.decorators';

@RequireBillingAccess()
@Post('invoices')
async createInvoice(@Body() invoiceData: any) {
  return { invoice: {} };
}

@RequireMeterAccess()
@Post('meter-readings')
async addMeterReading(@Body() reading: any) {
  return { reading: {} };
}

@RequireTariffAccess()
@Put('tariff-rates/:tariffId')
async updateTariffRate(@Param('tariffId') id: string, @Body() data: any) {
  return { updated: true };
}
```

### 2. Customer Portal

```typescript
import { RequireCustomerPortalAccess } from './tenant.decorators';

// Customer self-service portal
@RequireCustomerPortalAccess()
@Get('my-account')
async getMyAccount(@Request() req) {
  return { account: req.user };
}

@RequireCustomerPortalAccess()
@Get('my-bills')
async getMyBills(@Request() req) {
  return { bills: [] };
}
```

## Advanced Patterns

### 1. Combined Guards

```typescript
import { RequireFullAuth } from './guard-helpers';
import { Role } from './role.enum';
import { PERMISSIONS } from './jwt.strategy';

// Complete authorization stack
@RequireFullAuth(
  [Role.CLIENT_ADMIN, Role.ENERGY_ADMIN], 
  [PERMISSIONS.BILLING_WRITE, PERMISSIONS.INVOICE_WRITE]
)
@Post('complex-billing-operation')
async complexOperation() {
  return { success: true };
}
```

### 2. Custom Combinations

```typescript
import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';
import { TenantScopeGuard } from './tenant-scope.guard';

// Custom decorator for specific business logic
export function RequireSpecialAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, TenantScopeGuard),
    Roles(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    RequirePermissions(PERMISSIONS.BILLING_ADMIN, PERMISSIONS.CLIENT_ADMIN),
    TenantResource('client'),
    TenantValidation(['special', 'billing'])
  );
}

@RequireSpecialAccess()
@Post('special-operation')
async specialOperation() {
  return { special: true };
}
```

## User Context Access

```typescript
import { Request } from 'express';

@RequireAuth(Role.CLIENT_ADMIN)
@Get('my-clients')
async getMyClients(@Request() req) {
  const user = req.user;
  
  // Access user information
  console.log('User ID:', user.id);
  console.log('User Role:', user.role);
  console.log('User Permissions:', user.permissions);
  console.log('User Scopes:', user.scopes);
  
  // Organization context
  const organizationId = user.scopes.organizationId;
  
  // Client context (if available)
  const clientId = user.scopes.clientId;
  
  // Customer context (if available)  
  const customerId = user.scopes.customerId;
  
  return { user, organizationId, clientId, customerId };
}
```

## Error Handling

The guards will throw appropriate HTTP exceptions:

- **401 Unauthorized**: Invalid or missing JWT token
- **403 Forbidden**: Insufficient role/permission/scope access
- **400 Bad Request**: Invalid request parameters

```typescript
import { ForbiddenException } from '@nestjs/common';

@RequireAuth(Role.ENERGY_ADMIN)
@Get('sensitive-data')
async getSensitiveData() {
  // This will throw 403 if user is not ENERGY_ADMIN
  return { sensitive: true };
}
```

## Testing Considerations

When writing tests, mock the user object with proper structure:

```typescript
const mockUser = {
  id: 1,
  email: 'test@example.com',
  role: 'CLIENT_ADMIN',
  permissions: ['client:read', 'client:write', 'customer:read'],
  scopes: {
    organizationId: 1,
    clientId: 5,
  },
  legacy: false
};
```

## Best Practices

1. **Use the most specific decorator** for your use case
2. **Combine decorators** when you need multiple validation layers
3. **Document decorator usage** in your API documentation
4. **Test authorization thoroughly** with different user roles
5. **Use tenant-specific decorators** for multi-tenant resources
6. **Leverage permission-based decorators** for fine-grained control
7. **Handle errors gracefully** in your exception filters 