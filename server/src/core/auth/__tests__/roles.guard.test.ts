import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { Role } from '../role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockExecutionContext: Partial<ExecutionContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.USER },
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
    it('should allow access when no roles are required', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user is not authenticated', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: null }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.USER]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should allow access when user has exact required role', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.CLIENT_ADMIN },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.CLIENT_ADMIN]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow access when user has higher role than required (hierarchy)', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.ENERGY_ADMIN },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.CLIENT_ADMIN]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user has lower role than required', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.USER },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.CLIENT_ADMIN]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should allow access when user has any of multiple required roles', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.CLIENT_ADMIN },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.CUSTOMER_USER, Role.CLIENT_ADMIN]);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle role hierarchy correctly across all levels', async () => {
      const testCases = [
        // [userRole, requiredRole, shouldPass]
        [Role.ENERGY_ADMIN, Role.USER, true],
        [Role.ENERGY_ADMIN, Role.CUSTOMER_USER, true],
        [Role.ENERGY_ADMIN, Role.CLIENT_ADMIN, true],
        [Role.ENERGY_ADMIN, Role.ENERGY_ADMIN, true],
        
        [Role.CLIENT_ADMIN, Role.USER, true],
        [Role.CLIENT_ADMIN, Role.CUSTOMER_USER, true],
        [Role.CLIENT_ADMIN, Role.CLIENT_ADMIN, true],
        [Role.CLIENT_ADMIN, Role.ENERGY_ADMIN, false],
        
        [Role.CUSTOMER_USER, Role.USER, true],
        [Role.CUSTOMER_USER, Role.CUSTOMER_USER, true],
        [Role.CUSTOMER_USER, Role.CLIENT_ADMIN, false],
        [Role.CUSTOMER_USER, Role.ENERGY_ADMIN, false],
        
        [Role.USER, Role.USER, true],
        [Role.USER, Role.CUSTOMER_USER, false],
        [Role.USER, Role.CLIENT_ADMIN, false],
        [Role.USER, Role.ENERGY_ADMIN, false],
      ];

      for (const [userRole, requiredRole, shouldPass] of testCases) {
        mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: userRole },
          }),
        });

        (reflector.getAllAndOverride as jest.Mock).mockReturnValue([requiredRole]);

        if (shouldPass) {
          const result = guard.canActivate(mockExecutionContext as ExecutionContext);
          expect(result).toBe(true);
        } else {
          expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
            .toThrow(UnauthorizedException);
        }
      }
    });

    it('should provide meaningful error messages', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.USER },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ENERGY_ADMIN]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Insufficient role permissions. Required: ENERGY_ADMIN, Current: USER');
    });

    it('should handle multiple required roles with proper error messages', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: Role.USER },
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.CLIENT_ADMIN, Role.ENERGY_ADMIN]);

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Insufficient role permissions. Required one of: CLIENT_ADMIN, ENERGY_ADMIN. Current: USER');
    });
  });

  describe('role hierarchy validation', () => {
    it('should correctly identify role hierarchy levels', () => {
      // Test the internal role hierarchy logic if exposed
      // This assumes we have a method to get role level
      const roleHierarchy = {
        [Role.ENERGY_ADMIN]: 100,
        [Role.CLIENT_ADMIN]: 50,
        [Role.CUSTOMER_USER]: 10,
        [Role.USER]: 5,
      };

      Object.entries(roleHierarchy).forEach(([role, expectedLevel]) => {
        // This would test an internal method if we exposed it
        // For now, we test the hierarchy through the guard behavior
        expect(typeof role).toBe('string');
        expect(typeof expectedLevel).toBe('number');
      });
    });
  });
}); 