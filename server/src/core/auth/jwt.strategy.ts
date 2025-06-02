import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

// Define the structure of the JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  // New role and scope claims
  role: string;
  permissions: string[]; // Array of permission strings
  scopes: {
    organizationId: number;
    clientId?: number; // For CLIENT_ADMIN and CUSTOMER_USER
    customerId?: number; // For CUSTOMER_USER only
  };
  // Legacy support - can be removed in future versions
  legacy?: boolean; // Flag to identify old tokens
}

// Legacy payload interface for backward compatibility
export interface LegacyJwtPayload {
  userId: string;
  email: string;
}

// Role hierarchy definition
export enum RoleHierarchy {
  ENERGY_ADMIN = 100,    // Highest level - full system access
  CLIENT_ADMIN = 50,     // Client-level access
  CUSTOMER_USER = 10,    // Customer-level access only
  ADMIN = 90,           // Legacy admin role
  USER = 5              // Legacy user role
}

// Permission constants
export const PERMISSIONS = {
  // System-wide permissions
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_READ: 'system:read',
  
  // Organization permissions
  ORG_ADMIN: 'org:admin',
  ORG_READ: 'org:read',
  ORG_WRITE: 'org:write',
  
  // Client permissions
  CLIENT_ADMIN: 'client:admin',
  CLIENT_READ: 'client:read',
  CLIENT_WRITE: 'client:write',
  CLIENT_BILLING: 'client:billing',
  
  // Customer permissions
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_WRITE: 'customer:write',
  CUSTOMER_BILLING: 'customer:billing',
  
  // Meter and billing permissions
  METER_READ: 'meter:read',
  METER_WRITE: 'meter:write',
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  INVOICE_READ: 'invoice:read',
  INVOICE_WRITE: 'invoice:write',
} as const;

// Role-based permission mapping
export const ROLE_PERMISSIONS = {
  ENERGY_ADMIN: [
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.ORG_ADMIN,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_WRITE,
    PERMISSIONS.CLIENT_ADMIN,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.CLIENT_BILLING,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.CUSTOMER_BILLING,
    PERMISSIONS.METER_READ,
    PERMISSIONS.METER_WRITE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_WRITE,
  ],
  CLIENT_ADMIN: [
    PERMISSIONS.ORG_READ,
    PERMISSIONS.CLIENT_ADMIN,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.CLIENT_BILLING,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_WRITE,
    PERMISSIONS.CUSTOMER_BILLING,
    PERMISSIONS.METER_READ,
    PERMISSIONS.METER_WRITE,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_WRITE,
  ],
  CUSTOMER_USER: [
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_BILLING,
    PERMISSIONS.METER_READ,
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.INVOICE_READ,
  ],
  // Legacy role support
  ADMIN: [
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.ORG_ADMIN,
    PERMISSIONS.ORG_READ,
    PERMISSIONS.ORG_WRITE,
  ],
  USER: [
    PERMISSIONS.ORG_READ,
  ],
} as const;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      // Throw an error during initialization if the secret is missing
      throw new InternalServerErrorException('JWT_SECRET is not defined in environment variables.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // Use the validated secret
    });
  }

  /**
   * This method is called by Passport after verifying the JWT signature and expiration.
   * It receives the decoded payload and should return the user object or throw an error.
   */
  async validate(payload: JwtPayload | LegacyJwtPayload): Promise<any> {
    // console.log('JWT Strategy Validate Payload:', payload); // Log received payload

    if (!payload || !payload.userId) {
      // console.log('JWT Strategy: Invalid payload or missing user ID.');
      throw new UnauthorizedException('Invalid token payload');
    }

    // Use payload.userId
    const userId = payload.userId; 

    // Validate the user exists in the database
    // console.log(`JWT Strategy: Validating user ID from payload: ${userId}`);
    const user = await this.prisma.users.findUnique({
      where: { id: parseInt(userId as any, 10) },
      include: {
        organization_members: {
          include: {
            organizations: true,
          },
        },
      },
    });

    if (!user) {
      // console.log(`JWT Strategy: User ID ${userId} not found in database.`);
      throw new UnauthorizedException('User not found or token invalid');
    }
    
    // Check if this is a legacy token (missing role/scopes)
    const isLegacyToken = !('role' in payload) || !('scopes' in payload);
    
    let enhancedUser: any;
    
    if (isLegacyToken) {
      // Handle legacy tokens - use existing user role and organization
      const primaryOrg = user.organization_members?.[0]?.organizations;
      enhancedUser = {
        ...user,
        role: user.role,
        permissions: [...(ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [])],
        scopes: {
          organizationId: primaryOrg?.id,
        },
        legacy: true,
      };
    } else {
      // New token format - use token claims
      const newPayload = payload as JwtPayload;
      enhancedUser = {
        ...user,
        role: newPayload.role,
        permissions: newPayload.permissions,
        scopes: newPayload.scopes,
        legacy: false,
      };
      
      // Validate that the user has access to the claimed organization
      if (newPayload.scopes.organizationId) {
        const hasOrgAccess = user.organization_members?.some(
          membership => membership.organizations.id === newPayload.scopes.organizationId
        );
        if (!hasOrgAccess) {
          throw new UnauthorizedException('User does not have access to claimed organization');
        }
      }
    }
    
    // Return the enhanced user object
    return enhancedUser;
  }
  
  /**
   * Helper method to get role hierarchy level
   */
  static getRoleLevel(role: string): number {
    return RoleHierarchy[role as keyof typeof RoleHierarchy] || 0;
  }
  
  /**
   * Helper method to check if a role has sufficient privileges
   */
  static hasRequiredRole(userRole: string, requiredRole: string): boolean {
    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(requiredRole);
    return userLevel >= requiredLevel;
  }
} 