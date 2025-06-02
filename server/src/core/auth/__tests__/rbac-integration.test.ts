import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtStrategy, ROLE_PERMISSIONS } from '../jwt.strategy';
import { Role } from '../role.enum';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('RBAC Integration Tests', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let jwtStrategy: JwtStrategy;
  let prismaService: any;

  const mockUsers = {
    energyAdmin: {
      id: 1,
      email: 'admin@energy.com',
      name: 'Energy Admin',
      role: 'ENERGY_ADMIN',
      hashed_password: 'hashed123',
      created_at: new Date(),
      updated_at: new Date(),
    },
    clientAdmin: {
      id: 2,
      email: 'client@company.com',
      name: 'Client Admin',
      role: 'CLIENT_ADMIN',
      hashed_password: 'hashed123',
      created_at: new Date(),
      updated_at: new Date(),
    },
    customerUser: {
      id: 3,
      email: 'customer@company.com',
      name: 'Customer User',
      role: 'CUSTOMER_USER',
      hashed_password: 'hashed123',
      created_at: new Date(),
      updated_at: new Date(),
    },
    regularUser: {
      id: 4,
      email: 'user@company.com',
      name: 'Regular User',
      role: 'USER',
      hashed_password: 'hashed123',
      created_at: new Date(),
      updated_at: new Date(),
    },
  };

  const mockOrganization = {
    id: 1,
    name: 'Test Energy Company',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      users: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      organizations: {
        findUnique: jest.fn(),
      },
      organization_members: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Generation and Validation', () => {
    it('should generate enhanced JWT tokens with role and permissions', async () => {
      const userWithOrg = {
        ...mockUsers.clientAdmin,
        organization_members: [{
          id: 1,
          user_id: 2,
          organization_id: 1,
          joined_at: new Date(),
          organizations: mockOrganization,
        }],
      };

      prismaService.users.findFirst.mockResolvedValue(userWithOrg);
      prismaService.users.findUnique.mockResolvedValue(userWithOrg);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const loginResult = await authService.login({
        email: 'client@company.com',
        password: 'password123',
      });

      expect(loginResult).toEqual({ accessToken: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: '2',
        email: 'client@company.com',
        role: 'CLIENT_ADMIN',
        permissions: expect.arrayContaining([
          'client:admin', 'client:read', 'client:write',
          'customer:read', 'customer:write',
          'meter:read', 'meter:write',
          'billing:read', 'billing:write',
          'invoice:read', 'invoice:write',
        ]),
        scopes: { organizationId: 1 },
      });
    });

    it('should validate JWT payload correctly', async () => {
      const payload = {
        userId: '1',
        email: 'admin@energy.com',
        role: 'ENERGY_ADMIN',
        permissions: ['system:admin'],
        scopes: { organizationId: 1 },
      };

      const userWithOrg = {
        ...mockUsers.energyAdmin,
        organization_members: [{
          id: 1,
          user_id: 1,
          organization_id: 1,
          joined_at: new Date(),
          organizations: mockOrganization,
        }],
      };

      prismaService.users.findUnique.mockResolvedValue(userWithOrg);

      const result = await jwtStrategy.validate(payload);

      // The JWT strategy returns the full user object with additional fields
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        email: 'admin@energy.com',
        role: 'ENERGY_ADMIN',
        permissions: ['system:admin'],
        scopes: { organizationId: 1 },
        legacy: false, // Modern token validation
      }));
      
      // Ensure it has all the expected properties
      expect(result.id).toBe(1);
      expect(result.email).toBe('admin@energy.com');
      expect(result.role).toBe('ENERGY_ADMIN');
      expect(result.permissions).toEqual(['system:admin']);
      expect(result.scopes).toEqual({ organizationId: 1 });
    });
  });

  describe('Role Hierarchy and Permissions', () => {
    it('should correctly map ENERGY_ADMIN role to all permissions', () => {
      const energyAdminPermissions = ROLE_PERMISSIONS[Role.ENERGY_ADMIN];
      
      expect(energyAdminPermissions).toContain('system:admin');
      expect(energyAdminPermissions).toContain('org:admin');
      expect(energyAdminPermissions).toContain('client:admin');
      expect(energyAdminPermissions).toContain('customer:read');
      expect(energyAdminPermissions).toContain('meter:read');
      expect(energyAdminPermissions).toContain('billing:read');
      expect(energyAdminPermissions).toContain('invoice:read');
    });

    it('should correctly map CLIENT_ADMIN role to client-level permissions', () => {
      const clientAdminPermissions = ROLE_PERMISSIONS[Role.CLIENT_ADMIN];
      
      expect(clientAdminPermissions).not.toContain('system:admin');
      expect(clientAdminPermissions).not.toContain('org:admin');
      expect(clientAdminPermissions).toContain('client:admin');
      expect(clientAdminPermissions).toContain('customer:read');
      expect(clientAdminPermissions).toContain('meter:read');
      expect(clientAdminPermissions).toContain('billing:read');
      expect(clientAdminPermissions).toContain('invoice:read');
    });

    it('should correctly map CUSTOMER_USER role to customer-level permissions', () => {
      const customerUserPermissions = ROLE_PERMISSIONS[Role.CUSTOMER_USER];
      
      expect(customerUserPermissions).not.toContain('system:admin');
      expect(customerUserPermissions).not.toContain('client:admin');
      expect(customerUserPermissions).toContain('customer:read');
      expect(customerUserPermissions).toContain('meter:read');
      expect(customerUserPermissions).toContain('billing:read');
      expect(customerUserPermissions).toContain('invoice:read');
    });

    it('should correctly map regular USER role to minimal permissions', () => {
      const userPermissions = ROLE_PERMISSIONS[Role.USER];
      
      expect(userPermissions).not.toContain('system:admin');
      expect(userPermissions).not.toContain('client:admin');
      expect(userPermissions).toContain('org:read');
      expect(userPermissions.length).toBeLessThan(ROLE_PERMISSIONS[Role.CUSTOMER_USER].length);
    });
  });

  describe('User Profile and Enhanced Information', () => {
    it('should return enhanced user profile with permissions and organization info', async () => {
      const userWithOrg = {
        ...mockUsers.clientAdmin,
        organization_members: [{
          id: 1,
          user_id: 2,
          organization_id: 1,
          joined_at: new Date(),
          organizations: mockOrganization,
        }],
      };

      prismaService.users.findUnique.mockResolvedValue(userWithOrg);

      const result = await authService.getCurrentUser(2);

      expect(result).toEqual(expect.objectContaining({
        id: 2,
        email: 'client@company.com',
        name: 'Client Admin',
        role: 'CLIENT_ADMIN',
        permissions: expect.arrayContaining(['client:admin', 'customer:read']),
        scopes: { organizationId: 1 },
        organization: {
          id: 1,
          name: 'Test Energy Company',
          membership: {
            joinedAt: expect.any(Date),
          },
        },
      }));
    });

    it('should handle users without organization memberships', async () => {
      const userWithoutOrg = {
        ...mockUsers.regularUser,
        organization_members: [],
      };

      prismaService.users.findUnique.mockResolvedValue(userWithoutOrg);

      const result = await authService.getCurrentUser(4);

      expect(result).toEqual(expect.objectContaining({
        id: 4,
        email: 'user@company.com',
        name: 'Regular User',
        role: 'USER',
        permissions: expect.any(Array),
        organization: null,
      }));
    });
  });

  describe('Role Management Operations', () => {
    it('should allow ENERGY_ADMIN to update user roles', async () => {
      prismaService.users.findUnique.mockResolvedValueOnce(mockUsers.energyAdmin);
      const updatedUser = { ...mockUsers.regularUser, role: 'CLIENT_ADMIN' };
      prismaService.users.update.mockResolvedValue(updatedUser);

      const result = await authService.updateUserRole(1, 4, 'CLIENT_ADMIN' as any);

      expect(result.message).toBe('User role updated successfully');
      expect(result.user.role).toBe('CLIENT_ADMIN');
    });

    it('should reject role updates from non-ENERGY_ADMIN users', async () => {
      prismaService.users.findUnique.mockResolvedValue(mockUsers.clientAdmin);

      await expect(authService.updateUserRole(2, 4, 'CLIENT_ADMIN' as any))
        .rejects.toThrow('Only ENERGY_ADMIN users can change roles');
    });

    it('should allow ENERGY_ADMIN to list users with enhanced information', async () => {
      prismaService.users.findUnique.mockResolvedValueOnce(mockUsers.energyAdmin);
      const userList = [
        {
          ...mockUsers.clientAdmin,
          organization_members: [{
            organizations: mockOrganization,
          }],
        },
      ];
      prismaService.users.findMany.mockResolvedValue(userList);

      const result = await authService.getUsers(1);

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          email: 'client@company.com',
          permissions: expect.any(Array),
          organizationCount: 1,
          primaryOrganization: mockOrganization,
        }),
      ]));
    });

    it('should reject user listing from non-ENERGY_ADMIN users', async () => {
      prismaService.users.findUnique.mockResolvedValue(mockUsers.clientAdmin);

      await expect(authService.getUsers(2))
        .rejects.toThrow('Only ENERGY_ADMIN users can view user lists');
    });
  });

  describe('Tenant Isolation and Multi-Organization Support', () => {
    it('should handle users with multiple organization memberships', async () => {
      const userWithMultipleOrgs = {
        ...mockUsers.clientAdmin,
        organization_members: [
          {
            id: 1,
            user_id: 2,
            organization_id: 1,
            joined_at: new Date('2023-01-01'),
            organizations: { id: 1, name: 'Primary Org' },
          },
          {
            id: 2,
            user_id: 2,
            organization_id: 2,
            joined_at: new Date('2023-06-01'),
            organizations: { id: 2, name: 'Secondary Org' },
          },
        ],
      };

      prismaService.users.findUnique.mockResolvedValue(userWithMultipleOrgs);

      const result = await authService.getCurrentUser(2);

      // Should use the first (primary) organization for scoping
      expect(result.organization.id).toBe(1);
      expect(result.scopes.organizationId).toBe(1);
    });

    it('should generate organization-scoped JWT tokens', async () => {
      const userWithOrg = {
        ...mockUsers.customerUser,
        organization_members: [{
          id: 1,
          user_id: 3,
          organization_id: 1,
          joined_at: new Date(),
          organizations: mockOrganization,
        }],
      };

      prismaService.users.findFirst.mockResolvedValue(userWithOrg);
      prismaService.users.findUnique.mockResolvedValue(userWithOrg);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await authService.login({
        email: 'customer@company.com',
        password: 'password123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '3',
          role: 'CUSTOMER_USER',
          scopes: { organizationId: 1 },
        })
      );
    });

    it('should handle users without organizations (default scoping)', async () => {
      const userWithoutOrg = {
        ...mockUsers.regularUser,
        organization_members: [],
      };

      prismaService.users.findFirst.mockResolvedValue(userWithoutOrg);
      prismaService.users.findUnique.mockResolvedValue(userWithoutOrg);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await authService.login({
        email: 'user@company.com',
        password: 'password123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '4',
          role: 'USER',
          scopes: { organizationId: 0 }, // Default for users without org
        })
      );
    });
  });

  describe('Security and Access Control Validation', () => {
    it('should validate that all role permissions are defined', () => {
      const allRoles = Object.values(Role);
      
      for (const role of allRoles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    });

    it('should ensure permission hierarchy is maintained', () => {
      const energyAdminPerms = ROLE_PERMISSIONS[Role.ENERGY_ADMIN];
      const clientAdminPerms = ROLE_PERMISSIONS[Role.CLIENT_ADMIN];
      const customerUserPerms = ROLE_PERMISSIONS[Role.CUSTOMER_USER];
      const userPerms = ROLE_PERMISSIONS[Role.USER];

      // Energy admin should have the most permissions
      expect(energyAdminPerms.length).toBeGreaterThanOrEqual(clientAdminPerms.length);
      expect(clientAdminPerms.length).toBeGreaterThanOrEqual(customerUserPerms.length);
      expect(customerUserPerms.length).toBeGreaterThanOrEqual(userPerms.length);

      // System admin permission should only be available to ENERGY_ADMIN
      expect(energyAdminPerms).toContain('system:admin');
      expect(clientAdminPerms).not.toContain('system:admin');
      expect(customerUserPerms).not.toContain('system:admin');
      expect(userPerms).not.toContain('system:admin');
    });

    it('should not expose sensitive information in user profiles', async () => {
      const userWithSensitiveData = {
        ...mockUsers.regularUser,
        hashed_password: 'sensitive-hash',
        reset_token: 'sensitive-token',
        organization_members: [],
      };

      prismaService.users.findUnique.mockResolvedValue(userWithSensitiveData);

      const result = await authService.getCurrentUser(4);

      expect(result).not.toHaveProperty('hashed_password');
      expect(result).not.toHaveProperty('reset_token');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('scopes');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid user IDs gracefully', async () => {
      prismaService.users.findUnique.mockResolvedValue(null);

      await expect(authService.getCurrentUser(999))
        .rejects.toThrow('User not found');
    });

    it('should handle malformed JWT payloads', async () => {
      const invalidPayload = {
        userId: 'invalid',
        // Missing required fields
      };

      prismaService.users.findUnique.mockResolvedValue(null);

      await expect(jwtStrategy.validate(invalidPayload as any))
        .rejects.toThrow();
    });

    it('should validate role values in updateUserRole', async () => {
      prismaService.users.findUnique.mockResolvedValue(mockUsers.energyAdmin);

      await expect(authService.updateUserRole(1, 2, 'INVALID_ROLE' as any))
        .rejects.toThrow('Invalid role specified');
    });
  });

  describe('Performance and Optimization', () => {
    it('should efficiently handle permission lookups', () => {
      const start = Date.now();
      
      // Simulate multiple permission checks
      for (let i = 0; i < 1000; i++) {
        const permissions = ROLE_PERMISSIONS[Role.CLIENT_ADMIN];
        permissions.includes('client:admin');
      }
      
      const end = Date.now();
      const duration = end - start;
      
      // Should complete in reasonable time (under 10ms for 1000 operations)
      expect(duration).toBeLessThan(10);
    });

    it('should cache role permissions effectively', () => {
      const perm1 = ROLE_PERMISSIONS[Role.ENERGY_ADMIN];
      const perm2 = ROLE_PERMISSIONS[Role.ENERGY_ADMIN];
      
      // Should return the same reference (cached)
      expect(perm1).toBe(perm2);
    });
  });
}); 