// Core guards
export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';
export { PermissionsGuard, AnyPermissionsGuard } from './permissions.guard';
export { TenantScopeGuard } from './tenant-scope.guard';

// Core decorators
export { Roles } from './roles.decorator';
export { RequirePermissions, RequireAnyPermissions } from './permissions.guard';

// Enums and types
export { Role } from './role.enum';
export { JwtPayload, PERMISSIONS, ROLE_PERMISSIONS, RoleHierarchy } from './jwt.strategy';

// Guard helper decorators
export {
  RequireAuth,
  RequireAuthAndPermissions,
  RequireAuthAndTenantScope,
  RequireFullAuth,
  RequireEnergyAdmin,
  RequireClientAdmin,
  RequireCustomerUser,
  RequireSystemAccess,
  RequireClientAccess,
  RequireCustomerAccess,
  RequireBillingAccess,
  RequireClientManagement,
  RequireCustomerManagement,
  RequireBillingManagement,
} from './guard-helpers';

// Tenant-specific decorators
export {
  TenantResource,
  TenantValidation,
  RequireOrganizationAccess,
  RequireClientAccess as RequireClientTenantAccess,
  RequireCustomerAccess as RequireCustomerTenantAccess,
  RequireReadOnlyAccess,
  RequireAdminAccess,
  RequireBillingAccess as RequireTenantBillingAccess,
  RequireMeterAccess,
  RequireTariffAccess,
  RequireCustomerPortalAccess,
  RequireSystemAdmin,
  TENANT_RESOURCE_KEY,
  TENANT_VALIDATION_KEY,
} from './tenant.decorators';

// Services
export { AuthService } from './auth.service';
export { JwtStrategy } from './jwt.strategy';

// DTOs (if needed in other modules)
export { LoginDto } from './dto/login.dto';
export { RegisterDto } from './dto/register.dto'; 