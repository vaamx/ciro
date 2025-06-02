import { Injectable, UnauthorizedException, InternalServerErrorException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt'; // Import JwtService
import { JwtPayload, ROLE_PERMISSIONS } from './jwt.strategy'; // Import enhanced JwtPayload and permissions
import { RegisterDto } from './dto/register.dto'; // Correct import path
import { LoginDto } from './dto/login.dto'; // Correct import path
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email/email.service';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service'; // Changed from @core/database/prisma.service
import { Role } from '@prisma/client'; // Import Role enum from Prisma
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a random token for email verification or password reset
   * @returns A random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  async register(registerDto: RegisterDto): Promise<any> {
    const { username, email, password } = registerDto;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if user already exists
    const existingUser = await this.prisma.users.findFirst({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      this.logger.warn(`Registration attempt with existing email: ${email}`);
      throw new ConflictException('User with this email already exists');
    }

    // Create and save the new user
    const verificationToken = this.generateToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newUser = this.prisma.users.create({
      data: {
        name: username,
        email,
        hashed_password: hashedPassword,
        role: Role.USER,
        updated_at: new Date(),
      },
    });

    try {
      const savedUser = await newUser;
      
      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(email, verificationToken);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't expose email sending failure to client
      }
      
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashed_password, ...result } = savedUser as any; // Remove password before returning
      return result;
    } catch (error) {
      console.error("Registration Error:", error);
      // Handle potential unique constraint errors etc.
      throw new InternalServerErrorException('Could not register user');
    }
  }

  /**
   * Validates user credentials.
   * @param email User email
   * @param pass Plain text password
   * @returns User object without password hash if valid, otherwise null
   */
  async validateUser(email: string, pass: string): Promise<any | null> {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [
          { email: email },
          { name: email }, // Assuming first_name is used as username
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        hashed_password: true,
        role: true,
        created_at: true, // Fixed from createdAt
      },
    });
    
    if (!user) return null;
    
    // Validate password
    if (!user.hashed_password) {
      this.logger.warn(`Login attempt for user without password: ${email}`);
      return null;
    }
    const isPasswordValid = await bcrypt.compare(pass, user.hashed_password);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for user: ${email}`);
      return null;
    }
    
    // Return user object without the password hash
    const { hashed_password, ...result } = user;
    this.logger.verbose(`User validation successful for: ${email}`);
    return result;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string /* TODO: Add refreshToken later */ }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    if (user.emailVerified === false) {
      throw new UnauthorizedException('Email not verified. Please check your inbox for the verification email.');
    }

    // Fetch user with organization memberships for enhanced payload
    const userWithOrgs = await this.prisma.users.findUnique({
      where: { id: user.id },
      include: {
        organization_members: {
          include: {
            organizations: true,
          },
        },
      },
    });

    if (!userWithOrgs) {
      throw new UnauthorizedException('User not found');
    }

    // Get primary organization (first one for now)
    const primaryOrgMembership = userWithOrgs.organization_members?.[0];
    const primaryOrg = primaryOrgMembership?.organizations;

    // Create enhanced payload with role and scope claims
    const payload: JwtPayload = {
      userId: user.id.toString(),
      email: user.email,
      role: user.role,
      permissions: [...(ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [])],
      scopes: {
        organizationId: primaryOrg?.id || 0, // Default to 0 if no org
        // clientId and customerId will be set based on role context in future
        // For now, they're optional and can be determined by role and API endpoints
      },
    };

    const accessToken = this.jwtService.sign(payload);
    
    // TODO: Implement refresh token strategy
    // const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' }); 

    return {
      accessToken,
      // refreshToken,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is missing');
    }

    // Find user by the verification token
    const user = await this.prisma.users.findFirst({
      where: { id: parseInt(token) } // Placeholder - NEED TOKEN FIELD!
    });

    if (!user) { // Simplified check as token/expiry fields don't exist
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Update user to verified status
    const updatedUser = await this.prisma.users.update({
      where: { id: user.id },
      data: {
      }
    });
    
    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(updatedUser.email, updatedUser.name || updatedUser.email);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
    
    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.users.findFirst({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      console.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If your email is registered, you will receive a password reset link.' };
    }

    // Generate and save reset token
    const resetToken = this.generateToken();
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // For password reset, we'll use an alternative approach since the fields may not exist in Prisma schema
    try {
      // Use prisma.$executeRaw to run a SQL update
      await this.prisma.$executeRaw`
        UPDATE users 
        SET 
          settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb), 
            '{passwordReset}', 
            jsonb_build_object('token', ${resetToken}, 'expires', ${tokenExpiresAt})::jsonb
          )
        WHERE id = ${user.id}
      `;
      
      // Send password reset email
      try {
        await this.emailService.sendPasswordResetEmail(email, resetToken);
      } catch (error) {
        console.error('Failed to send password reset email:', error);
      }
      
      return { message: 'If your email is registered, you will receive a password reset link.' };
    } catch (error) {
      console.error('Error saving password reset token:', error);
      throw new InternalServerErrorException('Failed to process password reset request');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    // Find user with the token in settings JSON field
    const users = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM users
      WHERE 
        settings->>'passwordReset' IS NOT NULL
        AND settings->'passwordReset'->>'token' = ${token}
        AND (settings->'passwordReset'->>'expires')::timestamp > NOW()
    `;

    if (!users || users.length === 0) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = users[0];

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token from settings
    await this.prisma.$executeRaw`
      UPDATE users
      SET 
        hashed_password = ${hashedPassword},
        settings = settings - 'passwordReset'
      WHERE id = ${user.id}
    `;
    
    return { message: 'Password has been reset successfully' };
  }

  async getCurrentUser(userId: number): Promise<any> {
    this.logger.debug(`Fetching current user details for ID: ${userId}`);
    const user = await this.prisma.users.findUnique({ 
      where: { id: userId },
      include: {
        organization_members: {
          include: {
            organizations: true,
          },
        },
      },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Get primary organization
    const primaryOrgMembership = user.organization_members?.[0];
    const primaryOrg = primaryOrgMembership?.organizations;
    
    // Get role permissions
    const permissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];
    
    // Build enhanced user profile
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: [...permissions],
      scopes: {
        organizationId: primaryOrg?.id,
        // Future: Add clientId and customerId based on role-specific assignments
      },
      organization: primaryOrg ? {
        id: primaryOrg.id,
        name: primaryOrg.name,
        membership: {
          joinedAt: primaryOrgMembership.joined_at,
          // Future: Add membership-specific role or permissions
        },
      } : null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
    
    return userProfile;
  }
  
  async logout(userId: string): Promise<void> {
    // For now, just log the logout (JWT-based auth doesn't need server-side logout)
    console.log(`User ${userId} logged out`);
    // TODO: Implement refresh token invalidation when those are added
  }
  
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    this.logger.debug(`Attempting password change for user ID: ${userId}`);
    // Get the user with password hash
    const user = await this.prisma.users.findUnique({ 
      where: { id: userId },
      select: {
        id: true,
        hashed_password: true,
      }
    });
    
    if (!user || !user.hashed_password) {
      this.logger.error(`Attempt to change password for non-existent user or user without password: ${userId}`);
      throw new NotFoundException('User not found or password not set.');
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.hashed_password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the password
    await this.prisma.users.update({
      where: { id: userId },
      data: { hashed_password: hashedPassword }
    });
    
    return { message: 'Password changed successfully' };
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(adminUserId: number, targetUserId: number, newRole: Role): Promise<{ message: string, user: any }> {
    // Verify admin has permission to change roles
    const admin = await this.prisma.users.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || (admin.role as string) !== 'ENERGY_ADMIN') {
      throw new UnauthorizedException('Only ENERGY_ADMIN users can change roles');
    }

    // Validate the new role
    if (!Object.values(Role).includes(newRole)) {
      throw new BadRequestException('Invalid role specified');
    }

    // Update the user role
    const updatedUser = await this.prisma.users.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updated_at: true,
      },
    });

    this.logger.log(`User ${targetUserId} role updated to ${newRole} by admin ${adminUserId}`);

    return {
      message: 'User role updated successfully',
      user: updatedUser,
    };
  }

  /**
   * Get users with role filtering (admin only)
   */
  async getUsers(adminUserId: number, roleFilter?: Role): Promise<any[]> {
    // Verify admin permission
    const admin = await this.prisma.users.findUnique({
      where: { id: adminUserId },
    });

    if (!admin || (admin.role as string) !== 'ENERGY_ADMIN') {
      throw new UnauthorizedException('Only ENERGY_ADMIN users can view user lists');
    }

    const whereClause: any = {};
    if (roleFilter) {
      whereClause.role = roleFilter;
    }

    const users = await this.prisma.users.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        created_at: true,
        updated_at: true,
        organization_members: {
          include: {
            organizations: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Enhance users with permission information
    return users.map(user => ({
      ...user,
      permissions: ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [],
      organizationCount: user.organization_members.length,
      primaryOrganization: user.organization_members[0]?.organizations || null,
    }));
  }

  /**
   * Assign user to organization with specific role context
   */
  async assignUserToOrganization(
    adminUserId: number, 
    targetUserId: number, 
    organizationId: number,
    roleContext?: { clientId?: number; customerId?: number }
  ): Promise<{ message: string }> {
    // Verify admin permission
    const admin = await this.prisma.users.findUnique({
      where: { id: adminUserId },
      include: {
        organization_members: {
          where: { organization_id: organizationId },
        },
      },
    });

    if (!admin || (admin.role as string) !== 'ENERGY_ADMIN') {
      throw new UnauthorizedException('Only ENERGY_ADMIN users can assign organization memberships');
    }

    // Verify organization exists
    const organization = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.organization_members.findFirst({
      where: {
        user_id: targetUserId,
        organization_id: organizationId,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Create organization membership
    await this.prisma.organization_members.create({
      data: {
        user_id: targetUserId,
        organization_id: organizationId,
        // Note: joined_at has a default value of now()
        // Future: Add role_context field to store clientId/customerId for scoped access
      },
    });

    this.logger.log(`User ${targetUserId} assigned to organization ${organizationId} by admin ${adminUserId}`);

    return {
      message: 'User successfully assigned to organization',
    };
  }
} 