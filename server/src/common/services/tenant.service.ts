import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { getCurrentTenantContext, getCurrentOrganizationId, getCurrentUserId, isCurrentUserAdmin } from '../middleware/tenant-context.middleware';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the current tenant context or throw an error if not available
   */
  getCurrentContext() {
    const context = getCurrentTenantContext();
    if (!context || !context.organizationId) {
      throw new UnauthorizedException('No tenant context available');
    }
    return context;
  }

  /**
   * Get current organization ID or throw an error
   */
  getOrganizationId(): number {
    const orgId = getCurrentOrganizationId();
    if (!orgId) {
      throw new UnauthorizedException('No organization context available');
    }
    return orgId;
  }

  /**
   * Get current user ID or throw an error
   */
  getUserId(): number {
    const userId = getCurrentUserId();
    if (!userId) {
      throw new UnauthorizedException('No user context available');
    }
    return userId;
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    return isCurrentUserAdmin();
  }

  /**
   * Require admin privileges or throw an error
   */
  requireAdmin() {
    if (!this.isAdmin()) {
      throw new ForbiddenException('Admin privileges required');
    }
  }

  /**
   * Execute a query within a specific tenant context
   * Useful for system operations or multi-tenant admin functions
   */
  async executeInTenantContext<T>(
    operation: () => Promise<T>,
    organizationId: number,
    userId?: number
  ): Promise<T> {
    return this.prisma.executeWithTenantContext(operation, organizationId, userId);
  }

  /**
   * Execute a system-level query that bypasses tenant isolation
   * Use with extreme caution - only for system operations
   */
  async executeAsSystem<T>(operation: () => Promise<T>): Promise<T> {
    // Require admin privileges for system operations
    this.requireAdmin();
    return this.prisma.executeAsSystem(operation);
  }

  /**
   * Get all clients for the current organization
   */
  async getOrganizationClients() {
    const orgId = this.getOrganizationId();
    
    return this.prisma.client.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        organization: true,
        customers: {
          select: {
            id: true,
            name: true,
            accountNumber: true,
            status: true,
          },
        },
        tariffRates: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Get customers for a specific client within the current organization
   */
  async getClientCustomers(clientId: number) {
    const orgId = this.getOrganizationId();
    
    // First verify the client belongs to the current organization
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: orgId,
      },
    });

    if (!client) {
      throw new ForbiddenException('Client not found or access denied');
    }

    return this.prisma.customer.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
        meterReadings: {
          select: {
            id: true,
            readingDate: true,
            consumptionKwh: true,
            demandKw: true,
          },
          orderBy: {
            readingDate: 'desc',
          },
          take: 5, // Get last 5 readings
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            status: true,
          },
          orderBy: {
            invoiceDate: 'desc',
          },
          take: 5, // Get last 5 invoices
        },
      },
    });
  }

  /**
   * Validate that a resource belongs to the current tenant
   */
  async validateResourceAccess(resourceType: string, resourceId: number): Promise<boolean> {
    const orgId = this.getOrganizationId();
    
    switch (resourceType) {
      case 'client':
        const client = await this.prisma.client.findFirst({
          where: { id: resourceId, organizationId: orgId },
        });
        return !!client;
        
      case 'customer':
        const customer = await this.prisma.customer.findFirst({
          where: {
            id: resourceId,
            client: {
              organizationId: orgId,
            },
          },
        });
        return !!customer;
        
      case 'invoice':
        const invoice = await this.prisma.invoice.findFirst({
          where: {
            id: resourceId,
            client: {
              organizationId: orgId,
            },
          },
        });
        return !!invoice;
        
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Get organization statistics for the current tenant
   */
  async getOrganizationStats() {
    const orgId = this.getOrganizationId();
    
    const [clientCount, customerCount, invoiceCount, totalRevenue] = await Promise.all([
      this.prisma.client.count({
        where: { organizationId: orgId },
      }),
      this.prisma.customer.count({
        where: {
          client: {
            organizationId: orgId,
          },
        },
      }),
      this.prisma.invoice.count({
        where: {
          client: {
            organizationId: orgId,
          },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          client: {
            organizationId: orgId,
          },
          status: 'PAID',
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      clientCount,
      customerCount,
      invoiceCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    };
  }
} 