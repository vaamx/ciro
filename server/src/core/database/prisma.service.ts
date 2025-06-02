import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getCurrentTenantContext } from '../../common/middleware/tenant-context.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    console.log('>>> PRISMA_SERVICE: Constructor starting...');
    super(); // Call the PrismaClient constructor
    console.log('>>> PRISMA_SERVICE: Constructor finished (super called).');
    
    // Add middleware to set tenant context for RLS
    this.setupTenantMiddleware();
  }

  async onModuleInit() {
    console.log('>>> PRISMA_SERVICE: Entering onModuleInit...');
    // Connect to the database when the module is initialized.
    console.log('>>> PRISMA_SERVICE: Attempting this.$connect()...');
    try {
      await this.$connect();
      console.log('>>> PRISMA_SERVICE: Database connection successful.');
    } catch (error) {
      console.error('>>> PRISMA_SERVICE: Failed to connect to the database.', error);
      // Optional: re-throw or exit if connection is critical
      // throw error; 
      // process.exit(1);
    }
  }

  async onModuleDestroy() {
    // Disconnect from the database when the application shuts down.
    await this.$disconnect();
  }

  /**
   * Setup Prisma middleware to automatically set tenant context for RLS
   */
  private setupTenantMiddleware() {
    this.$use(async (params, next) => {
      // Get current tenant context from AsyncLocalStorage
      const tenantContext = getCurrentTenantContext();
      
      if (tenantContext) {
        try {
          // Set PostgreSQL session variables for RLS policies
          const setContextQueries = [];
          
          if (tenantContext.organizationId !== null) {
            setContextQueries.push(
              this.$executeRaw`SELECT set_config('app.current_organization_id', ${tenantContext.organizationId.toString()}, false)`
            );
          }
          
          if (tenantContext.userId !== null) {
            setContextQueries.push(
              this.$executeRaw`SELECT set_config('app.current_user_id', ${tenantContext.userId.toString()}, false)`
            );
          }
          
          // Execute all context-setting queries
          if (setContextQueries.length > 0) {
            await Promise.all(setContextQueries);
          }
          
          console.log(`>>> PRISMA_MIDDLEWARE: Set tenant context - orgId: ${tenantContext.organizationId}, userId: ${tenantContext.userId}`);
        } catch (error) {
          console.error('>>> PRISMA_MIDDLEWARE: Error setting tenant context:', error);
          // Continue with the query even if context setting fails
          // This ensures the application doesn't break, but RLS may deny access
        }
      } else {
        console.log('>>> PRISMA_MIDDLEWARE: No tenant context available - RLS will use default (deny) policy');
      }

      // Continue with the original query
      return next(params);
    });

    console.log('>>> PRISMA_SERVICE: Tenant middleware setup complete');
  }

  /**
   * Execute a query with explicit tenant context
   * Useful for system operations that need to bypass normal tenant isolation
   */
  async executeWithTenantContext<T>(
    operation: () => Promise<T>,
    organizationId: number,
    userId?: number
  ): Promise<T> {
    try {
      // Set context
      const setContextQueries = [
        this.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId.toString()}, false)`
      ];
      
      if (userId !== undefined) {
        setContextQueries.push(
          this.$executeRaw`SELECT set_config('app.current_user_id', ${userId.toString()}, false)`
        );
      }
      
      await Promise.all(setContextQueries);
      
      // Execute the operation
      const result = await operation();
      
      return result;
    } catch (error) {
      console.error('>>> PRISMA_SERVICE: Error in executeWithTenantContext:', error);
      throw error;
    }
  }

  /**
   * Execute a query without tenant isolation (system-level operations)
   * Use with extreme caution - only for system operations
   */
  async executeAsSystem<T>(operation: () => Promise<T>): Promise<T> {
    try {
      // Clear context to bypass RLS (use with caution)
      await this.$executeRaw`SELECT set_config('app.current_organization_id', '', false)`;
      await this.$executeRaw`SELECT set_config('app.current_user_id', '', false)`;
      
      console.log('>>> PRISMA_SERVICE: Executing system-level operation (RLS bypassed)');
      
      // Execute the operation
      const result = await operation();
      
      return result;
    } catch (error) {
      console.error('>>> PRISMA_SERVICE: Error in executeAsSystem:', error);
      throw error;
    }
  }

  // Optional: Add graceful shutdown hook for NestJS app
  // See: https://docs.nestjs.com/recipes/prisma#issues-with-enableshutdownhooks
  // async enableShutdownHooks(app: INestApplication) {
  //   process.on('beforeExit', async () => {
  //     await app.close();
  //   });
  // }
} 