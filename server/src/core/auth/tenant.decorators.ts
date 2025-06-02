import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TenantScopeGuard } from './tenant-scope.guard';
import { Roles } from './roles.decorator';
import { Role } from './role.enum';

// Metadata keys for tenant validation
export const TENANT_RESOURCE_KEY = 'tenant_resource';
export const TENANT_VALIDATION_KEY = 'tenant_validation';

// Decorator to specify the tenant resource type being accessed
export const TenantResource = (resourceType: 'organization' | 'client' | 'customer') => 
  SetMetadata(TENANT_RESOURCE_KEY, resourceType);

// Decorator to specify custom tenant validation rules
export const TenantValidation = (rules: string[]) => 
  SetMetadata(TENANT_VALIDATION_KEY, rules);

/**
 * Require access to organization-level resources
 * Only ENERGY_ADMIN can access organization-level APIs
 */
export function RequireOrganizationAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.ENERGY_ADMIN),
    TenantResource('organization')
  );
}

/**
 * Require access to client-level resources
 * ENERGY_ADMIN and CLIENT_ADMIN can access client-level APIs
 */
export function RequireClientAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    TenantResource('client')
  );
}

/**
 * Require access to customer-level resources
 * All authenticated users can access customer-level APIs (with proper scope validation)
 */
export function RequireCustomerAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CUSTOMER_USER, Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    TenantResource('customer')
  );
}

/**
 * Require read-only access to tenant data
 */
export function RequireReadOnlyAccess(resourceType: 'organization' | 'client' | 'customer') {
  const roleMap = {
    organization: [Role.ENERGY_ADMIN],
    client: [Role.CLIENT_ADMIN, Role.ENERGY_ADMIN],
    customer: [Role.CUSTOMER_USER, Role.CLIENT_ADMIN, Role.ENERGY_ADMIN]
  };

  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(...roleMap[resourceType]),
    TenantResource(resourceType),
    TenantValidation(['read'])
  );
}

/**
 * Require admin-level access to tenant data
 */
export function RequireAdminAccess(resourceType: 'organization' | 'client' | 'customer') {
  const roleMap = {
    organization: [Role.ENERGY_ADMIN],
    client: [Role.CLIENT_ADMIN, Role.ENERGY_ADMIN],
    customer: [Role.CLIENT_ADMIN, Role.ENERGY_ADMIN]
  };

  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(...roleMap[resourceType]),
    TenantResource(resourceType),
    TenantValidation(['admin'])
  );
}

// Energy billing specific decorators

/**
 * Require access to billing and invoice management
 */
export function RequireBillingAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    TenantResource('client'),
    TenantValidation(['billing'])
  );
}

/**
 * Require access to meter reading management
 */
export function RequireMeterAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    TenantResource('client'),
    TenantValidation(['meter'])
  );
}

/**
 * Require access to tariff rate management
 */
export function RequireTariffAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN),
    TenantResource('client'),
    TenantValidation(['tariff'])
  );
}

/**
 * Customer portal access - for customers to view their own data
 */
export function RequireCustomerPortalAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
    Roles(Role.CUSTOMER_USER),
    TenantResource('customer'),
    TenantValidation(['portal', 'self-service'])
  );
}

/**
 * System admin only - for system-wide operations
 */
export function RequireSystemAdmin() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.ENERGY_ADMIN),
    TenantValidation(['system'])
  );
} 