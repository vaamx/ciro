import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';
import { User } from '../database/prisma-types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    // In Prisma schema, role is a single string instead of array
    return user && requiredRoles.some(role => {
      // Check if user has ADMIN role which gives access to everything
      if (user.role === 'admin') return true;
      
      // Otherwise check for specific role
      return user.role === role;
    });
  }
} 