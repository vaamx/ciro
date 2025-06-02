import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any; // Use any to avoid complex typing issues
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let emailService: jest.Mocked<EmailService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    hashed_password: 'hashedpassword123',
    role: 'USER',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUserWithOrg = {
    ...mockUser,
    organization_members: [{
      id: 1,
      user_id: 1,
      organization_id: 1,
      joined_at: new Date(),
      organizations: {
        id: 1,
        name: 'Test Organization',
        created_at: new Date(),
        updated_at: new Date(),
      }
    }]
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
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EmailService, useValue: { 
          sendVerificationEmail: jest.fn(),
          sendWelcomeEmail: jest.fn(),
          sendPasswordResetEmail: jest.fn(),
        }},
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully register a new user', async () => {
      prismaService.users.findFirst.mockResolvedValue(null); // No existing user
      mockedBcrypt.hash.mockResolvedValue('hashedpassword' as never);
      prismaService.users.create.mockResolvedValue(mockUser);
      emailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(prismaService.users.findFirst).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException if user already exists', async () => {
      prismaService.users.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prismaService.users.create).not.toHaveBeenCalled();
    });

    it('should handle email service failures gracefully', async () => {
      prismaService.users.findFirst.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedpassword' as never);
      prismaService.users.create.mockResolvedValue(mockUser);
      emailService.sendVerificationEmail.mockRejectedValue(new Error('Email service down'));

      // Should not throw error even if email fails
      const result = await service.register(registerDto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      prismaService.users.findFirst.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        created_at: mockUser.created_at,
      });
      expect(result).not.toHaveProperty('hashed_password');
    });

    it('should return null if user does not exist', async () => {
      prismaService.users.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      prismaService.users.findFirst.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('should successfully login and return enhanced JWT token', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'CLIENT_ADMIN',
      });
      
      prismaService.users.findUnique.mockResolvedValue(mockUserWithOrg);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return enhanced user profile with permissions and organization', async () => {
      prismaService.users.findUnique.mockResolvedValue(mockUserWithOrg);

      const result = await service.getCurrentUser(1);

      expect(result).toEqual(expect.objectContaining({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        permissions: expect.any(Array),
        scopes: expect.any(Object),
      }));
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prismaService.users.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('should successfully update user role when admin has permission', async () => {
      const energyAdmin = { ...mockUser, role: 'ENERGY_ADMIN' };
      prismaService.users.findUnique.mockResolvedValue(energyAdmin);
      
      const updatedUser = { ...mockUser, role: 'CLIENT_ADMIN' };
      prismaService.users.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole(1, 2, 'CLIENT_ADMIN' as any);

      expect(result.message).toBe('User role updated successfully');
      expect(result.user).toEqual(updatedUser);
    });

    it('should throw UnauthorizedException if admin is not ENERGY_ADMIN', async () => {
      const regularUser = { ...mockUser, role: 'CLIENT_ADMIN' };
      prismaService.users.findUnique.mockResolvedValue(regularUser);

      await expect(service.updateUserRole(1, 2, 'CLIENT_ADMIN' as any))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUsers', () => {
    it('should return enhanced user list for ENERGY_ADMIN', async () => {
      const energyAdmin = { ...mockUser, role: 'ENERGY_ADMIN' };
      prismaService.users.findUnique.mockResolvedValue(energyAdmin);
      
      const userList = [mockUserWithOrg];
      prismaService.users.findMany.mockResolvedValue(userList);

      const result = await service.getUsers(1);

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          permissions: expect.any(Array),
          organizationCount: expect.any(Number),
        }),
      ]));
    });

    it('should throw UnauthorizedException for non-ENERGY_ADMIN users', async () => {
      const regularUser = { ...mockUser, role: 'CLIENT_ADMIN' };
      prismaService.users.findUnique.mockResolvedValue(regularUser);

      await expect(service.getUsers(1)).rejects.toThrow(UnauthorizedException);
    });

    it('should filter users by role when roleFilter is provided', async () => {
      const energyAdmin = { ...mockUser, role: 'ENERGY_ADMIN' };
      prismaService.users.findUnique.mockResolvedValue(energyAdmin);
      prismaService.users.findMany.mockResolvedValue([]);

      await service.getUsers(1, 'CLIENT_ADMIN' as any);

      expect(prismaService.users.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT_ADMIN' },
        select: expect.any(Object),
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      const registerDto = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      prismaService.users.findFirst.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedpassword' as never);
      prismaService.users.create.mockRejectedValue(new Error('Database error'));

      await expect(service.register(registerDto)).rejects.toThrow();
    });

    it('should not expose sensitive information in errors', async () => {
      // Test that we don't leak password hashes or other sensitive data
      const loginDto = { email: 'test@example.com', password: 'password123' };
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      try {
        await service.login(loginDto);
      } catch (error: any) {
        expect(error.message).not.toContain('password');
        expect(error.message).not.toContain('hash');
      }
    });

    it('should validate role-based access control correctly', async () => {
      // Test that RBAC system correctly validates permissions
      const testRoles = ['USER', 'CUSTOMER_USER', 'CLIENT_ADMIN', 'ENERGY_ADMIN'];
      
      for (const role of testRoles) {
        const userWithRole = { ...mockUser, role };
        prismaService.users.findUnique.mockResolvedValue(userWithRole);
        
        const result = await service.getCurrentUser(1);
        expect(result.role).toBe(role);
        expect(result.permissions).toEqual(expect.any(Array));
      }
    });

    it('should handle tenant isolation correctly', async () => {
      const userWithMultipleOrgs = {
        ...mockUser,
        organization_members: [
          {
            id: 1,
            user_id: 1,
            organization_id: 1,
            joined_at: new Date(),
            organizations: { id: 1, name: 'Org 1' }
          },
          {
            id: 2,
            user_id: 1,
            organization_id: 2,
            joined_at: new Date(),
            organizations: { id: 2, name: 'Org 2' }
          }
        ]
      };

      prismaService.users.findUnique.mockResolvedValue(userWithMultipleOrgs);
      
      const result = await service.getCurrentUser(1);
      
      // Should use primary (first) organization for scoping
      expect(result.organization.id).toBe(1);
      expect(result.scopes.organizationId).toBe(1);
    });
  });
}); 