import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Decorator for setting required permissions
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required, allow access
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      return false; // No user or permissions information
    }

    // Check if user has all required permissions
    return requiredPermissions.every(permission => {
      return user.permissions.includes(permission);
    });
  }
}

// Helper decorator to check for any of the permissions (OR logic)
export const RequireAnyPermissions = (...permissions: string[]) => SetMetadata('any_permissions', permissions);

@Injectable()
export class AnyPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('any_permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required, allow access
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      return false; // No user or permissions information
    }

    // Check if user has any of the required permissions (OR logic)
    return requiredPermissions.some(permission => {
      return user.permissions.includes(permission);
    });
  }
} 