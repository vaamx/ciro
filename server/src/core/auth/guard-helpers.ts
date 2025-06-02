import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';
import { TenantScopeGuard } from './tenant-scope.guard';
import { Roles } from './roles.decorator';
import { RequirePermissions } from './permissions.guard';
import { Role } from './role.enum';
import { PERMISSIONS } from './jwt.strategy';

/**
 * Combines JWT authentication with role-based authorization
 */
export function RequireAuth(...roles: Role[]) {
  if (roles.length > 0) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, RolesGuard),
      Roles(...roles)
    );
  }
  return UseGuards(JwtAuthGuard);
}

/**
 * Combines JWT authentication with permission-based authorization
 */
export function RequireAuthAndPermissions(...permissions: string[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(...permissions)
  );
}

/**
 * Combines JWT authentication with tenant scope validation
 */
export function RequireAuthAndTenantScope(...roles: Role[]) {
  if (roles.length > 0) {
    return applyDecorators(
      UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard),
      Roles(...roles)
    );
  }
  return UseGuards(JwtAuthGuard, TenantScopeGuard);
}

/**
 * Full authorization stack: JWT + Roles + Permissions + Tenant Scope
 */
export function RequireFullAuth(roles: Role[], permissions: string[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, TenantScopeGuard),
    Roles(...roles),
    RequirePermissions(...permissions)
  );
}

// Common role combinations
export const RequireEnergyAdmin = () => RequireAuth(Role.ENERGY_ADMIN);
export const RequireClientAdmin = () => RequireAuth(Role.CLIENT_ADMIN, Role.ENERGY_ADMIN);
export const RequireCustomerUser = () => RequireAuth(Role.CUSTOMER_USER, Role.CLIENT_ADMIN, Role.ENERGY_ADMIN);

// Common permission combinations  
export const RequireSystemAccess = () => RequireAuthAndPermissions(PERMISSIONS.SYSTEM_ADMIN);
export const RequireClientAccess = () => RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ);
export const RequireCustomerAccess = () => RequireAuthAndPermissions(PERMISSIONS.CUSTOMER_READ);
export const RequireBillingAccess = () => RequireAuthAndPermissions(PERMISSIONS.BILLING_READ);

// Energy billing specific decorators
export const RequireClientManagement = () => RequireAuthAndPermissions(
  PERMISSIONS.CLIENT_ADMIN,
  PERMISSIONS.CLIENT_WRITE
);

export const RequireCustomerManagement = () => RequireAuthAndPermissions(
  PERMISSIONS.CUSTOMER_READ,
  PERMISSIONS.CUSTOMER_WRITE
);

export const RequireBillingManagement = () => RequireAuthAndPermissions(
  PERMISSIONS.BILLING_WRITE,
  PERMISSIONS.INVOICE_WRITE
); 