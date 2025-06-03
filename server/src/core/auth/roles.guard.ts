import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';
import { RoleHierarchy } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required, allow access
    }
    
    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      return false; // No user or role information
    }
    
    // Check if user has any of the required roles based on hierarchy
    return requiredRoles.some(requiredRole => {
      return this.hasRequiredRole(user.role, requiredRole);
    });
  }
  
  /**
   * Check if user role has sufficient privileges for required role
   * Uses role hierarchy where higher-level roles can access lower-level resources
   */
  private hasRequiredRole(userRole: string, requiredRole: Role): boolean {
    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(requiredRole);
      
    // Higher or equal role level grants access
    return userLevel >= requiredLevel;
  }
  
  /**
   * Get role hierarchy level
   */
  private getRoleLevel(role: string): number {
    return RoleHierarchy[role as keyof typeof RoleHierarchy] || 0;
  }
} 