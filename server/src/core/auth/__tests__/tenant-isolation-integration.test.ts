import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { TenantService } from '../../../common/services/tenant.service';
import { Pool } from 'pg';
import { config } from '../../../config';

describe('Tenant Isolation Integration Tests', () => {
  let module: TestingModule;
  let prismaService: PrismaService;
  let tenantService: TenantService;
  let pool: Pool;

  // Test data IDs for cleanup
  const testOrganizationIds: number[] = [];
  const testUserIds: number[] = [];
  const testClientIds: number[] = [];
  const testCustomerIds: number[] = [];

  beforeAll(async () => {
    // Create test module
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        TenantService,
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
    tenantService = module.get<TenantService>(TenantService);

    // Create a separate pool for direct SQL testing
    pool = new Pool({
      ...config.database,
      database: process.env.NODE_ENV === 'test' ? `${config.database.database}_test` : config.database.database,
    });

    await prismaService.onModuleInit();
  });

  afterAll(async () => {
    // Cleanup test data in reverse order (respecting foreign keys)
    try {
      // Use system-level operations to bypass RLS for cleanup
      await prismaService.executeAsSystem(async () => {
        if (testCustomerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: { id: { in: testCustomerIds } }
          });
        }

        if (testClientIds.length > 0) {
          await prismaService.client.deleteMany({
            where: { id: { in: testClientIds } }
          });
        }

        if (testUserIds.length > 0) {
          await prismaService.organization_members.deleteMany({
            where: { user_id: { in: testUserIds } }
          });
          await prismaService.users.deleteMany({
            where: { id: { in: testUserIds } }
          });
        }

        if (testOrganizationIds.length > 0) {
          await prismaService.organizations.deleteMany({
            where: { id: { in: testOrganizationIds } }
          });
        }
      });
    } catch (error) {
      console.warn('Cleanup error (may be expected):', error);
    }

    await pool.end();
    await prismaService.onModuleDestroy();
    await module.close();
  });

  describe('Database-Level RLS Policy Testing', () => {
    let org1Id: number, org2Id: number;
    let user1Id: number, user2Id: number, user3Id: number;
    let client1Id: number, client2Id: number, client3Id: number;
    let customer1Id: number, customer2Id: number, customer3Id: number, customer4Id: number;

    beforeAll(async () => {
      // Create test data using system-level operations to bypass RLS
      await prismaService.executeAsSystem(async () => {
        // Create test organizations
        const org1 = await prismaService.organizations.create({
          data: { name: 'Test Energy Corp A' }
        });
        const org2 = await prismaService.organizations.create({
          data: { name: 'Test Energy Corp B' }
        });
        org1Id = org1.id;
        org2Id = org2.id;
        testOrganizationIds.push(org1Id, org2Id);

        // Create test users
        const user1 = await prismaService.users.create({
          data: {
            email: 'user1@testorga.com',
            password_hash: 'test_hash',
            role: 'CLIENT_ADMIN'
          }
        });
        const user2 = await prismaService.users.create({
          data: {
            email: 'user2@testorga.com',
            password_hash: 'test_hash',
            role: 'CLIENT_ADMIN'
          }
        });
        const user3 = await prismaService.users.create({
          data: {
            email: 'user3@testorgb.com',
            password_hash: 'test_hash',
            role: 'CLIENT_ADMIN'
          }
        });
        user1Id = user1.id;
        user2Id = user2.id;
        user3Id = user3.id;
        testUserIds.push(user1Id, user2Id, user3Id);

        // Create organization memberships
        await prismaService.organization_members.createMany({
          data: [
            { user_id: user1Id, organization_id: org1Id },
            { user_id: user2Id, organization_id: org1Id },
            { user_id: user3Id, organization_id: org2Id },
          ]
        });

        // Create test clients
        const client1 = await prismaService.client.create({
          data: {
            name: 'Test Client A1',
            code: 'TCA1',
            organizationId: org1Id
          }
        });
        const client2 = await prismaService.client.create({
          data: {
            name: 'Test Client A2',
            code: 'TCA2',
            organizationId: org1Id
          }
        });
        const client3 = await prismaService.client.create({
          data: {
            name: 'Test Client B1',
            code: 'TCB1',
            organizationId: org2Id
          }
        });
        client1Id = client1.id;
        client2Id = client2.id;
        client3Id = client3.id;
        testClientIds.push(client1Id, client2Id, client3Id);

        // Create test customers
        const customer1 = await prismaService.customer.create({
          data: {
            name: 'Test Customer A1-1',
            customerNumber: 'TC-A1-001',
            email: 'customer1@testclienta1.com',
            clientId: client1Id
          }
        });
        const customer2 = await prismaService.customer.create({
          data: {
            name: 'Test Customer A1-2',
            customerNumber: 'TC-A1-002',
            email: 'customer2@testclienta1.com',
            clientId: client1Id
          }
        });
        const customer3 = await prismaService.customer.create({
          data: {
            name: 'Test Customer A2-1',
            customerNumber: 'TC-A2-001',
            email: 'customer3@testclienta2.com',
            clientId: client2Id
          }
        });
        const customer4 = await prismaService.customer.create({
          data: {
            name: 'Test Customer B1-1',
            customerNumber: 'TC-B1-001',
            email: 'customer4@testclientb1.com',
            clientId: client3Id
          }
        });
        customer1Id = customer1.id;
        customer2Id = customer2.id;
        customer3Id = customer3.id;
        customer4Id = customer4.id;
        testCustomerIds.push(customer1Id, customer2Id, customer3Id, customer4Id);
      });
    });

    describe('RLS Helper Functions', () => {
      it('should properly set and get organization context', async () => {
        // Test setting organization context
        await tenantService.setOrganizationContext(org1Id);
        
        // Verify context is set correctly
        const result = await pool.query('SELECT get_current_organization_id() as org_id');
        expect(result.rows[0].org_id).toBe(org1Id);
      });

      it('should properly set and get user context', async () => {
        // Test setting user context
        await tenantService.setUserContext(user1Id);
        
        // Verify context is set correctly
        const result = await pool.query('SELECT get_current_user_id() as user_id');
        expect(result.rows[0].user_id).toBe(user1Id);
      });

      it('should test RLS isolation function', async () => {
        // Test the built-in RLS test function
        const result = await pool.query('SELECT * FROM test_rls_isolation($1)', [org1Id]);
        
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
        
        // All tests should pass (show proper isolation)
        result.rows.forEach(row => {
          expect(row.isolation_test_result).toContain('PASS');
        });
      });
    });

    describe('Organization Level RLS Isolation', () => {
      it('should only show own organization when context is set', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Query should only return organization 1
        const orgs = await prismaService.organizations.findMany();
        
        expect(orgs).toHaveLength(1);
        expect(orgs[0].id).toBe(org1Id);
        expect(orgs[0].name).toBe('Test Energy Corp A');
      });

      it('should prevent access to other organizations', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Try to access organization 2 directly
        const org2 = await prismaService.organizations.findUnique({
          where: { id: org2Id }
        });
        
        expect(org2).toBeNull();
      });

      it('should switch context properly', async () => {
        // Set organization 2 context
        await tenantService.setOrganizationContext(org2Id);
        
        // Query should now only return organization 2
        const orgs = await prismaService.organizations.findMany();
        
        expect(orgs).toHaveLength(1);
        expect(orgs[0].id).toBe(org2Id);
        expect(orgs[0].name).toBe('Test Energy Corp B');
      });
    });

    describe('Client Level RLS Isolation', () => {
      it('should only show clients from current organization', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        const clients = await prismaService.client.findMany();
        
        expect(clients).toHaveLength(2);
        expect(clients.every(c => c.organizationId === org1Id)).toBe(true);
        expect(clients.map(c => c.code).sort()).toEqual(['TCA1', 'TCA2']);
      });

      it('should prevent access to clients from other organizations', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Try to access client from organization 2
        const client3 = await prismaService.client.findUnique({
          where: { id: client3Id }
        });
        
        expect(client3).toBeNull();
      });

      it('should show different clients when switching organization context', async () => {
        // Set organization 2 context
        await tenantService.setOrganizationContext(org2Id);
        
        const clients = await prismaService.client.findMany();
        
        expect(clients).toHaveLength(1);
        expect(clients[0].id).toBe(client3Id);
        expect(clients[0].organizationId).toBe(org2Id);
        expect(clients[0].code).toBe('TCB1');
      });
    });

    describe('Customer Level RLS Isolation', () => {
      it('should only show customers from current organizations clients', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        const customers = await prismaService.customer.findMany({
          include: { client: true }
        });
        
        expect(customers).toHaveLength(3); // 2 from client1, 1 from client2
        expect(customers.every(c => c.client.organizationId === org1Id)).toBe(true);
        
        // Check distribution
        const client1Customers = customers.filter(c => c.clientId === client1Id);
        const client2Customers = customers.filter(c => c.clientId === client2Id);
        
        expect(client1Customers).toHaveLength(2);
        expect(client2Customers).toHaveLength(1);
      });

      it('should prevent access to customers from other organizations', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Try to access customer from organization 2
        const customer4 = await prismaService.customer.findUnique({
          where: { id: customer4Id }
        });
        
        expect(customer4).toBeNull();
      });

      it('should isolate customers when switching organization context', async () => {
        // Set organization 2 context
        await tenantService.setOrganizationContext(org2Id);
        
        const customers = await prismaService.customer.findMany({
          include: { client: true }
        });
        
        expect(customers).toHaveLength(1);
        expect(customers[0].id).toBe(customer4Id);
        expect(customers[0].client.organizationId).toBe(org2Id);
      });
    });

    describe('Cross-Table RLS Verification', () => {
      it('should enforce cascading isolation through joins', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Query customers with their clients
        const customersWithClients = await prismaService.customer.findMany({
          include: {
            client: {
              include: {
                organization: true
              }
            }
          }
        });
        
        expect(customersWithClients).toHaveLength(3);
        customersWithClients.forEach(customer => {
          expect(customer.client.organization.id).toBe(org1Id);
          expect(customer.client.organizationId).toBe(org1Id);
        });
      });

      it('should prevent data leakage through complex queries', async () => {
        // Set organization 1 context
        await tenantService.setOrganizationContext(org1Id);
        
        // Try a complex query that might bypass simple RLS
        const result = await pool.query(`
          SELECT c.id, c.name, cl.name as client_name, org.name as org_name
          FROM customers c
          JOIN clients cl ON c."clientId" = cl.id
          JOIN organizations org ON cl."organizationId" = org.id
        `);
        
        // Should only see data from organization 1
        expect(result.rows).toHaveLength(3);
        result.rows.forEach(row => {
          expect(row.org_name).toBe('Test Energy Corp A');
        });
      });
    });

    describe('RLS Edge Cases and Security Tests', () => {
      it('should deny access when no organization context is set', async () => {
        // Clear organization context
        await pool.query("SELECT set_config('app.current_organization_id', '', false)");
        
        // Queries should return no results or be denied
        const orgs = await prismaService.organizations.findMany();
        const clients = await prismaService.client.findMany();
        const customers = await prismaService.customer.findMany();
        
        expect(orgs).toHaveLength(0);
        expect(clients).toHaveLength(0);
        expect(customers).toHaveLength(0);
      });

      it('should handle invalid organization context gracefully', async () => {
        // Set invalid organization context
        await pool.query("SELECT set_config('app.current_organization_id', '99999', false)");
        
        // Queries should return no results
        const orgs = await prismaService.organizations.findMany();
        const clients = await prismaService.client.findMany();
        const customers = await prismaService.customer.findMany();
        
        expect(orgs).toHaveLength(0);
        expect(clients).toHaveLength(0);
        expect(customers).toHaveLength(0);
      });

      it('should maintain isolation under concurrent contexts', async () => {
        // Test concurrent operations with different contexts
        const promises = [
          (async () => {
            await tenantService.setOrganizationContext(org1Id);
            const clients = await prismaService.client.findMany();
            return { org: org1Id, count: clients.length };
          })(),
          (async () => {
            await tenantService.setOrganizationContext(org2Id);
            const clients = await prismaService.client.findMany();
            return { org: org2Id, count: clients.length };
          })()
        ];
        
        const results = await Promise.all(promises);
        
        // Each context should see only its own data
        const org1Result = results.find(r => r.org === org1Id);
        const org2Result = results.find(r => r.org === org2Id);
        
        expect(org1Result?.count).toBe(2);
        expect(org2Result?.count).toBe(1);
      });
    });

    describe('Performance and Monitoring', () => {
      it('should verify RLS monitoring view works', async () => {
        const result = await pool.query('SELECT * FROM rls_security_monitor ORDER BY tablename');
        
        expect(result.rows.length).toBeGreaterThan(0);
        
        // Check that key tables have RLS enabled
        const tableMap = result.rows.reduce((acc, row) => {
          acc[row.tablename] = row;
          return acc;
        }, {});
        
        expect(tableMap['organizations']?.rls_enabled).toBe(true);
        expect(tableMap['clients']?.rls_enabled).toBe(true);
        expect(tableMap['customers']?.rls_enabled).toBe(true);
        expect(tableMap['organizations']?.policy_count).toBeGreaterThan(0);
      });

      it('should measure query performance with RLS', async () => {
        await tenantService.setOrganizationContext(org1Id);
        
        const startTime = Date.now();
        
        // Run a representative query
        const customers = await prismaService.customer.findMany({
          include: {
            client: {
              include: {
                organization: true
              }
            }
          }
        });
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        expect(customers).toHaveLength(3);
        expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      });
    });
  });

  describe('Application-Level Tenant Service Integration', () => {
    it('should properly handle tenant context through service methods', async () => {
      // Test the tenant service wrapper methods
      await tenantService.setTenantContext(user1Id, org1Id);
      
      const clients = await tenantService.getAccessibleClients();
      expect(clients).toHaveLength(2);
      expect(clients.every(c => c.organizationId === org1Id)).toBe(true);
    });

    it('should validate user organization membership', async () => {
      // Test that user belongs to organization
      const isValid = await tenantService.validateUserOrganization(user1Id, org1Id);
      expect(isValid).toBe(true);
      
      // Test that user doesn't belong to other organization
      const isInvalid = await tenantService.validateUserOrganization(user1Id, org2Id);
      expect(isInvalid).toBe(false);
    });

    it('should handle system-level operations correctly', async () => {
      await tenantService.setOrganizationContext(org1Id);
      
      // Regular operations should be scoped
      const regularClients = await prismaService.client.findMany();
      expect(regularClients).toHaveLength(2);
      
      // System operations should see all data
      const allClients = await tenantService.executeAsSystem(async () => {
        return prismaService.client.findMany();
      });
      expect(allClients.length).toBeGreaterThanOrEqual(3); // Our test data + any existing
    });
  });
}); 