import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard, AnyPermissionsGuard } from '../permissions.guard';
import { PERMISSIONS } from '../jwt.strategy';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let mockExecutionContext: Partial<ExecutionContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ, PERMISSIONS.CUSTOMER_READ] 
          },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access when no permissions are required', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user is not authenticated', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: null }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.CLIENT_READ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should deny access when user has no permissions array', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { id: 1, email: 'test@example.com' }, // No permissions
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.CLIENT_READ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should allow access when user has required permission', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ, PERMISSIONS.CUSTOMER_READ] 
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.CLIENT_READ]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should require ALL permissions when multiple are specified (AND logic)', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ] // Missing PERMISSIONS.CLIENT_WRITE
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.CLIENT_READ, 
        PERMISSIONS.CLIENT_WRITE
      ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should allow access when user has all required permissions', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [
              PERMISSIONS.CLIENT_READ, 
              PERMISSIONS.CLIENT_WRITE,
              PERMISSIONS.CUSTOMER_READ
            ] 
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.CLIENT_READ, 
        PERMISSIONS.CLIENT_WRITE
      ]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should provide meaningful error messages for missing permissions', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ] 
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.SYSTEM_ADMIN]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Insufficient permissions. Required: system:admin');
    });

    it('should handle multiple missing permissions in error message', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ] 
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.SYSTEM_ADMIN, 
        PERMISSIONS.ORG_ADMIN
      ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Insufficient permissions. Required: system:admin, org:admin');
    });
  });

  describe('edge cases', () => {
    it('should handle empty permissions arrays', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { permissions: [] },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.CLIENT_READ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should handle case-sensitive permission matching', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: ['client:READ'] // Wrong case
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([PERMISSIONS.CLIENT_READ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });
  });
});

describe('AnyPermissionsGuard', () => {
  let guard: AnyPermissionsGuard;
  let reflector: Reflector;
  let mockExecutionContext: Partial<ExecutionContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnyPermissionsGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AnyPermissionsGuard>(AnyPermissionsGuard);
    reflector = module.get<Reflector>(Reflector);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ] 
          },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access when no permissions are required', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow access when user has ANY of the required permissions (OR logic)', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CLIENT_READ] // Has one of the required permissions
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.CLIENT_READ, 
        PERMISSIONS.SYSTEM_ADMIN // User doesn't have this one, but that's OK
      ]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user has none of the required permissions', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CUSTOMER_READ] // Doesn't have any of the required ones
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.CLIENT_READ, 
        PERMISSIONS.SYSTEM_ADMIN
      ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should provide meaningful error messages for OR logic', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            permissions: [PERMISSIONS.CUSTOMER_READ] 
          },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
        PERMISSIONS.CLIENT_READ, 
        PERMISSIONS.SYSTEM_ADMIN
      ]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Insufficient permissions. Required any of: client:read, system:admin');
    });
  });
});

describe('Permission Constants', () => {
  it('should have all expected permissions defined', () => {
    const expectedPermissions = [
      'system:admin',
      'org:admin', 'org:read', 'org:write',
      'client:admin', 'client:read', 'client:write',
      'customer:read', 'customer:write',
      'meter:read', 'meter:write',
      'billing:read', 'billing:write',
      'invoice:read', 'invoice:write'
    ];

    expectedPermissions.forEach(permission => {
      const permissionKey = permission.replace(':', '_').toUpperCase();
      expect(PERMISSIONS).toHaveProperty(permissionKey);
      expect(PERMISSIONS[permissionKey as keyof typeof PERMISSIONS]).toBe(permission);
    });
  });

  it('should have unique permission values', () => {
    const permissionValues = Object.values(PERMISSIONS);
    const uniqueValues = new Set(permissionValues);
    expect(permissionValues.length).toBe(uniqueValues.size);
  });
}); 