import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

// Define the tenant context interface
export interface TenantContext {
  organizationId: number | null;
  userId: number | null;
  userRole: string | null;
}

// Create a global async local storage for tenant context
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Middleware to extract and store tenant context from authenticated requests
 * This context is used by Prisma middleware to set RLS session variables
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant context from authenticated user
    const tenantContext = this.extractTenantContext(req);
    
    // Store context in async local storage for the duration of this request
    tenantContextStorage.run(tenantContext, () => {
      next();
    });
  }

  /**
   * Extract tenant context from the request
   * This should be called after authentication middleware has run
   */
  private extractTenantContext(req: Request): TenantContext {
    const user = (req as any).user; // Populated by authentication middleware
    
    if (!user) {
      // No authenticated user - return empty context
      return {
        organizationId: null,
        userId: null,
        userRole: null,
      };
    }

    // Extract organization ID from user's organization memberships
    // For now, we'll use the first organization the user belongs to
    // In a more complex scenario, this could be determined by:
    // - A header indicating which organization context to use
    // - Subdomain-based routing
    // - Path-based routing (/org/{orgId}/...)
    let organizationId: number | null = null;
    
    if (user.organizations && user.organizations.length > 0) {
      // Use the first organization for now
      // TODO: Implement organization switching logic
      organizationId = user.organizations[0].organizationId || user.organizations[0].organization?.id;
    }

    return {
      organizationId,
      userId: user.id,
      userRole: user.role,
    };
  }
}

/**
 * Utility function to get current tenant context
 * Can be used in services that need to access tenant information
 */
export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Utility function to check if user has admin privileges
 */
export function isCurrentUserAdmin(): boolean {
  const context = getCurrentTenantContext();
  return context?.userRole === 'ADMIN' || context?.userRole === 'ENERGY_ADMIN';
}

/**
 * Utility function to get current organization ID
 */
export function getCurrentOrganizationId(): number | null {
  const context = getCurrentTenantContext();
  return context?.organizationId || null;
}

/**
 * Utility function to get current user ID  
 */
export function getCurrentUserId(): number | null {
  const context = getCurrentTenantContext();
  return context?.userId || null;
} 