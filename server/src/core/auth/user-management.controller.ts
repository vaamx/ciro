import { Controller, Get, Post, Put, Body, Param, ParseIntPipe, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { 
  RequireEnergyAdmin, 
  RequireAuthAndPermissions, 
  RequireSystemAccess,
  RequireAuth 
} from './guard-helpers';
import { PERMISSIONS } from './jwt.strategy';

@Controller('api/users')
@UseGuards(AuthGuard('jwt'))
export class UserManagementController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get current user profile - Available to all authenticated users
   */
  @Get('profile')
  @RequireAuth()
  async getCurrentUserProfile(@Req() req: any) {
    return this.authService.getCurrentUser(req.user.id);
  }

  /**
   * List all users - Only ENERGY_ADMIN
   */
  @Get()
  @RequireEnergyAdmin()
  async getUsers(@Req() req: any, @Query('role') roleFilter?: string) {
    return this.authService.getUsers(req.user.id, roleFilter as any);
  }

  /**
   * Update user role - Only ENERGY_ADMIN with system admin permission
   */
  @Put(':userId/role')
  @RequireSystemAccess()
  async updateUserRole(
    @Req() req: any,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Body('role') newRole: string
  ) {
    return this.authService.updateUserRole(req.user.id, targetUserId, newRole as any);
  }

  /**
   * Assign user to organization - Only ENERGY_ADMIN
   */
  @Post(':userId/organizations/:organizationId')
  @RequireEnergyAdmin()
  async assignUserToOrganization(
    @Req() req: any,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() roleContext?: { clientId?: number; customerId?: number }
  ) {
    return this.authService.assignUserToOrganization(
      req.user.id, 
      targetUserId, 
      organizationId, 
      roleContext
    );
  }

  /**
   * Get users with organization access - Permission-based access
   */
  @Get('organization-members')
  @RequireAuthAndPermissions(PERMISSIONS.ORG_READ)
  async getOrganizationMembers(@Req() req: any) {
    // This endpoint demonstrates permission-based access control
    // Users with ORG_READ permission can access this regardless of their specific role
    const userRole = req.user.role;
    const hasPermission = req.user.permissions.includes(PERMISSIONS.ORG_READ);
    
    return {
      message: 'Access granted based on permission',
      userRole,
      hasPermission,
      permissions: req.user.permissions,
      scopes: req.user.scopes,
    };
  }

  /**
   * Demonstration endpoint for role hierarchy
   */
  @Get('role-hierarchy-demo')
  @RequireAuth() // Any authenticated user
  async roleHierarchyDemo(@Req() req: any) {
    return {
      message: 'Role hierarchy demonstration',
      userRole: req.user.role,
      accessGranted: true,
      explanation: 'This endpoint demonstrates how RBAC system works with user data',
    };
  }

  /**
   * Demonstration endpoint for multiple permission checking
   */
  @Get('multi-permission-demo')
  @RequireAuthAndPermissions(PERMISSIONS.CLIENT_READ, PERMISSIONS.CUSTOMER_READ)
  async multiPermissionDemo(@Req() req: any) {
    return {
      message: 'Multiple permission check successful',
      requiredPermissions: [PERMISSIONS.CLIENT_READ, PERMISSIONS.CUSTOMER_READ],
      userPermissions: req.user.permissions,
      accessGranted: true,
    };
  }
} 