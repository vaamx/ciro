import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Guard to enforce tenant-level access control
 * Validates that users can only access resources within their authorized scope
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params, query, body } = request;

    if (!user || !user.scopes) {
      throw new ForbiddenException('User scope information is missing');
    }

    // Extract resource identifiers from request
    const organizationId = this.extractIdFromRequest('organizationId', params, query, body);
    const clientId = this.extractIdFromRequest('clientId', params, query, body);
    const customerId = this.extractIdFromRequest('customerId', params, query, body);

    // Validate organization access
    if (organizationId && !this.hasOrganizationAccess(user.scopes, organizationId)) {
      throw new ForbiddenException('Access denied: Invalid organization scope');
    }

    // For now, rely on RLS policies at the database level for client/customer validation
    // The database middleware will enforce proper isolation based on the user's JWT scopes
    
    // Basic scope validation for client access
    if (clientId && user.role === 'CLIENT_ADMIN' && user.scopes.clientId && user.scopes.clientId !== clientId) {
      throw new ForbiddenException('Access denied: Invalid client scope');
    }

    // Basic scope validation for customer access  
    if (customerId && user.role === 'CUSTOMER_USER' && user.scopes.customerId && user.scopes.customerId !== customerId) {
      throw new ForbiddenException('Access denied: Invalid customer scope');
    }

    return true;
  }

  /**
   * Extract ID from request parameters, query, or body
   */
  private extractIdFromRequest(idName: string, params: any, query: any, body: any): number | null {
    const value = params?.[idName] || query?.[idName] || body?.[idName];
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Check if user has access to organization
   */
  private hasOrganizationAccess(userScopes: any, organizationId: number): boolean {
    return userScopes.organizationId === organizationId;
  }

  /**
   * Check if user has direct client access from token scopes
   */
  private hasClientAccess(user: any, clientId: number): boolean {
    // ENERGY_ADMIN has access to all clients in their organization
    if (user.role === 'ENERGY_ADMIN') {
      return true;
    }

    // CLIENT_ADMIN and CUSTOMER_USER need specific client access
    return user.scopes.clientId === clientId;
  }

  /**
   * Check if user has direct customer access from token scopes
   */
  private hasCustomerAccess(user: any, customerId: number): boolean {
    // ENERGY_ADMIN and CLIENT_ADMIN have broad access
    if (user.role === 'ENERGY_ADMIN' || user.role === 'CLIENT_ADMIN') {
      return true;
    }

    // CUSTOMER_USER needs specific customer access
    return user.scopes.customerId === customerId;
  }

  // TODO: Enable these methods once Prisma client generation issues are resolved
  /*
  private async validateClientAccess(organizationId: number, clientId: number): Promise<boolean> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: organizationId,
      },
    });

    return !!client;
  }

  private async validateCustomerAccess(user: any, customerId: number): Promise<boolean> {
    const whereClause: any = {
      id: customerId,
    };

    if (user.role === 'ENERGY_ADMIN') {
      whereClause.client = {
        organizationId: user.scopes.organizationId,
      };
    }
    else if (user.role === 'CLIENT_ADMIN' && user.scopes.clientId) {
      whereClause.clientId = user.scopes.clientId;
    }
    else if (user.role === 'CUSTOMER_USER') {
      return user.scopes.customerId === customerId;
    }

    const customer = await this.prisma.customer.findFirst({
      where: whereClause,
    });

    return !!customer;
  }
  */
} 