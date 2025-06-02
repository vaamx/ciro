import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantScopeGuard } from '../tenant-scope.guard';

describe('TenantScopeGuard', () => {
  let guard: TenantScopeGuard;
  let reflector: Reflector;
  let mockExecutionContext: Partial<ExecutionContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantScopeGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TenantScopeGuard>(TenantScopeGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Organization Scope Validation', () => {
    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1 } 
            },
            params: { organizationId: '1' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };
    });

    it('should allow access when no tenant validation is required', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow access when user organization matches requested organization', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user organization does not match requested organization', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1 } 
          },
          params: { organizationId: '2' }, // Different organization
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should handle organization ID in query parameters', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1 } 
          },
          params: {},
          query: { organizationId: '1' },
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle organization ID in request body', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1 } 
          },
          params: {},
          query: {},
          body: { organizationId: 1 }
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when organization ID is missing from request', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1 } 
          },
          params: {},
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Organization ID not found in request');
    });
  });

  describe('Client Scope Validation', () => {
    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1, clientId: 100 } 
            },
            params: { clientId: '100' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };
    });

    it('should allow access when user client matches requested client', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('client');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user client does not match requested client', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1, clientId: 100 } 
          },
          params: { clientId: '200' }, // Different client
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('client');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should deny access when user has no client scope', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1 } // No clientId
          },
          params: { clientId: '100' },
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('client');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('User does not have client access');
    });
  });

  describe('Customer Scope Validation', () => {
    beforeEach(() => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1, clientId: 100, customerId: 1000 } 
            },
            params: { customerId: '1000' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };
    });

    it('should allow access when user customer matches requested customer', async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('customer');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny access when user customer does not match requested customer', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1, clientId: 100, customerId: 1000 } 
          },
          params: { customerId: '2000' }, // Different customer
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('customer');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should deny access when user has no customer scope', async () => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { 
            scopes: { organizationId: 1, clientId: 100 } // No customerId
          },
          params: { customerId: '1000' },
          query: {},
          body: {}
        }),
      });

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('customer');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('User does not have customer access');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should deny access when user is not authenticated', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: null,
            params: { organizationId: '1' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });

    it('should deny access when user has no scopes', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { id: 1, email: 'test@example.com' }, // No scopes
            params: { organizationId: '1' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('User scopes not found');
    });

    it('should handle invalid tenant validation type', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1 } 
            },
            params: {},
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('invalid');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow('Invalid tenant validation type: invalid');
    });

    it('should handle string number comparisons correctly', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1 } // Number
            },
            params: { organizationId: '1' }, // String
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should prioritize params over query over body for ID extraction', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1 } 
            },
            params: { organizationId: '1' }, // Should use this one
            query: { organizationId: '2' },
            body: { organizationId: 3 }
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');

      const result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true); // Should match params value '1'
    });
  });

  describe('Multi-level Tenant Validation', () => {
    it('should handle combined organization and client validation', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1, clientId: 100 } 
            },
            params: { organizationId: '1', clientId: '100' },
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      // Test organization validation
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('organization');
      let result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);

      // Test client validation
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('client');
      result = guard.canActivate(mockExecutionContext as ExecutionContext);
      expect(result).toBe(true);
    });

    it('should fail if organization matches but client does not', async () => {
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { 
              scopes: { organizationId: 1, clientId: 100 } 
            },
            params: { organizationId: '1', clientId: '200' }, // Wrong client
            query: {},
            body: {}
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      };

      (reflector.getAllAndOverride as jest.Mock).mockReturnValue('client');

      expect(() => guard.canActivate(mockExecutionContext as ExecutionContext))
        .toThrow(UnauthorizedException);
    });
  });
}); 